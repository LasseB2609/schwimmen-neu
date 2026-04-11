import { setStatus, getPlayerId, setCurrentLobby, renderLobbyList } from './helpers.js';

//Funktion, die die Socket.IO Event-Handler für die Lobby-Seite registriert, damit der Client auf Nachrichten vom Server reagieren und entsprechend den Lobby-Status aktualisieren kann
function registerLobbySocketHandlers(state) {
    const {
        socket,
        joinLobbyIdInput
    } = state;

    //folgende Socket.IO Event-Handler(des Clients) warten auf Nachrichten vom Server und reagieren entsprechend 

    //wenn der Server connected zurückgibt (also die Verbindung steht), wird die LobbyList angefordert
    socket.on('connect', () => {
        setStatus(state, 'Socket verbunden.', { socketId: socket.id });
        socket.emit('lobby-list-request');
    });

    //wenn der Server die Liste der Lobbys zurückgibt, wird die renderLobbyList Funktion aufgerufen, um die Lobbys anzuzeigen
    socket.on('lobby-list', (data) => {
        renderLobbyList(state, data?.lobbies || []);
    });

    //TODO: checken was das hier überhaupt genau macht?
    //wenn der Server eine aktualisierte Lobby zurückgibt (z.B. wenn Spieler beitreten oder die Lobby verlassen) 
    //, wird die aktuelle Lobby aktualisiert und der Status ausgegeben
    socket.on('lobby-updated', (lobby) => {
        const myPlayerId = getPlayerId(state);
        if (lobby?.playerIds?.includes(myPlayerId)) {
            setCurrentLobby(state, lobby);
            joinLobbyIdInput.value = lobby.lobbyId;
        }
        setStatus(state, 'Lobby aktualisiert.', lobby);
    });

    //wenn der Server zurückgibt, dass das Spiel in der Lobby gestartet wurde, wird der Client zur game.html weitergeleitet mit der gameId und playerId als Query-Parameter
    socket.on('lobby-game-started', (data) => {
        const playerId = getPlayerId(state);
        setStatus(state, 'Spiel wurde gestartet. Weiterleitung ...', data);
        window.location.href = `/static/game/game.html?gameId=${encodeURIComponent(data.gameId)}&playerId=${encodeURIComponent(playerId)}`;
    });

    //wenn der Server zurückgibt, dass die Lobby verlassen wurde, wird die der Status ausgegeben und die error Nachricht ausgegeben
    socket.on('game-error', (error) => {
        setStatus(state, 'Serverfehler empfangen.', error);
    });
}

export { registerLobbySocketHandlers };
