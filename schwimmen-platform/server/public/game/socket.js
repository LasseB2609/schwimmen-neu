import { clearSelection, renderBoard } from './helpers.js';

//Funktion, die die Socket.IO Event-Handler für die Spiel-Seite registriert, damit der Client auf Nachrichten vom Server reagieren und entsprechend den Spiel-Status aktualisieren kann
function registerGameSocketHandlers(state) {
    const { socket, queryGameId, joinGameIdEl, playGameIdEl } = state;

    //folgende Socket.IO Event-Handler(des Clients) warten auf Nachrichten vom Server und reagieren entsprechend
    socket.on('connect', () => {
        //wenn gameId über Query-Parameter übergeben wurde, direkt dem Spiel beitreten
        if (Number.isInteger(queryGameId)) {
            socket.emit('join-game', { gameId: queryGameId });
        }
    });

    socket.on('disconnect', () => {
        state.interactionLocked = true;
    });

    socket.on('game-created', (data) => {
        joinGameIdEl.value = data.gameId;
        playGameIdEl.value = data.gameId;
    });

    //Client empfängt den aktuellen Spielstatus
    socket.on('game-state', (gameState) => {
        state.interactionLocked = false;
        state.lastGameState = gameState; //speichert den letzten bekannten Spielstatus, damit bei Auswahländerungen ohne neues Server-Event gerendert werden kann
        renderBoard(state, gameState);
    });

    //Client empfängt die Nachricht, dass die Runde nach Klopfen beendet ist
    socket.on('round-ended', () => {
        state.interactionLocked = true;
        clearSelection(state);
        renderBoard(state, state.lastGameState);
    });

    //Client empfängt den Start einer neuen Runde
    socket.on('round-started', () => {
        state.interactionLocked = true;
        clearSelection(state);
        renderBoard(state, state.lastGameState);
    });

    //Client empfängt die Nachricht, dass das Spiel beendet ist
    socket.on('game-finished', () => {
        state.interactionLocked = true;
        clearSelection(state);
        renderBoard(state, state.lastGameState);
    });

    //Client empfängt eine Fehlermeldung vom Server
    socket.on('game-error', (error) => {
        console.error('Serverfehler empfangen:', error);
    });
}

export { registerGameSocketHandlers };
