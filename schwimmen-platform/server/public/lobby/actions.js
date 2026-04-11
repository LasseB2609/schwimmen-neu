import { setStatus, setCurrentLobby } from './helpers.js';

//Funktion, die die Event-Listener für die Buttons und andere interaktive Elemente auf der Lobby-Seite registriert, 
// damit bei Interaktionen die entsprechenden Nachrichten an den Server gesendet werden
function registerLobbyActions(state) {
    const {
        socket,
        lobbyNameInput,
        createLobbyButton,
        joinLobbyIdInput,
        joinLobbyButton,
        refreshLobbiesButton,
        startGameButton,
        leaveLobbyButton,
        logoutButton
    } = state;

    //eventListener für den Knopf zur Lobbyerstlelung
    createLobbyButton.addEventListener('click', () => {
        const lobbyName = String(lobbyNameInput.value || '').trim(); //holt den Namen der Lobby aus dem Input-Feld
        socket.emit('lobby-create', { lobbyName }); //schickt die lobby-create Nachricht mit dem Lobby-Namen an den Server
        setStatus(state, 'Sende lobby-create ...', { lobbyName }); //gibt den Status aus, dass die lobby-create Nachricht gesendet wird (zum debuggen)
    });

    //eventlistener für den Knopf zum Beitreten einer Lobby
    joinLobbyButton.addEventListener('click', () => {
        const lobbyId = String(joinLobbyIdInput.value || ''); //holt die lobbyId aus dem Input-Feld, in die der Spieler beitreten möchte
        socket.emit('lobby-join', { lobbyId }); //schickt die lobby-join Nachricht mit der lobbyId an den Server
        setStatus(state, 'Sende lobby-join ...', { lobbyId }); //gibt den Status aus, dass die lobby-join Nachricht gesendet wird (zum debuggen)
    });

    //eventlistener für den Knopf zum Aktualisieren der Lobby-Liste
    refreshLobbiesButton.addEventListener('click', () => {
        socket.emit('lobby-list-request'); //schickt die lobby-list-request Nachricht an den Server
        setStatus(state, 'Sende lobby-list-request ...'); //gibt den Status aus, dass die lobby-list-request Nachricht gesendet wird (zum debuggen)
    });

    //eventlistener für den Knopf zum Starten des Spiels in der Lobby
    startGameButton.addEventListener('click', () => {
        if (!state.currentLobby) { //falls keine aktuelle Lobby ausgewählt ist, wird eine Fehlermeldung ausgegeben und die Funktion verlassen
            setStatus(state, 'Keine aktive Lobby ausgewählt.');
            return;
        }
        socket.emit('lobby-start-game', { lobbyId: state.currentLobby.lobbyId }); //schickt die lobby-start-game Nachricht mit der lobbyId an den Server
        setStatus(state, 'Sende lobby-start-game ...', { lobbyId: state.currentLobby.lobbyId }); //gibt den Status aus, dass die lobby-start-game Nachricht gesendet wird (zum debuggen)
    });

    //eventlistener für den Knopf zum Verlassen der Lobby
    leaveLobbyButton.addEventListener('click', () => {
        if (!state.currentLobby) { //falls keine aktuelle Lobby ausgewählt ist, wird die Funktion verlassen
            return;
        }
        socket.emit('lobby-leave', { lobbyId: state.currentLobby.lobbyId }); //schickt die lobby-leave Nachricht mit der lobbyId an den Server
        setStatus(state, 'Sende lobby-leave ...', { lobbyId: state.currentLobby.lobbyId }); //gibt den Status aus, dass die lobby-leave Nachricht gesendet wird (zum debuggen)
        setCurrentLobby(state, null);
    });

    //eventlistener für den Logout-Knopf
    logoutButton.addEventListener('click', async () => {
        await fetch('/auth/logout', { method: 'POST' });
        window.location.href = '/static/auth/index.html'; //Weiterleitung an index.html
    });
}

export { registerLobbyActions };
