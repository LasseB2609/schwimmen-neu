//in dieser Datei kommen die Nachrichten der Clients an. Server ruft dannn die Spiellogik (Aus der Datei game-server.js) auf und speichert in der Datenbank

'use strict';

const express = require('express');
const http = require('http');
const path = require('path'); //für Dateipfade
const crypto = require('crypto'); //für Passwort-Hashing
const { promisify } = require('util'); //dient dazu, die scrypt-Funktion von crypto in eine Promise-basierte Funktion umzuwandeln
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const { Server } = require('socket.io'); //nimmt die Server-Klasse aus dem Socket.IO Modul
const gameState = require('./game/gameState'); //für Funktionen wie createGame, saveGame, loadGame

// Database
const mysql = require('mysql');
// Database connection info - used from environment variables
var dbInfo = {
    connectionLimit: 10,
    host: process.env.MYSQL_HOSTNAME,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
};

var connection = mysql.createPool(dbInfo);
console.log("Conecting to database...");

connection.query('SELECT 1 + 1 AS solution', function (error, results, fields) {
    if (error) throw error; // <- this will throw the error and exit normally
    // check the solution - should be 2
    if (results[0].solution == 2) {
        // everything is fine with the database
        console.log("Database connected and works");
    } else {
        // connection is not fine - please check
        console.error("There is something wrong with your database connection! Please check");
        process.exit(5); // <- exit application with error code e.g. 5
    }
});


// Constants
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';
const ROUND_END_BUFFER_MS = 8000; //8 Sekunden Zeit, um die aufgedeckten Karten anzuzeigen
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-change-me'; //setzt den geheimen Schlüssel für die Session Cookies ("dev-only-change-me" ist ein Fallback)
const SESSION_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 12; //legt fest, wie lange der Session-Cookie gültig bleibt (hier 12h)
const scryptAsync = promisify(crypto.scrypt); //macht Passwort-Hashing(crypto.scrypt) einfacher mit await

// App
const app = express();
const server = http.createServer(app); // aus der Express App wird ein HTTP Server erstellt, damit Socket.IO damit arbeiten kann
const io = new Server(server); // erstellt eine neue Socket.IO-Instanz und bindet sie an den HTTP-Server
const activeGames = new Map(); //wird verwendet, um die aktiven Spiele speichern zu können
const activeLobbies = new Map(); //speichert wartende Lobbys bis ein Spiel gestartet wird
let nextLobbyId = 1;
// Features for JSON Body
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Konfiguriert die Session-Middleware und hängt sie an die Express-App
const sessionMiddleware = session({
    secret: SESSION_SECRET, //geheimer Schlüssel für die Session-Cookies
    resave: false, //Session wird nicht bei jedem Request neu gespeichert
    saveUninitialized: false, //Session wird nicht gespeichert, wenn sie nicht initialisiert ist
    cookie: {
        httpOnly: true, //Cookies sind nicht durch JavaScript im browser auslesbar
        sameSite: 'lax', //Cookies werden bei Anfragen von anderen Seiten nicht gesendet, außer bei Navigationen (z.B. Link-Klicks), um CSRF-Angriffe zu erschweren
        secure: false, //Cookie darf auch über http gesendet werden (todo: überprüfen ob vor Abgabe noch geändert werden sollte)
        maxAge: SESSION_COOKIE_MAX_AGE_MS //Ablaufzeit (12h)
    } //konfiguriert die Eigenschaften der Session-Cookies
});
app.use(sessionMiddleware);

// Professional rate limiter middleware (DoS protection).
// For teaching/lab tests, defaults are intentionally very high to avoid blocking students.
const limiter = rateLimit({
    windowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10), // 60 seconds
    max: Number.parseInt(process.env.RATE_LIMIT_MAX || "10000", 10), // 10,000 req per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests. Please try again later." }
});
// Apply limiter to all routes.
app.use(limiter);

// Promise-Helfer für SQL-Abfragen (todo: evtl. mit anderem dbquery zusammenlegen)
function dbQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        connection.query(sql, params, (error, results) => {
            if (error) return reject(error);
            resolve(results);
        });
    });
}

// Erstellt einen scrypt-basierten Passwort-Hash
async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex'); //Zufallswert, damit gleiche Passwörter nicht gleiche hashes erzeugen
    const derivedKey = await scryptAsync(password, salt, 64); //hashed das Passwort mit scrypt
    return `scrypt$${salt}$${Buffer.from(derivedKey).toString('hex')}`; //speichert
}

