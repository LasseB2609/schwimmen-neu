'use strict';

// 1) Imports
const express = require('express');
const http = require('http');
const path = require('path'); //für Dateipfade
const crypto = require('crypto'); //für Passwort-Hashing
const { promisify } = require('util'); //dient dazu, die scrypt-Funktion von crypto in eine Promise-basierte Funktion umzuwandeln
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io'); //nimmt die Server-Klasse aus dem Socket.IO Modul
const gameState = require('./game/game-state-store'); //für Funktionen wie createGame, saveGame, loadGame
const { createPasswordHelpers } = require('./auth/password');
const { requireAuthPage, requireAuthApi } = require('./auth/guards');
const { registerAuthRoutes } = require('./auth/routes');
const { registerSocketSessionAuth } = require('./socket/session-auth');
const { registerGameSocketHandlers } = require('./socket/game-socket-handlers');
const { createSessionMiddleware } = require('./session/session-middleware');
const { registerSocketRedisAdapter } = require('./socket/socket-redis-adapter');
const lobbyStateStore = require('./lobby/lobby-state-store');

// 2) Datenbank initialisieren
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
//Einfacher Retry-Mechanismus beim Start: DB ist im Compose-Verbund oft erst nach dem Server bereit.
const DB_CONNECT_MAX_RETRIES = Number.parseInt(process.env.DB_CONNECT_MAX_RETRIES || '30', 10); //Maximale Anzahl von Verbindungsversuchen zur Datenbank, bevor aufgegeben wird (hier 30 Versuche)
const DB_CONNECT_RETRY_DELAY_MS = Number.parseInt(process.env.DB_CONNECT_RETRY_DELAY_MS || '2000', 10); //Verzögerung zwischen den Verbindungsversuchen (hier 2000ms)

//Check database connection
function checkDatabaseConnection(attempt = 1) {
    return new Promise((resolve, reject) => {
        connection.query('SELECT 1 + 1 AS solution', function (error, results, fields) {
            if (error) {
                if (attempt >= DB_CONNECT_MAX_RETRIES) {
                    return reject(error); //mehr als max Anzahl an Versuchen durchgeführt, gebe Fehler zurück
                }

                console.warn(`Database not ready (attempt ${attempt}/${DB_CONNECT_MAX_RETRIES}). Retry in ${DB_CONNECT_RETRY_DELAY_MS}ms...`);
                return setTimeout(() => {
                    checkDatabaseConnection(attempt + 1).then(resolve).catch(reject);
                }, DB_CONNECT_RETRY_DELAY_MS); //rekursiver Aufruf der Funktion
            }

            // check the solution - should be 2
            if (results[0].solution == 2) {
                // everything is fine with the database
                console.log("Database connected and works");
                return resolve();
            }

            // connection is not fine - please check
            return reject(new Error('Database health-check returned an unexpected result.'));
        });
    });
}


// Constants
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';
const SERVER_INSTANCE = process.env.SERVER_INSTANCE || 'server-1';
const ROUND_END_BUFFER_MS = 8000; //8 Sekunden Zeit, um die aufgedeckten Karten anzuzeigen
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-change-me'; //setzt den geheimen Schlüssel für die Session Cookies ("dev-only-change-me" ist ein Fallback)
const SESSION_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 12; //legt fest, wie lange der Session-Cookie gültig bleibt (hier 12h)
const scryptAsync = promisify(crypto.scrypt); //macht Passwort-Hashing(crypto.scrypt) einfacher mit await

// 3) App- und Socket-Server erstellen
const app = express();
const server = http.createServer(app); // aus der Express App wird ein HTTP Server erstellt, damit Socket.IO damit arbeiten kann
const io = new Server(server); // erstellt eine neue Socket.IO-Instanz und bindet sie an den HTTP-Server
// Features for JSON Body
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 4) Globale Middleware (mit redis) registrieren und an express anhängen
const sessionMiddleware = createSessionMiddleware({
    sessionSecret: SESSION_SECRET,
    sessionCookieMaxAgeMs: SESSION_COOKIE_MAX_AGE_MS,
    secureCookie: false
});
app.use(sessionMiddleware);

// Professional rate limiter middleware (DoS protection).
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

// 5) Helper/Factories vorbereiten
const { hashPassword, verifyPassword } = createPasswordHelpers(crypto, scryptAsync); //holt die Funktionen für das Hashen und Verifizieren von Passwörtern

// 6) HTTP-Routen registrieren
app.get('/', (req, res) => {
    res.redirect('/static/auth/index.html');
});

//Einfache Health-Route fuer LB-Checks und Demo (zeigt antwortende Instanz)
app.get('/health', (req, res) => {
    res.json({
        ok: true,
        serverInstance: SERVER_INSTANCE,
        pid: process.pid,
        timestamp: new Date().toISOString()
    });
});

registerAuthRoutes(app, {
    path,
    __dirname,
    dbQuery,
    hashPassword,
    verifyPassword,
    requireAuthPage,
    requireAuthApi
}); //übergibt die Express-App und weitere benötigte Informationen/Funktionen an registerAuthRoutes, sodass erfolgreiche Authentifizierungsrouten erstellt werden können

// 7) statische Dateien werden aus dem Public Ordner bereitgestellt
app.use('/static', express.static('public'));

// 8) Socket-Authentifizierung und Socket-Handler registrieren

// 9) Server starten (wenn Datenbankverbindung und Redis Adapter erfolgreich)
async function startServer() {
    await checkDatabaseConnection();
    await registerSocketRedisAdapter(io);

    registerSocketSessionAuth(io, sessionMiddleware);
    registerGameSocketHandlers(io, {
        gameState,
        connection,
        ROUND_END_BUFFER_MS,
        lobbyStateStore
    });

    server.listen(PORT, HOST, () => {
        console.log(`[${SERVER_INSTANCE}] Running on http://${HOST}:${PORT}`);
    });
}

startServer().catch((error) => {
    console.error('Server startup failed:', error);
    process.exit(5); // exit application with error code 5
});

