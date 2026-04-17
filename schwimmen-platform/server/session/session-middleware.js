'use strict';

const session = require('express-session');

//Erstellt die Session-Middleware.
function createSessionMiddleware(options) {
    const {
        sessionSecret,
        sessionCookieMaxAgeMs,
        secureCookie = false
    } = options;


    //Konfigurationen für die Session-Middleware
    const baseConfig = {
        secret: sessionSecret, //geheimer Schlüssel für die Session-Cookies
        resave: false, //Session wird nicht bei jedem Request neu gespeichert
        saveUninitialized: false, //Session wird nicht gespeichert, wenn sie nicht initialisiert ist
        cookie: {
            httpOnly: true, //Cookies sind nicht durch JavaScript im browser auslesbar
            sameSite: 'lax', //Cookies werden bei Anfragen von anderen Seiten nicht gesendet, außer bei Navigationen (z.B. Link-Klicks), um CSRF-Angriffe zu erschweren
            secure: secureCookie, //Cookie darf auch über http gesendet werden
            maxAge: sessionCookieMaxAgeMs //Ablaufzeit (12h)
        } //konfiguriert die Eigenschaften der Session-Cookies
    };

    //Redis-Pakete sind Voraussetzung
    const { createClient } = require('redis');
    const { RedisStore } = require('connect-redis');

    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    const redisClient = createClient({ url: redisUrl });

    //Fehlermanagement für Redis-Verbindung 
    redisClient.on('error', (error) => {
        console.error('Redis client error:', error);
    });

    //Verbindung im Hintergrund aufbauen; bei Fehlern wird geloggt.
    redisClient.connect().catch((error) => {
        console.error('Redis connect failed, session store may be unavailable:', error);
    });

    const store = new RedisStore({ client: redisClient }); //erstellt einen neuen Redis-Store für die Sessions, der den Redis-Client verwendet

    return session({
        ...baseConfig,
        store
    }); //gibt die Konfiguartion für die Session-Middleware und den Redis-Store zurück
}

module.exports = {
    createSessionMiddleware
};