import { setStatus, setGameState, clearSelection, renderBoard } from './helpers.js';

//Funktion, die die Socket.IO Event-Handler für die Spiel-Seite registriert, damit der Client auf Nachrichten vom Server reagieren und entsprechend den Spiel-Status aktualisieren kann
function registerGameSocketHandlers(state) {
    const { socket, queryGameId, joinGameIdEl, playGameIdEl } = state;

    //folgende Socket.IO Event-Handler(des Clients) warten auf Nachrichten vom Server und reagieren entsprechend
    //Client merkt, wenn die Verbindung zum Socket.IO Server hergestellt wurde und gibt dies als Status aus
    //TODO: zukünftig nicht für Status verwenden, sondern um Spielupdates durchzuführhen etc.
    socket.on('connect', () => {
        setStatus(state, 'Socket verbunden.', { socketId: socket.id });

        //wenn gameId über Query-Parameter übergeben wurde, direkt dem Spiel beitreten
        if (Number.isInteger(queryGameId)) {
            socket.emit('join-game', { gameId: queryGameId });
        }
    });

    //Client merkt, wenn die Verbindung zum Socket.IO Server getrennt wurde, und gibt dies als Status aus
    socket.on('disconnect', () => {
        setStatus(state, 'Socket getrennt.');
    });

    //Client empfängt die Nachricht, dass ein neues Spiel erstellt wurde, und gibt dies als Status aus
    socket.on('game-created', (data) => {
        joinGameIdEl.value = data.gameId;
        playGameIdEl.value = data.gameId;
        setStatus(state, 'Spiel erstellt.', data);
    });

    //Client empfängt den aktuellen Spielstatus und gibt diesen als GameState aus
    socket.on('game-state', (gameState) => {
        state.interactionLocked = false;
        state.lastGameState = gameState; //speichert den letzten bekannten Spielstatus, damit bei Auswahländerungen ohne neues Server-Event gerendert werden kann
        setStatus(state, 'Spielstatus empfangen.');
        setGameState(state, gameState);
        renderBoard(state, gameState);
    });

    //Client empfängt die Nachricht, dass die Runde nach Klopfen beendet ist
    socket.on('round-ended', (data) => {
        state.interactionLocked = true;
        clearSelection(state);
        setStatus(state, 'Runde beendet.', data);
        renderBoard(state, state.lastGameState);
    });

    //Client empfängt den Start einer neuen Runde
    socket.on('round-started', (data) => {
        state.interactionLocked = true;
        clearSelection(state);
        setStatus(state, 'Neue Runde gestartet.', data);
        renderBoard(state, state.lastGameState);
    });

    //Client empfängt die Nachricht, dass das Spiel beendet ist
    socket.on('game-finished', (data) => {
        state.interactionLocked = true;
        clearSelection(state);
        setStatus(state, 'Spiel beendet.', data);
        renderBoard(state, state.lastGameState);
    });

    //Client empfängt eine Fehlermeldung vom Server und gibt diese als Status aus
    socket.on('game-error', (error) => {
        setStatus(state, 'Serverfehler empfangen.', error);
    });
}

export { registerGameSocketHandlers };
