import { setStatus } from './helpers.js';

//Datei, die die Initialisierunglogik für die Spiel-Seite enthält

//Lädt die Session und setzt den eigenen Player für die Spiellogik.
async function loadSessionUser(state) {
    //prüft, ob es zu dem Cookie mit der Session-ID eine gültige Session gibt
    const response = await fetch('/auth/me');
    if (!response.ok) { //keine gültige Session, Weiterleitung zur Login-Seite
        window.location.href = '/static/auth/index.html';
        return null;
    }

    //speichert die Session-User-Daten und trägt die playerId in das entsprechende Input-Feld ein
    const me = await response.json();
    state.clientPlayerIdEl.value = String(me.playerId);

    //Debug-Hinweis, falls query-Player nicht zur Session passt.
    if (Number.isInteger(state.queryPlayerId) && state.queryPlayerId !== me.playerId) {
        setStatus(state, 'Hinweis: Query-Player wird ignoriert, Session-Player wird verwendet.', {
            queryPlayerId: state.queryPlayerId,
            sessionPlayerId: me.playerId
        });
    }

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
