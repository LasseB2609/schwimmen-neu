'use strict';

//Funktion, um die Socket-Authentifizierung zu registrieren, damit nur eingeloggte User eine Socket-Verbindung aufbauen können
function registerSocketSessionAuth(io, sessionMiddleware) {
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
}

module.exports = {
    registerSocketSessionAuth
};
