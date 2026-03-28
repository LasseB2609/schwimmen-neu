//in dieser Datei schickt der Client events an den Server und empfängt die Antworten

//stellt die Verbindung zum Socket.IO Server her
const socket = io();

//holt die HTML-Elemente, die für die Interaktion mit der Seite benötigt werden
const createGameButton = document.getElementById('createGameButton');
const joinGameButton = document.getElementById('joinGameButton');
const player1Input = document.getElementById('player1');
const player2Input = document.getElementById('player2');
const joinGameIdInput = document.getElementById('joinGameId');
const playCardButton = document.getElementById('playCardButton');
const playGameIdInput = document.getElementById('playGameId');
const playPlayerIdInput = document.getElementById('playPlayerId');
const playHandCardIdInput = document.getElementById('playHandCardId');
const playTableCardIndexInput = document.getElementById('playTableCardIndex');
const statusOutput = document.getElementById('statusOutput');
const stateOutput = document.getElementById('stateOutput');

//gibt den Status aus (zum debuggen)
function setStatus(message, payload) {
    statusOutput.textContent = payload
        ? `${message}\n\n${JSON.stringify(payload, null, 2)}`
        : message;
}

//gibt den aktuellen Spielstatus aus (zum debuggen)
function setGameState(state) {
    stateOutput.textContent = JSON.stringify(state, null, 2);
}

//bei buttonclick wird mit create-game und den eingetragenen Spieler-IDs versucht, ein neues Spiel zu erstellen
createGameButton.addEventListener('click', () => {
    const playerIds = [
        Number.parseInt(player1Input.value, 10),
        Number.parseInt(player2Input.value, 10)
    ].filter(Number.isInteger);

    setStatus('Sende create-game ...', { playerIds }); //gibt den Status aus, dass die create-game Nachricht gesendet wird
    socket.emit('create-game', { playerIds });
});

//bei buttonclick wird mit join-game und der eingetragenen gameId versucht, einem bestehenden Spiel beizutreten
joinGameButton.addEventListener('click', () => {
    const gameId = Number.parseInt(joinGameIdInput.value, 10);
    setStatus('Sende join-game ...', { gameId }); //gibt den Status aus, dass die join-game Nachricht gesendet wird
    socket.emit('join-game', { gameId });
});

//bei buttonclick wird mit play-card ein Spielzug an den Server gesendet
swapCardButton.addEventListener('click', () => {
    const gameId = Number.parseInt(playGameIdInput.value, 10);
    const playerId = Number.parseInt(playPlayerIdInput.value, 10);
    const handCardId = Number.parseInt(playHandCardIdInput.value, 10);
    const tableCardIndex = Number.parseInt(playTableCardIndexInput.value, 10);

    const payload = { gameId, playerId, handCardId, tableCardIndex };
    setStatus('Sende swap-card ...', payload);
    socket.emit('swap-card', payload);
});

//folgende Socket.IO Event-Listener werden eingerichtet, um auf Nachrichten vom Server zu reagieren:
//Client merkt, wenn die Verbindung zum Socket.IO Server hergestellt wurde, und gibt dies als Status aus
//TODO: zukünftig nicht für Status verwenden, sondern um Spielupdates durchzufürhren etc.
socket.on('connect', () => {
    setStatus('Socket verbunden.', { socketId: socket.id });
});

//Client merkt, wenn die Verbindung zum Socket.IO Server getrennt wurde, und gibt dies als Status aus
socket.on('disconnect', () => {
    setStatus('Socket getrennt.');
});

//Client empfängt die Nachricht, dass ein neues Spiel erstellt wurde, und gibt dies als Status aus
socket.on('game-created', (data) => {
    joinGameIdInput.value = data.gameId;
    playGameIdInput.value = data.gameId;
    setStatus('Spiel erstellt.', data);
});

//Client empfängt den aktuellen Spielstatus und gibt diesen als GameState aus
socket.on('game-state', (state) => {
    setStatus('Spielstatus empfangen.');
    setGameState(state);
});

//Client empfängt eine Fehlermeldung vom Server und gibt diese als Status aus
socket.on('game-error', (error) => {
    setStatus('Serverfehler empfangen.', error);
});