// Vergleicht Klartextpasswort mit gespeichertem Hash = Verifizierung des Passworts
async function verifyPassword(password, storedHash) {
    //Überprüft, ob der gespeicherte Hash gültig ist
    if (!storedHash || typeof storedHash !== 'string') {
        return false;
    }

    const [algorithm, salt, hashHex] = storedHash.split('$'); //zerlegt den Hash in 3 Teile
    if (algorithm !== 'scrypt' || !salt || !hashHex) { //überprüft, ob das Format korrekt ist
        return false;
    }

    const expected = Buffer.from(hashHex, 'hex'); //wandelt den gespeicherten Hash-Teil (der aus der DB) zurück in Binärdaten
    const actual = Buffer.from(await scryptAsync(password, salt, expected.length)); //berechnet aus dem eingegebenen Passwort plus dem gespeicherten Salt einen neuen Hash
    if (expected.length !== actual.length) { //überprüft, ob die Längen der beiden Hashes gleich sind (da folgend gleiche Länge erwartet wird)
        return false;
    }

    return crypto.timingSafeEqual(expected, actual); //vregleicht beide Hashes
}

// Guard für HTML-Seiten
// verhindert den Zugriff auf die Lobby- und Spiel-Seite, wenn der User nicht eingeloggt ist
function requireAuthPage(req, res, next) {
    if (req.session?.user?.playerId) { //überprüft, ob es eine gültige Session gibt
        return next(); //Seite kann ausgegebn werden
    }
    return res.redirect('/static/index.html'); //falls User nicht eingeloggt ist, wird er zur index geleitet
}

// Guard für API-Endpunkte (also z.B. beim Seitenstart)
// verhindert den Zugriff auf API-Endpunkte, wenn der User nicht eingeloggt ist
function requireAuthApi(req, res, next) {
    if (req.session?.user?.playerId) { //überprüft, ob es eine gültige Session gibt
        return next(); //API-Endpunkt kann ausgeführt werden
    }
    return res.status(401).json({ message: 'Nicht angemeldet.' }); //falls User nicht eingeloggt ist, wird dies als Fehler zurückgegeben
}

// Startpunkt: immer auf Login/Startseite.
app.get('/', (req, res) => {
    console.log("Got a request and redirect it to index page");
    res.redirect('/static/index.html');
});



// Authentifizierung: prüft Login-Session und liefert aktuellen Nutzer
app.get('/auth/me', requireAuthApi, async (req, res) => {
    const playerId = req.session.user.playerId; //holt die playerId aus der Session
    const rows = await dbQuery('SELECT player_id, username FROM Player WHERE player_id = ? LIMIT 1', [playerId]); //holt die Daten des Users aus der DB
    if (rows.length === 0) { //wenn der User nicht gefunden wird, wird die Session gelöscht und ein Fehler zurückgegeben
        req.session.destroy(() => {});
        return res.status(401).json({ message: 'Session ungültig.' });
    }
    return res.json({ playerId: rows[0].player_id, username: rows[0].username }); //falls User gefunden wurde, werden die Daten zurückgegeben
});

// Registrierung mit Passwort-Hash und direktem Login danach
app.post('/auth/register', async (req, res) => {
    try {
        const username = String(req.body?.username || '').trim();
        const password = String(req.body?.password || '');

        if (username.length < 3 || username.length > 100) { //überprüft Länge des Nutzernamens
            return res.status(400).json({ message: 'Username muss 3-100 Zeichen lang sein.' });
        }
        if (password.length < 6) { //überprüft Länge des Passworts
            return res.status(400).json({ message: 'Passwort muss mindestens 6 Zeichen haben.' });
        }

        //überprüft, ob es den Nutzernamen bereits gibt
        const existing = await dbQuery('SELECT player_id FROM Player WHERE username = ? LIMIT 1', [username]);
        if (existing.length > 0) {
            return res.status(409).json({ message: 'Username ist bereits vergeben.' });
        }

        //hashed das Passwort und speichert den User mit seinen Daten in der Datenbakn
        const passwordHash = await hashPassword(password);
        const insertResult = await dbQuery(
            'INSERT INTO Player (username, password_hash) VALUES (?, ?)',
            [username, passwordHash]
        );

        //setzt die Session-Daten, damit der User direkt nach der Registrierung eingeloggt ist
        req.session.user = { playerId: insertResult.insertId, username };
        return res.status(201).json({ playerId: insertResult.insertId, username });
    } catch (error) { //Fehlerbehandlung
        console.error('register failed:', error);
        return res.status(500).json({ message: 'Registrierung fehlgeschlagen.' });
    }
});

