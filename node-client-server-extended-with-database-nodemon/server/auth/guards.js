'use strict';

// Guard für HTML-Seiten
// verhindert den Zugriff auf die Lobby- und Spiel-Seite, wenn der User nicht eingeloggt ist
function requireAuthPage(req, res, next) {
    if (req.session?.user?.playerId) { //überprüft, ob es eine gültige Session gibt
        return next(); //Seite kann ausgegebn werden
    }
    return res.redirect('/static/auth/index.html'); //falls User nicht eingeloggt ist, wird er zur index geleitet
}

// Guard für API-Endpunkte (also z.B. beim Seitenstart)
// verhindert den Zugriff auf API-Endpunkte, wenn der User nicht eingeloggt ist
function requireAuthApi(req, res, next) {
    if (req.session?.user?.playerId) { //überprüft, ob es eine gültige Session gibt
        return next(); //API-Endpunkt kann ausgeführt werden
    }
    return res.status(401).json({ message: 'Nicht angemeldet.' }); //falls User nicht eingeloggt ist, wird dies als Fehler zurückgegeben
}

module.exports = {
    requireAuthPage,
    requireAuthApi
};
