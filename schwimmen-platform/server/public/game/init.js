//Datei, die die Initialisierunglogik für die Spiel-Seite enthält

//Lädt die Session und setzt den eigenen Player für die Spiellogik.
async function loadSessionUser(state) {
    //prüft, ob es zu dem Cookie mit der Session-ID eine gültige Session gibt
    const response = await fetch('/auth/me');
    if (!response.ok) { //keine gültige Session, Weiterleitung zur Login-Seite
        window.location.href = '/static/auth/index.html';
        return null;
    }

    //speichert die Session-User-Daten
    const me = await response.json();
    state.myPlayerId = me.playerId;

    return me;
}

//lädt die Session des Users und verbindet danach den Socket.
async function initGame(state) {
    const me = await loadSessionUser(state);
    if (!me) {
        return;
    }
    state.socket.connect();
}

export { initGame };
