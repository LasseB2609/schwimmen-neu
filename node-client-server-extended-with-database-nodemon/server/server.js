'use strict';

// 1) Imports
const express = require('express');
const http = require('http');
const path = require('path'); //für Dateipfade
const crypto = require('crypto'); //für Passwort-Hashing
const { promisify } = require('util'); //dient dazu, die scrypt-Funktion von crypto in eine Promise-basierte Funktion umzuwandeln
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const { Server } = require('socket.io'); //nimmt die Server-Klasse aus dem Socket.IO Modul
const gameState = require('./game/gameState'); //für Funktionen wie createGame, saveGame, loadGame
const { createPasswordHelpers } = require('./auth/password');
const { requireAuthPage, requireAuthApi } = require('./auth/guards');
const { registerAuthRoutes } = require('./auth/routes');
const { registerSocketSessionAuth } = require('./socket/session-auth');
const { registerGameSocketHandlers } = require('./socket/game-socket-handlers');

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
//Check database connection
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

// 3) App- und Socket-Server erstellen
const app = express();
const server = http.createServer(app); // aus der Express App wird ein HTTP Server erstellt, damit Socket.IO damit arbeiten kann
const io = new Server(server); // erstellt eine neue Socket.IO-Instanz und bindet sie an den HTTP-Server
// Features for JSON Body
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 4) Globale Middleware registrieren und an express anhängen
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

// 7) HTTP-Routen registrieren
app.get('/', (req, res) => {
    console.log("Got a request and redirect it to index page");
    res.redirect('/static/auth/index.html');
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

// 8) statische Dateien werden aus dem Public Ordner bereitgestellt
app.use('/static', express.static('public'));

// 9) Socket-Authentifizierung und Socket-Handler registrieren
registerSocketSessionAuth(io, sessionMiddleware);
registerGameSocketHandlers(io, {
    gameState,
    connection,
    ROUND_END_BUFFER_MS
});

// 10) Server starten
server.listen(PORT, HOST, () => {
    console.log(`Running on http://${HOST}:${PORT}`);
});

