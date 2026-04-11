//Datei, die die Initialisierungslogik für die Lobby-Seite enthält

//Lädt den Session-User und verbindet erst dann Socket.IO.
async function initLobby(state) {
    const {
        socket,
        sessionUsername
    } = state;

    //prüft, ob es zu dem Cookie mit der Session-ID eine gültige Session gibt
    const response = await fetch('/auth/me');
    if (!response.ok) { //keine gültige Session, Weiterleitung zur Login-Seite
        window.location.href = '/static/auth/index.html';
        return;
    }

    //speichert die Session-User-Daten und zeigt den Benutzernamen in der Lobby an
    const me = await response.json();
    state.me = me;
    sessionUsername.textContent = `${me.username} (#${me.playerId})`;
    socket.connect(); //verbindet den Socket
}

export { initLobby };
