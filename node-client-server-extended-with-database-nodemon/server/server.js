'use strict';

const express = require('express');
const http = require('http');
const rateLimit = require('express-rate-limit');
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

// App
const app = express();
const server = http.createServer(app); // aus der Express App wird ein HTTP Server erstellt, damit Socket.IO damit arbeiten kann
const io = new Server(server); // erstellt eine neue Socket.IO-Instanz und bindet sie an den HTTP-Server
const activeGames = new Map(); //wird verwendet, um die aktiven Spiele speichern zu können
// Features for JSON Body
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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

// Entrypoint - call it with: http://localhost:8080/ -> redirect you to http://localhost:8080/static
app.get('/', (req, res) => {
    console.log("Got a request and redirect it to the static page");
    // redirect will send the client to another path / route. In this case to the static route.
    res.redirect('/static');
});

//evtl. einfach entfernen
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// statische Dateien werden aus dem Public Ordner bereitgestellt
app.use('/static', express.static('public'));

//Funktion, um den aktuellen Spielstatus zurückzugeben, damit er später an die Clients gesendet werden kann 
function getGameState(game) {
    return {
        gameId: game.game_id,
        currentRound: game.currentRound,
        currentPlayerIndex: game.currentPlayerIndex,
        players: game.players.map((player) => ({
            player_id: player.player_id,
            username: player.username,
            lives: player.lives,
            score: player.score,
            hand: player.hand
        })),
        tableCards: game.tableCards
    };
}

//wenn sich ein Client mit Socket.io verbindet, wird folgende Funktion ausgeführt
io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id); //Konsolenausgabe der Socket-ID des verbundenen Clients

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
    socket.on('join-game', (data) => {
        const roomId = String(data?.gameId || ''); //holt die GameID aus den übergebenen Daten und speichert sie als RoomId ab
        const game = activeGames.get(roomId); //holt das Spiel aus der activeGames Map, damit der Client dem entsprechenden Spiel beitreten kann

        
        if (!game) { //wird ausgeführt falls das Spiel nicht existiert/nicht gefunden wurde
            socket.emit('game-error', { message: 'Spiel nicht in activeGames gefunden.' });
            return;
        }

        socket.join(roomId); //lässt den Client dem Socket.io Raum beitreten
        socket.emit('game-state', getGameState(game)); //sendet den aktuellen Gamestate an den Client
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


