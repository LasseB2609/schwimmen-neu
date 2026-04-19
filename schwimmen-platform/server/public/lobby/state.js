//stellt die Verbindung zum Socket.IO Server her (aber verbindet erst später, wenn die Session-Daten geladen wurden)
// Socket.IO-Client mit schnellen Reconnect-Intervallen konfigurieren
const socket = io({
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 500,      // 0.5s bis erster Versuch
    reconnectionDelayMax: 2000,  // max. 2s zwischen Versuchen
    timeout: 3000                // 3s Timeout für Verbindungsaufbau
});

// holt die HTML-Elemente, die für die Interaktion mit der Seite benötigt werden
const lobbyNameInput = document.getElementById('lobbyNameInput');
const createLobbyButton = document.getElementById('createLobbyButton');
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
