import { setCurrentLobby } from './helpers.js';

//Funktion, die die Event-Listener für die Buttons und andere interaktive Elemente auf der Lobby-Seite registriert, 
// damit bei Interaktionen die entsprechenden Nachrichten an den Server gesendet werden
function registerLobbyActions(state) {
    const {
        socket,
        lobbyNameInput,
        createLobbyButton,
        startGameButton,
        leaveLobbyButton,
        logoutButton
    } = state;

    //eventListener für den Knopf zur Lobbyerstlelung
    createLobbyButton.addEventListener('click', () => {
        const lobbyName = String(lobbyNameInput.value || '').trim(); //holt den Namen der Lobby aus dem Input-Feld
        socket.emit('lobby-create', { lobbyName }); //schickt die lobby-create Nachricht mit dem Lobby-Namen an den Server
    });

    //eventlistener für den Knopf zum Starten des Spiels in der Lobby
    startGameButton.addEventListener('click', () => {
        if (!state.currentLobby) { //falls keine aktuelle Lobby ausgewählt ist, wird die Funktion verlassen
            return;
        }
        socket.emit('lobby-start-game', { lobbyId: state.currentLobby.lobbyId }); //schickt die lobby-start-game Nachricht mit der lobbyId an den Server
    });

    //eventlistener für den Knopf zum Verlassen der Lobby
    leaveLobbyButton.addEventListener('click', () => {
        if (!state.currentLobby) { //falls keine aktuelle Lobby ausgewählt ist, wird die Funktion verlassen
            return;
        }
        socket.emit('lobby-leave', { lobbyId: state.currentLobby.lobbyId }); //schickt die lobby-leave Nachricht mit der lobbyId an den Server
        setCurrentLobby(state, null);
    });

    //eventlistener für den Logout-Knopf
    logoutButton.addEventListener('click', async () => {
        // Falls in einer Lobby: erst verlassen
        if (state.currentLobby) {
            socket.emit('lobby-leave', { lobbyId: state.currentLobby.lobbyId });
            setCurrentLobby(state, null);
        }
        await fetch('/auth/logout', { method: 'POST' });
        window.location.href = '/static/auth/index.html'; //Weiterleitung an index.html
    });
}

export { registerLobbyActions };