// Login mit Username und Passwort
app.post('/auth/login', async (req, res) => {
    try {
        const username = String(req.body?.username || '').trim(); //holt den Nutzernamen aus den eingegebenen Daten
        const password = String(req.body?.password || ''); //holt das Passwort aus den eingegebenen Daten

        if (!username || !password) { //prüft, ob username und Passwort gesetzt sind
            return res.status(400).json({ message: 'Username und Passwort sind erforderlich.' });
        }

        const rows = await dbQuery(
            'SELECT player_id, username, password_hash FROM Player WHERE username = ? LIMIT 1',
            [username]
        ); //sucht den Nutzer in der DB
        if (rows.length === 0) { //Fehlerbehandlung, falls der Nutzer nicht gefunden wurde
            return res.status(401).json({ message: 'Login fehlgeschlagen.' });
        }

        const player = rows[0]; //speichert die playerId
        const passwordValid = await verifyPassword(password, player.password_hash); //verifiziert, ob das eingetragene Passwort mit dem gespeicherten übereinstimmt
        if (!passwordValid) { //Fehlerbehandlung, falls Passwort falsch ist
            return res.status(401).json({ message: 'Login fehlgeschlagen.' });
        }

        //speichert die session-Daten
        req.session.user = { playerId: player.player_id, username: player.username }; 
        return res.json({ playerId: player.player_id, username: player.username });
    } catch (error) { //Fehlerbehandlung
        console.error('login failed:', error);
        return res.status(500).json({ message: 'Login fehlgeschlagen.' });
    }
});

// Logout löscht Session + Cookie
app.post('/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ ok: true });
    });
});

// Index ist offen (d.h. auch ohne Login erreichbar)
app.get('/static/index.html', (req, res) => {
    if (req.session?.user?.playerId) { //wenn der User bereits eingeloggt ist, wird er direkt zur Lobby weitergeleitet
        return res.redirect('/static/lobby.html');
    }
    return res.sendFile(path.join(__dirname, 'public', 'index.html')); //sonst wird die index.html ausgegeben
});

// Lobby ist geschützt, d.h. nur mit gültiger Session erreichbar
app.get('/static/lobby.html', requireAuthPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'lobby.html'));
});

