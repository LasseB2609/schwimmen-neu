//stellt die Verbindung zum Socket.IO Server her (aber verbindet erst später, wenn die Session-Daten geladen wurden)
const socket = io({ autoConnect: false });

// holt die HTML-Elemente, die für die Interaktion mit der Seite benötigt werden
const lobbyNameInput = document.getElementById('lobbyNameInput');
const createLobbyButton = document.getElementById('createLobbyButton');
const joinLobbyIdInput = document.getElementById('joinLobbyIdInput');
const joinLobbyButton = document.getElementById('joinLobbyButton');
const refreshLobbiesButton = document.getElementById('refreshLobbiesButton');
const lobbyList = document.getElementById('lobbyList');
const currentLobbyOutput = document.getElementById('currentLobbyOutput');
const startGameButton = document.getElementById('startGameButton');
const leaveLobbyButton = document.getElementById('leaveLobbyButton');
const logoutButton = document.getElementById('logoutButton');
const sessionUsername = document.getElementById('sessionUsername');

function getState() {
    return {
        socket,
        lobbyNameInput,
        createLobbyButton,
        joinLobbyIdInput,
        joinLobbyButton,
        refreshLobbiesButton,
        lobbyList,
        currentLobbyOutput,
        startGameButton,
        leaveLobbyButton,
        logoutButton,
        sessionUsername,
        currentLobby: null,
        me: null //speichert die Session-User-Daten
    };
}

export { getState };
