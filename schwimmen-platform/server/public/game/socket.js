import { clearSelection, renderBoard } from './helpers.js';
import {
    showEventMessage,
    stopRoundEndCountdown,
    startRoundEndCountdown,
    getWinnerText,
    startGameFinishRedirect
} from './game-notifications.js';

//Funktion, die die Socket.IO Event-Handler für die Spiel-Seite registriert, damit der Client auf Nachrichten vom Server reagieren und entsprechend den Spiel-Status aktualisieren kann
function registerGameSocketHandlers(state) {
    const { socket, queryGameId } = state;

    //folgende Socket.IO Event-Handler(des Clients) warten auf Nachrichten vom Server und reagieren entsprechend
    socket.on('connect', () => {
        //wenn gameId über Query-Parameter übergeben wurde, direkt dem Spiel beitreten
        if (Number.isInteger(queryGameId)) {
            socket.emit('join-game', { gameId: queryGameId });
        }
    });

    //Todo: autoreconnect oder sowas (vermutlich interactionlocked wieder raus)
    socket.on('disconnect', () => {
        state.interactionLocked = true;
        showEventMessage(state, 'Verbindung getrennt. Reconnect läuft ...', 0);
    });

    //Client empfängt den aktuellen Spielstatus und rendert das Spielbrett entsprechend
    socket.on('game-state', (gameState) => {
        state.interactionLocked = false;
        state.lastGameState = gameState; //speichert den letzten bekannten Spielstatus, damit bei Auswahländerungen ohne neues Server-Event gerendert werden kann
        renderBoard(state, gameState);
    });

    //Client empfängt Nachricht, dass eine Spielaktion durchgeführt wurde und zeigt eine entsprechende Benachrichtigung an
    socket.on('game-action', (data) => {
        const actionType = data?.type;
        const username = data?.username || `Player ${data?.playerId ?? '?'}`;

        if (actionType === 'knock') {
            showEventMessage(state, `${username} hat geklopft.`);
            return;
        }

        if (actionType === 'pass') {
            showEventMessage(state, `${username} hat gepasst.`);
            return;
        }

        if (actionType === 'swap-card') {
            showEventMessage(state, `${username} hat eine Karte getauscht.`);
            return;
        }

        if (actionType === 'swap-all-cards') {
            showEventMessage(state, `${username} hat alle Karten getauscht.`);
        }
    });

    //Client empfängt die Nachricht, dass die Runde nach Klopfen beendet ist
    socket.on('round-ended', (data) => {
        state.interactionLocked = true;
        clearSelection(state);
        renderBoard(state, state.lastGameState);
        startRoundEndCountdown(state, data?.nextRoundStartsInMs);
    });

    //Client empfängt den Start einer neuen Runde
    socket.on('round-started', () => {
        state.interactionLocked = true;
        clearSelection(state);
        stopRoundEndCountdown(state);
        renderBoard(state, state.lastGameState);
    });

    //Client empfängt die Nachricht, dass das Spiel beendet ist
    socket.on('game-finished', (data) => {
        state.interactionLocked = true;
        clearSelection(state);
        stopRoundEndCountdown(state);
        renderBoard(state, state.lastGameState);

        //zeigt eine Nachricht an, welche Spieler gewonnen haben und leitet nach einer kurzen Verzögerung zurück zur Lobby weiter
        const winnerPlayerIds = Array.isArray(data?.winnerPlayerIds) ? data.winnerPlayerIds : [];
        const winnerText = getWinnerText(state.lastGameState, winnerPlayerIds);
        startGameFinishRedirect(state, winnerText);
    });

    //Client empfängt eine Fehlermeldung vom Server
    socket.on('game-error', (error) => {
        console.error('Serverfehler empfangen:', error);
    });
}

export { registerGameSocketHandlers };
