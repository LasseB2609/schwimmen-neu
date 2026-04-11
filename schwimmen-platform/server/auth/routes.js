'use strict';

//Funktion, um die Authentifizierungsrouten zu registrieren
function registerAuthRoutes(app, deps) {
    const {
        path,
        __dirname,
        dbQuery,
        hashPassword,
        verifyPassword,
        requireAuthPage,
        requireAuthApi
    } = deps;

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
    app.get('/static/auth/index.html', (req, res) => {
        if (req.session?.user?.playerId) { //wenn der User bereits eingeloggt ist, wird er direkt zur Lobby weitergeleitet
            return res.redirect('/static/lobby/lobby.html');
        }
        return res.sendFile(path.join(__dirname, 'public', 'auth', 'index.html')); //sonst wird die index.html ausgegeben
    });

    // Lobby ist geschützt, d.h. nur mit gültiger Session erreichbar
    app.get('/static/lobby/lobby.html', requireAuthPage, (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'lobby', 'lobby.html'));
    });

    // Game ist geschützt, d.h. nur mit gültiger Session erreichbar
    app.get('/static/game/game.html', requireAuthPage, (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'game', 'game.html'));
    });

    // Alte Pfade bleiben als kompatible Weiterleitungen erhalten
    app.get('/static/index.html', (req, res) => {
        return res.redirect('/static/auth/index.html');
    });

    app.get('/static/lobby.html', requireAuthPage, (req, res) => {
        return res.redirect('/static/lobby/lobby.html');
    });

    app.get('/static/game.html', requireAuthPage, (req, res) => {
        return res.redirect('/static/game/game.html');
    });
}

module.exports = {
    registerAuthRoutes
};
