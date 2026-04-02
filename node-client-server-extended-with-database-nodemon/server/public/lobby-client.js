//in dieser Datei schickt der Client events an den Server und empfängt die Antworten für die Lobby-Funktionalität 
// (Lobby erstellen, beitreten, Liste aktualisieren, Spiel starten, etc.)

//stellt die Verbindung zum Socket.IO Server her
const socket = io();

// holt die HTML-Elemente, die für die Interaktion mit der Seite benötigt werden
const playerIdInput = document.getElementById('playerIdInput');
const lobbyNameInput = document.getElementById('lobbyNameInput');
const createLobbyButton = document.getElementById('createLobbyButton');
const joinLobbyIdInput = document.getElementById('joinLobbyIdInput');
const joinLobbyButton = document.getElementById('joinLobbyButton');
const refreshLobbiesButton = document.getElementById('refreshLobbiesButton');
const lobbyList = document.getElementById('lobbyList');
const currentLobbyOutput = document.getElementById('currentLobbyOutput');
const startGameButton = document.getElementById('startGameButton');
const leaveLobbyButton = document.getElementById('leaveLobbyButton');
const statusOutput = document.getElementById('statusOutput');

let currentLobby = null;

//gibt den Status aus (zum debuggen)
function setStatus(message, payload) {
    statusOutput.textContent = payload
        ? `${message}\n\n${JSON.stringify(payload, null, 2)}`
        : message;
}

//Hilfsfunktion, um die playerId aus dem Input als Integer zu holen
function getPlayerId() {
    return Number.parseInt(playerIdInput.value, 10);
}

//setzt die aktuelle Lobby und gibt sie im currentLobbyOutput aus (zum debuggen)
function setCurrentLobby(lobby) {
    currentLobby = lobby || null;
    currentLobbyOutput.textContent = currentLobby
        ? JSON.stringify(currentLobby, null, 2)
        : 'Noch keiner Lobby beigetreten.';
}

//rendert die Liste der Lobbys, die übergeben wird
function renderLobbyList(lobbies) {
    lobbyList.innerHTML = ''; //leert die aktuelle Liste, bevor die neuen Lobbys hinzugefügt werden

    //wenn keine Lobbys vorhanden sind, passende Nachricht anzeigen
    if (!Array.isArray(lobbies) || lobbies.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'list-group-item text-muted'; //fügt eine Nachricht hinzu, wenn keine Lobbys vorhanden sind
        emptyItem.textContent = 'Keine offenen Lobbys vorhanden.';
        lobbyList.appendChild(emptyItem);
        return;
    }

    //iteriert durch die gegebenen Lobbys und erstellt für jede Lobby ein html-Element in der Liste mit den entsprechenden Informationen und einem Button zum Beitreten
    for (const lobby of lobbies) {
        const item = document.createElement('li');
        item.className = 'list-group-item d-flex justify-content-between align-items-center';

        //nennt die Lobby-Id, den Namen der Lobby, die Id des Hosts(todo: besser den Namen oder?) und die Anzahl der Spieler in der Lobby
        const text = document.createElement('span');
        text.textContent = `#${lobby.lobbyId} ${lobby.lobbyName} | Host: ${lobby.hostPlayerId} | Spieler: ${lobby.playerIds.length}`;

        //Button zum BEitreten der Lobby
        const button = document.createElement('button');
        button.className = 'btn btn-sm btn-outline-primary';
        button.textContent = 'Beitreten';
        button.addEventListener('click', () => { // beim klick
            const playerId = getPlayerId(); //holt die playerId aus dem Input-Feld
            socket.emit('lobby-join', { lobbyId: lobby.lobbyId, playerId }); //schickt die lobby-join Nachricht mit der lobbyId und playerId an den Server
        });

        //fügt die html-Elemente zusammen und hängt sie an die Liste der Lobbys an
        item.appendChild(text);
        item.appendChild(button);
        lobbyList.appendChild(item);
    }
}

//eventListener für den Knopf zur Lobbyerstlelung
createLobbyButton.addEventListener('click', () => {
    const playerId = getPlayerId(); //holt die playerId aus dem Input-Feld
    const lobbyName = String(lobbyNameInput.value || '').trim(); //holt den Namen der Lobby aus dem Input-Feld
    socket.emit('lobby-create', { playerId, lobbyName }); //schickt die lobby-create Nachricht mit der playerId und dem Lobby-Namen an den Server
    setStatus('Sende lobby-create ...', { playerId, lobbyName }); //gibt den Status aus, dass die lobby-create Nachricht gesendet wird (zum debuggen)
});