// Game ist geschützt, d.h. nur mit gültiger Session erreichbar
app.get('/static/game.html', requireAuthPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

// statische Dateien werden aus dem Public Ordner bereitgestellt
app.use('/static', express.static('public'));

//Funktion, um den aktuellen Spielstatus zurückzugeben, damit er später an die Clients gesendet werden kann 
function getGameState(game) {
    return {
        gameId: game.game_id,
        status: game.status || 'playing',
        currentRound: game.currentRound,
        currentPlayerIndex: game.currentPlayerIndex,
        knockedByPlayerId: game.knockedByPlayerId || null,
        roundEnded: Boolean(game.roundEnded),
        lastRoundSummary: game.lastRoundSummary || null,
        players: game.players.map((player) => ({
            player_id: player.player_id,
            username: player.username,
            seat_index: player.seatIndex ?? null,
            lives: player.lives,
            score: player.score,
            hand: player.hand
        })),
        tableCards: game.tableCards
    };
}

//Funktion, um eine Lobby-Zusammenfassung zu erstellen, damit sie später an die Clients gesendet werden kann
function getLobbySummary(lobby) {
    return {
        lobbyId: lobby.lobbyId,
        lobbyName: lobby.lobbyName,
        hostPlayerId: lobby.hostPlayerId,
        playerIds: Array.from(lobby.playerIds),
        status: lobby.status
    };
}

//Funktion, um die Liste der Lobbys an alle Clients zu senden, damit sie die verfügbaren Lobbys sehen können
function emitLobbyList() {
    const lobbies = Array.from(activeLobbies.values()) //wandelt die Map in ein Array um
        .filter((lobby) => lobby.status === 'waiting') //filtert nur nach Lobbys mit dem Status "waiting"
        .map(getLobbySummary); //wandelt die Daten der Lobby mit der getLobbySummary Funktion in ein übersichtliches Format um
    io.emit('lobby-list', { lobbies }); //sendet die Lobby-Liste an alle Clients
}

//Funktion, um einen Spieler aus einer Lobby zu entfernen
function removePlayerFromLobby(lobby, playerId) {
    lobby.playerIds.delete(playerId); //entfernt die playerId aus den playerIds der Lobby

    //falls die Lobby jetzt leer ist, wird sie aus activeLobbies gelöscht
    if (lobby.playerIds.size === 0) {
        activeLobbies.delete(lobby.lobbyId);
        return;
    }

    //falls der entfernte Spieler der Host war, wird ein neuer Host festgelegt (der erste Spieler in der Lobby)
    if (lobby.hostPlayerId === playerId) {
        lobby.hostPlayerId = Array.from(lobby.playerIds)[0];
    }
}

//lädt ein Spiel aus activeGames oder bei Bedarf aus der Datenbank
async function getOrLoadGame(roomId) {
    //zunächst wird versucht das Spiel aus activeGames zu holen
    let game = activeGames.get(roomId);
    if (game) {
        console.log("INFO: DAS SPIEL WIRD AUS ACTIVE GAMES GEHOLT (RAM)");
        return game; //gibt das Spiel zurück
    }

    //falls das Spiel nicht in activeGames gefunden wird, wird versucht es aus der Datenbank zu laden
    const gameId = Number.parseInt(roomId, 10);
    game = await gameState.loadGame(connection, gameId);
    if (game) {
        console.log("INFO: DAS SPIEL WIRD AUS DER DATENBANK GELADEN");
        activeGames.set(roomId, game); //speichert das geladene Spiel in activeGames, damit es beim nächsten Mal direkt verfügbar ist
    }

    return game; //gibt das Spiel zurück
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

//wertet eine Runde aus, wenn die Aktion das Rundenende markiert hat
async function finalizeRoundIfNeeded(game, roomId, actionResult) {
    if (!actionResult?.roundShouldEnd) {
        return;
    }

    const roundSummary = game.endRound(); //beendet die Runde
    await gameState.saveGame(connection, game); //speichert den aktualisierten Spielzustand in der Datenbank

    //sendet eine Nachricht an die Clients, dass die Runde beendet ist
    io.to(roomId).emit('round-ended', {
        reason: 'knock-cycle-complete',
        knockedByPlayerId: game.knockedByPlayerId,
        roundSummary
    });

    // Gibt allen Clients Zeit, die aufgedeckten Karten und Punkte zu sehen.
    await wait(ROUND_END_BUFFER_MS);

    //wenn durch das Rundenende das Spiel zu Ende ist, wird eine Nachricht (mit Sieger und weiteren Infos) an die Clients gesendet
    if (roundSummary.gameIsOver) {
        io.to(roomId).emit('game-finished', {
            winnerPlayerIds: roundSummary.winnerPlayerIds || []
        });
        io.to(roomId).emit('game-state', getGameState(game));
        return;
    }

    //Direkte Rundenenden nach dem Austeilen (31/Feuer) werden so lange aufgelöst,
    //bis eine spielbare Runde entstanden ist oder das Spiel beendet wurde.
    while (game.roundEnded) {
        game.resetForNewRound(); //nächste Runde vorbereiten

        //Falls durch das Austeilen keine sofortige Rundenbeendigung entstanden ist:
        if (!game.roundEnded) {
            await gameState.saveGame(connection, game); //Speichert den aktualisierten Spielzustand in der Datenbank
            io.to(roomId).emit('round-started', { //sendet eine Nachricht an die Clients, dass eine neue Runde gestartet ist
                currentRound: game.currentRound,
                currentPlayerId: game.getCurrentPlayer() ? game.getCurrentPlayer().player_id : null
            });
            io.to(roomId).emit('game-state', getGameState(game)); //sendet den aktualisierten Spielstatus an die Clients
            return; //verlässt die Funktion
        }

        //Falls durch das Austeilen eine sofortige Rundenbeendigung entstanden ist:
        const immediateRoundSummary = game.endRound(); //beendet die Runde direkttte
        await gameState.saveGame(connection, game); //speichert das Spiel mit der sofortigen Rundenbeendigung in der Datenbank
        io.to(roomId).emit('round-ended', {
            reason: 'immediate-round-end-on-deal',
            roundSummary: immediateRoundSummary
        }); //informt die Clients über die sofortige Rundenbeendigung

        // Auch bei direkten Rundenenden denselben Sichtbarkeits-Puffer einhalten.
        await wait(ROUND_END_BUFFER_MS);

        //wenn durch das sofortige Rundenende das SPiel zu Ende ist, wird folgendes durchgeführt
        if (immediateRoundSummary.gameIsOver) {
            //informiert die Clients über das Spielende, die Sieger und sendet den finalen Spielstand
            io.to(roomId).emit('game-finished', {
                winnerPlayerIds: immediateRoundSummary.winnerPlayerIds || []
            }); 
            io.to(roomId).emit('game-state', getGameState(game));
            return;
        }
    }
}

// hängt die SessionMiddleware an die Socket.IO-Verbindungen
io.engine.use(sessionMiddleware);

// Blockiert Socket-Verbindungen ohne gültige Login-Session
io.use((socket, next) => {
    const user = socket.request?.session?.user; //liest den User aus der Session der Socket-Verbindung aus
    if (!user || !Number.isInteger(user.playerId)) { //wenn kein gültiger User in der Session gefunden wird, wird die Verbindung mit einem Fehler abgelehnt
        return next(new Error('unauthorized'));
    }

    //speichert die playerId und den username im Socket-Datenobjekt
    socket.data.playerId = user.playerId;
    socket.data.username = user.username;
    return next(); //erlaubt die Verbindung, wenn eine gültige Session gefunden wurde
});

//wenn sich ein Client mit Socket.io verbindet, wird die folgende Funktion ausgeführt
io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id); //Konsolenausgabe der Socket-ID des verbundenen Clients

    //wenn der Client eine "lobby-list" anfragt, wird folgende Funktion ausgeführt
    socket.on('lobby-list-request', () => {
        const lobbies = Array.from(activeLobbies.values()) //wandelt die Map in ein Array um
            .filter((lobby) => lobby.status === 'waiting') //filtert nur nach Lobbys mit dem Status "waiting"
            .map(getLobbySummary); //wandelt die Daten der Lobby mit der getLobbySummary Funktion in ein übersichtliches Format um
        socket.emit('lobby-list', { lobbies });
    });

    //wenn der Client eine "lobby-create" Nachricht sendet, wird folgende Funktion ausgeführt
    socket.on('lobby-create', (data) => {
        const playerId = socket.data.playerId; //speichert die playerId aus der socket-Verbindung
        const lobbyName = String(data?.lobbyName || '').trim() || 'Neue Lobby'; //speichert den LobbyNamen als String ab, falls nicht vorhanden, wird "Neue Lobby" verwendet

        //überprüft, ob die playerId gültig ist
        if (!Number.isInteger(playerId)) {
            socket.emit('game-error', { message: 'Ungültige playerId für lobby-create.' });
            return;
        }

        const lobbyId = String(nextLobbyId++); //erstellt eine neue LobbyId und erhöht den nextLobbyId Zähler für die nächste Lobby
        const lobbyRoomId = `lobby-${lobbyId}`; //erstellt eine eindeutige RaumId für jede Lobby (basierend auf der LobbyId)
        const lobby = {
            lobbyId,
            lobbyName,
            hostPlayerId: playerId,
            playerIds: new Set([playerId]), //speichert die playerIds als Set, damit keine doppelten Einträge möglich sind
            status: 'waiting'
        }; //erstellt ein Lobby-Objekt


        activeLobbies.set(lobbyId, lobby); //fügt die Lobby den activeLobbies hinzu
        socket.join(lobbyRoomId); //erstellt einen Socket.io Raum für die Lobby
        socket.data.playerId = playerId; //speichert die playerId im Socket-Datenobjekt, damit man später weiß, wer diese Socket-Verbindung hat
        socket.data.lobbyId = lobbyId; //speichert die lobbyId im Socket-Datenobjekt

        io.to(lobbyRoomId).emit('lobby-updated', getLobbySummary(lobby)); //sendet eine Nachricht an alle Clients im Lobby-Raum, dass die Lobby aktualisiert wurde
        emitLobbyList(); //schickt die aktualisierte Lobby-Liste an alle Clients, damit sie die neue Lobby sehen können
    });

    //wenn der Client eine "lobby-join" Nachricht sendet, wird folgende Funktion ausgeführt
    socket.on('lobby-join', (data) => {
        const playerId = socket.data.playerId; //speichert die playerId aus der Socket Verbindung
        const lobbyId = String(data?.lobbyId || ''); //speichert die lobbyId aus den übergebenen Daten als String ab
        const lobby = activeLobbies.get(lobbyId); //speichert die Lobby ab, die der Client joinen möchte
        const lobbyRoomId = `lobby-${lobbyId}`; //erstellt die RoomId für den Socket.io Raum der Lobby
        //überprüft, ob die playerId gültig ist und die Lobby existiert
        if (!Number.isInteger(playerId) || !lobbyId) {
            socket.emit('game-error', { message: 'Ungültige Daten für lobby-join.' });
            return;
        }

        //überprüft, ob die Lobby existiert und den Status "waiting" hat
        if (!lobby || lobby.status !== 'waiting') {
            socket.emit('game-error', { message: 'Lobby nicht gefunden.' });
            return;
        }

        //fügt den Spieler der Lobby hinzu
        lobby.playerIds.add(playerId); //fügt die playerId zu den playerIds der Lobby hinzu
        socket.join(lobbyRoomId); //Client joint dem Socket.io Raum der Lobby
        socket.data.playerId = playerId; //speichert die playerId im Socket-Datenobjekt, damit man später weiß, wer diese Socket-Verbindung hat
        socket.data.lobbyId = lobbyId; //speichert die lobbyId im Socket-Datenobjekt

        io.to(lobbyRoomId).emit('lobby-updated', getLobbySummary(lobby)); //sendet eine Nachricht an alle Clients im Lobby-Raum, dass die Lobby aktualisiert wurde
        emitLobbyList(); //schickt die aktualisierte Lobby-Liste an alle Clients, damit sie die neue Spieleranzahl in der Lobby sehen können
    });

    //wenn der Client eine "lobby-leave" Nachricht sendet, wird folgende Funktion ausgeführt
    socket.on('lobby-leave', (data) => {
        const playerId = socket.data.playerId; //speichert die plyaerId aus der socket-Verbindung
        const lobbyId = String(data?.lobbyId ?? socket.data.lobbyId ?? ''); //speichert die lobbyId aus den übergebenen Daten oder aus den Socket-Daten als String
        const lobby = activeLobbies.get(lobbyId); //speichert die Lobby ab, die der Client verlassen möchte
        const lobbyRoomId = `lobby-${lobbyId}`; //erstellt die RoomId für den Socket.io Raum der Lobby

        //überprüft, ob die playerId gültig ist und die Lobby existiert
        if (!Number.isInteger(playerId) || !lobby) {
            return;
        }

        removePlayerFromLobby(lobby, playerId); //entfernt den Spieler aus der Lobby und löscht die Lobby, falls sie jetzt leer ist
        socket.leave(lobbyRoomId); //lässt den Client den Socket.io Raum der Lobby verlassen
        socket.data.lobbyId = null; //entfernt die lobbyId aus den Socket-Daten, da der Client ja jetzt keine Lobby mehr hat

        //falls die Lobby noch existiert, wird eine Nachricht an die Clients im Lobby-Raum gesendet, dass die Lobby aktualisiert wurde
        if (activeLobbies.has(lobbyId)) {
            io.to(lobbyRoomId).emit('lobby-updated', getLobbySummary(lobby));
        }
        emitLobbyList(); //schickt die aktualisierte Lobby-Liste an alle Clients
    });

    //wenn der Client eine "lobby-start-game" Nachricht sendet, wird folgende Funktion ausgeführt
    socket.on('lobby-start-game', async (data) => {
        try {
            const lobbyId = String(data?.lobbyId || socket.data.lobbyId || ''); //speichert die LobbyId aus den übergebenen Daten oder aus den Socket-Daten als String ab
            const playerId = socket.data.playerId; //speichert die playerId aus der Socket-Verbindung
            const lobby = activeLobbies.get(lobbyId); //speichert die Lobby ab, die das Spiel starten möchte
            const lobbyRoomId = `lobby-${lobbyId}`; //erstellt die RoomId für den Socket.io Raum der Lobby
            //überprüft, ob die Lobby existiert und den Status "waiting" hat 
            if (!lobby || lobby.status !== 'waiting') {
                socket.emit('game-error', { message: 'Lobby nicht gefunden.' });
                return;
            }

            //überprüft, ob der Spieler, der das Spiel starten möchte, tatsächlich der Host der Lobby ist
            if (!Number.isInteger(playerId) || lobby.hostPlayerId !== playerId) {
                socket.emit('game-error', { message: 'Nur der Host darf das Spiel starten.' });
                return;
            }

            const playerIds = Array.from(lobby.playerIds); //erstellt ein Array aus den Spieler-IDs der Lobby
            //überprüft, ob mindestens 2 Spieler in der Lobby sind, damit das Spiel gestartet werden kann
            if (playerIds.length < 2) {
                socket.emit('game-error', { message: 'Mindestens 2 Spieler werden benötigt.' });
                return;
            }

            //erstellt ein neues Spiel mit den playerIds der Lobby
            const game = await gameState.createGame(connection, playerIds); //erstellt das Game und speichert es als Objekt ab
            const roomId = String(game.game_id); //speichert die game_id als roomId ab
            activeGames.set(roomId, game); //speichert das Spiel in der activeGames Map

            lobby.status = 'started'; //der Lobby-Status wird auf started gesetzt
            io.to(lobbyRoomId).emit('lobby-game-started', { gameId: game.game_id, lobbyId }); //sendet eine Nachricht an alle Clients im Lobby-Raum, dass das Spiel gestartet wurde
            activeLobbies.delete(lobbyId); //entfernt die Lobby aus den activeLobbies
            emitLobbyList(); //schickt die aktualisierte Lobby-Liste an alle Clients 
        } catch (error) { //Fehlerbehandlung
            console.error('lobby-start-game failed:', error);
            socket.emit('game-error', { message: error.message });
        }
    });

    //Wenn der Client eine "create-game" Nachricht sendet, wird folgende Funktion ausgeführt
    socket.on('create-game', async (data) => {
        try {
            //data könnte entweder ein Array von playerIds sein oder ein Objekt mit einem playerIds-Array
            //todo: überlegen, was wirklich übergeben wird und nicht benötigtes entfernen
            const playerIds = Array.isArray(data)
                ? data // Wenn data direkt ein Array ist, verwenden wir es
                : Array.isArray(data?.playerIds) // Wenn data ein Objekt mit einem playerIds-Array ist, verwenden wir dieses Array
                    ? data.playerIds
                    : []; // Wenn keines der beiden Fälle zutrifft, verwenden wir ein leeres Array

            const game = await gameState.createGame(connection, playerIds); //erstellt ein neues Spiel mit der Datenbankverbindung und den übergebenen Spieler-IDs
            const roomId = String(game.game_id); //speichert die game_id als roomId ab
            activeGames.set(roomId, game); //speichert das Spiel in der activeGames Map, damit es später abgerufen werden kann (z.B. wenn ein Spieler beitritt oder der Spielstatus aktualisiert werden muss)

            socket.join(roomId); //erstellt einen socket.io Raum mit der roomID, damit darüber mit allen Clients kommuniziert werden kann

            socket.emit('game-created', { //sendet Nachricht an den Client, dass das Spiel(mit der game_id) erstellt wurde
                gameId: game.game_id
            });

            io.to(roomId).emit('game-state', getGameState(game)); //sendet an den Raum (mit den Clients) den aktuellen Gamestate
        } catch (error) {
            console.error('create-game failed:', error);
            socket.emit('game-error', { message: error.message });
        }
    });

    //wenn der Client eine "join-game" Nachricht sendet, wird folgende Funktion ausgeführt
    socket.on('join-game', async (data) => {
        const roomId = String(data?.gameId || ''); //holt die GameID aus den übergebenen Daten und speichert sie als RoomId ab
        const game = await getOrLoadGame(roomId); //holt das Spiel aus activeGames oder lädt es aus der Datenbank
        const playerId = socket.data.playerId; //holt die playerId aus der Socket-Verbindung

        
        if (!game) { //wird ausgeführt falls das Spiel nicht existiert/nicht gefunden wurde
            socket.emit('game-error', { message: 'Spiel nicht in activeGames gefunden.' });
            return;
        }

        //Nur Spieler im Spiel dürfen dem Spielraum beitreten
        const isPlayerInGame = game.players.some((player) => player.player_id === playerId);
        if (!isPlayerInGame) {
            socket.emit('game-error', { message: 'Du bist kein Spieler in diesem Spiel.' });
            return;
        }

        socket.join(roomId); //lässt den Client dem Socket.io Raum beitreten
        socket.emit('game-state', getGameState(game)); //sendet den aktuellen Gamestate an den Client
    });

    //wenn der Client eine "swap-card" Nachricht sendet, wird folgende Funktion ausgeführt
    socket.on('swap-card', async (data) => {
        try {
            //holt die benötigten Werte aus den übergebenen Daten
            const roomId = String(data?.gameId || '');
            const playerId = socket.data.playerId;
            const handCardId = Number.parseInt(data?.handCardId, 10);
            const tableCardIndex = Number.parseInt(data?.tableCardIndex, 10);

            //validiert, dass alle benötigten Werte gesetzt sind
            if (!roomId || !Number.isInteger(playerId) || !Number.isInteger(handCardId) || !Number.isInteger(tableCardIndex)) {
                socket.emit('game-error', { message: 'Ungültige Daten für swap-card.' });
                return;
            }

            const game = await getOrLoadGame(roomId);
            //überprüfen, ob das Spiel existiert
            if (!game) {
                socket.emit('game-error', { message: 'Spiel nicht in activeGames gefunden.' });
                return;
            }

            //führt die Spiellogik aus (tauscht Handkarte gegen Tischkarte)
            const actionResult = game.swapCard(playerId, handCardId, tableCardIndex);

            //speichert den aktualisierten Spielzustand in der Datenbank
            await gameState.saveGame(connection, game);

            //sendet den aktualisierten Spielstatus an alle Clients im Spielraum
            io.to(roomId).emit('game-state', getGameState(game));
            await finalizeRoundIfNeeded(game, roomId, actionResult);
        } catch (error) {
            console.error('swap-card failed:', error);
            socket.emit('game-error', { message: error.message });
        }
    });

    //wenn der Client eine "swap-all-cards" Nachricht sendet, wird folgende Funktion ausgeführt
    socket.on('swap-all-cards', async (data) => {
        try {
            //holt die benötigten Werte aus den übergebenen Daten
            const roomId = String(data?.gameId || '');
            const playerId = socket.data.playerId; //holt die playerId aus der Socket-Verbindung

            //validiert, dass alle benötigten Werte gesetzt sind
            if (!roomId || !Number.isInteger(playerId)) {
                socket.emit('game-error', { message: 'Ungültige Daten für swap-all-cards.' });
                return;
            }

            const game = await getOrLoadGame(roomId); //holt das Spiel aus activeGames oder lädt es aus der Datenbank
            if (!game) { //überprüfen, ob das Spiel existiert
                socket.emit('game-error', { message: 'Spiel nicht in activeGames gefunden.' });
                return;
            }

            const actionResult = game.swapAllCards(playerId); //tauscht alle Handkarten mit den Tischkarten
            await gameState.saveGame(connection, game); //speichert den aktualisierten Spielzustand in der Datenbank
            //sendet den aktualisierten Spielstatus an die Clients im Spielraum
            io.to(roomId).emit('game-state', getGameState(game)); 
            await finalizeRoundIfNeeded(game, roomId, actionResult);
        } catch (error) { //Fehlerbehandlung
            console.error('swap-all-cards failed:', error);
            socket.emit('game-error', { message: error.message });
        }
    });

    //wenn der Client eine "knock" Nachricht sendet, wird folgende Funktion ausgeführt
    socket.on('knock', async (data) => {
        try {
            const roomId = String(data?.gameId || ''); //holt die GameID aus den übergebenen Daten und speichert sie als RoomId ab
            const playerId = socket.data.playerId; //holt die playerId aus der Socket-Verbindung

            const game = await getOrLoadGame(roomId); //holt das Spiel aus activeGames oder lädt es aus der Datenbank
            
            //überprüfen, ob das Spiel existiert
            if (!game) {
                socket.emit('game-error', { message: 'Spiel nicht in activeGames gefunden.' });
                return;
            }

            
            const actionResult = game.knock(playerId);//führt die Spiellogik für das Klopfen aus
            await gameState.saveGame(connection, game);//speichert den aktualisierten Spielzustand in der Datenbank
            io.to(roomId).emit('game-state', getGameState(game)); //sendet den aktualisierten Spielstatus an die Clients
            await finalizeRoundIfNeeded(game, roomId, actionResult);
        } catch (error) { //Fehlerbehandlung
            console.error('knock failed:', error);
            socket.emit('game-error', { message: error.message });
        }
    });

    //wenn der Client eine "pass" Nachricht sendet, wird folgende Funktion ausgeführt
    socket.on('pass', async (data) => {
        try {
            const roomId = String(data?.gameId || ''); //holt die GameID aus den übergebenen Daten und speichert sie als RoomId ab
            const playerId = socket.data.playerId; //holt die playerId aus der socket-Verbindung

            if (!roomId || !Number.isInteger(playerId)) { //validiert, dass die benötigten Werte gesetzt sind
                socket.emit('game-error', { message: 'Ungültige Daten für pass.' });
                return;
            }

            const game = await getOrLoadGame(roomId); //holt das Spiel aus activeGames oder lädt es aus der Datenbank
            if (!game) { //überprüfen, ob das Spiel existiert
                socket.emit('game-error', { message: 'Spiel nicht in activeGames gefunden.' });
                return;
            }

            const actionResult = game.pass(playerId); //führt die Spiellogik für das Passen aus)
            await gameState.saveGame(connection, game); //speichert den aktualisierten Spielzustand in der Datenbank
            io.to(roomId).emit('game-state', getGameState(game)); //sendet den aktualisierten Spielstatus an die Clients
            await finalizeRoundIfNeeded(game, roomId, actionResult);
        } catch (error) { //Fehlerbehandlung
            console.error('pass failed:', error);
            socket.emit('game-error', { message: error.message });
        }
    });

    //wenn der Client sich trennt, wird dies in der Konsole ausgegeben
    //todo: evtl spieler aus dem Spiel entfernen oder ähnliches
    socket.on('disconnect', () => {
        console.log('Socket disconnected:', socket.id);
    });
});

// Start the actual server
server.listen(PORT, HOST, () => {
    console.log(`Running on http://${HOST}:${PORT}`);
});

// Start database connection
const sleep = (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
}


