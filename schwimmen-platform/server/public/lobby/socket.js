import { getPlayerId, setCurrentLobby, renderLobbyList } from './helpers.js';

//Funktion, die die Socket.IO Event-Handler für die Lobby-Seite registriert, damit der Client auf Nachrichten vom Server reagieren und entsprechend den Lobby-Status aktualisieren kann
function registerLobbySocketHandlers(state) {
    const { socket } = state;

    // Reconnect-Hinweis im UI anzeigen, solange keine Verbindung besteht
    socket.on('disconnect', () => {
        if (state.currentLobbyOutput) {
            state.currentLobbyOutput.textContent = 'Verbindung getrennt. Reconnect läuft ...';
        }
    });

    // Nach jedem erfolgreichen (Re-)Connect: Server-Instanz abfragen und in Konsole ausgeben
    socket.on('connect', async () => {
        // Reconnect-Hinweis im UI zurücksetzen
        if (state.currentLobbyOutput) {
            state.currentLobbyOutput.textContent = '';
        }
        try {
            const res = await fetch('/health');
            if (res.ok) {
                const info = await res.json();
                console.info(`[Lobby] Verbunden mit Server-Instanz: ${info.serverInstance}`);
            } else {
                console.warn('[Lobby] /health-Check fehlgeschlagen');
            }
        } catch (e) {
            console.warn('[Lobby] /health-Check Fehler:', e);
        }
    });

    //folgende Socket.IO Event-Handler(des Clients) warten auf Nachrichten vom Server und reagieren entsprechend 

    //wenn der Server die Liste der Lobbys zurückgibt, wird die renderLobbyList Funktion aufgerufen, um die Lobbys anzuzeigen
    socket.on('lobby-list', (data) => {
        renderLobbyList(state, data?.lobbies || []);
    });

    //wenn der Server eine aktualisierte Lobby zurückgibt (z.B. wenn Spieler beitreten oder die Lobby verlassen) 
    //, wird die aktuelle Lobby aktualisiert
    socket.on('lobby-updated', (lobby) => {
        const myPlayerId = getPlayerId(state);
        if (lobby?.playerIds?.includes(myPlayerId)) {
            setCurrentLobby(state, lobby);
        } else {
            setCurrentLobby(state, null);
        }
    });

    //wenn der Server zurückgibt, dass das Spiel in der Lobby gestartet wurde, wird der Client zur game.html weitergeleitet mit der gameId und playerId als Query-Parameter
    socket.on('lobby-game-started', (data) => {
        const playerId = getPlayerId(state);
        window.location.href = `/static/game/game.html?gameId=${encodeURIComponent(data.gameId)}&playerId=${encodeURIComponent(playerId)}`;
    });

    socket.on('game-error', (error) => {
        console.error('Serverfehler empfangen:', error);
    });
}

export { registerLobbySocketHandlers };