//eventlistener für den Knopf zum Beitreten einer Lobby
joinLobbyButton.addEventListener('click', () => {
    const playerId = getPlayerId(); //holt die playerId aus dem Input-Feld
    const lobbyId = String(joinLobbyIdInput.value || ''); //holt die lobbyId aus dem Input-Feld, in die der Spieler beitreten möchte
    socket.emit('lobby-join', { lobbyId, playerId }); //schickt die lobby-join Nachricht mit der lobbyId und playerId an den Server
    setStatus('Sende lobby-join ...', { lobbyId, playerId }); //gibt den Status aus, dass die lobby-join Nachricht gesendet wird (zum debuggen)
});

//eventlistener für den Knopf zum Aktualisieren der Lobby-Liste
refreshLobbiesButton.addEventListener('click', () => {
    socket.emit('lobby-list-request'); //schickt die lobby-list-request Nachricht an den Server
    setStatus('Sende lobby-list-request ...'); //gibt den Status aus, dass die lobby-list-request Nachricht gesendet wird (zum debuggen)
});

//eventlistener für den Knopf zum Starten des Spiels in der Lobby
startGameButton.addEventListener('click', () => {
    if (!currentLobby) { //falls keine aktuelle Lobby ausgewählt ist, wird eine Fehlermeldung ausgegeben und die Funktion verlassen
        setStatus('Keine aktive Lobby ausgewählt.');
        return;
    }
    const playerId = getPlayerId(); //holt die playerId aus dem Input-Feld
    socket.emit('lobby-start-game', { lobbyId: currentLobby.lobbyId, playerId }); //schickt die lobby-start-game Nachricht mit der lobbyId und playerId an den Server
    setStatus('Sende lobby-start-game ...', { lobbyId: currentLobby.lobbyId, playerId }); //gibt den Status aus, dass die lobby-start-game Nachricht gesendet wird (zum debuggen)
});

//eventlistener für den Knopf zum Verlassen der Lobby
leaveLobbyButton.addEventListener('click', () => {
    if (!currentLobby) { //falls keine aktuelle Lobby ausgewählt ist, wird die Funktion verlassen
        return;
    }
    const playerId = getPlayerId(); //holt die playerId aus dem Input-Feld
    socket.emit('lobby-leave', { lobbyId: currentLobby.lobbyId, playerId }); //schickt die lobby-leave Nachricht mit der lobbyId und playerId an den Server
    setStatus('Sende lobby-leave ...', { lobbyId: currentLobby.lobbyId, playerId }); //gibt den Status aus, dass die lobby-leave Nachricht gesendet wird (zum debuggen)
    setCurrentLobby(null);
});


//folgende Socket.IO Event-Handler(des Clients) warten auf Nachrichten vom Server und reagieren entsprechend 

//wenn der Server connected zurückgibt (also die Verbindung steht), wird die LobbyList angefordert
socket.on('connect', () => {
    setStatus('Socket verbunden.', { socketId: socket.id });
    socket.emit('lobby-list-request');
});

//wenn der Server die Liste der Lobbys zurückgibt, wird die renderLobbyList Funktion aufgerufen, um die Lobbys anzuzeigen
socket.on('lobby-list', (data) => {
    renderLobbyList(data?.lobbies || []);
});

//TODO: checken was das hier überhaupt genau macht?
//wenn der Server eine aktualisierte Lobby zurückgibt (z.B. wenn Spieler beitreten oder die Lobby verlassen) 
//, wird die aktuelle Lobby aktualisiert und der Status ausgegeben
socket.on('lobby-updated', (lobby) => {
    const myPlayerId = getPlayerId();
    if (lobby?.playerIds?.includes(myPlayerId)) {
        setCurrentLobby(lobby);
        joinLobbyIdInput.value = lobby.lobbyId;
    }
    setStatus('Lobby aktualisiert.', lobby);
});

//wenn der Server zurückgibt, dass das Spiel in der Lobby gestartet wurde, wird der Client zur game.html weitergeleitet mit der gameId und playerId als Query-Parameter
socket.on('lobby-game-started', (data) => {
    const playerId = getPlayerId();
    setStatus('Spiel wurde gestartet. Weiterleitung ...', data);
    window.location.href = `game.html?gameId=${encodeURIComponent(data.gameId)}&playerId=${encodeURIComponent(playerId)}`;
});

//wenn der Server zurückgibt, dass die Lobby verlassen wurde, wird die der Status ausgegeben und die error Nachricht ausgegeben
socket.on('game-error', (error) => {
    setStatus('Serverfehler empfangen.', error);
});
