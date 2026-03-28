const socket = io();

//holt die HTML-Elemente, die für die Interaktion mit der Seite benötigt werden
const createGameButton = document.getElementById('createGameButton');
const joinGameButton = document.getElementById('joinGameButton');
const player1Input = document.getElementById('player1');
const player2Input = document.getElementById('player2');
const joinGameIdInput = document.getElementById('joinGameId');
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

socket.on('connect', () => {
    setStatus('Socket verbunden.', { socketId: socket.id });
});

socket.on('disconnect', () => {
    setStatus('Socket getrennt.');
});

socket.on('game-created', (data) => {
    joinGameIdInput.value = data.gameId;
    setStatus('Spiel erstellt.', data);
});

socket.on('game-state', (state) => {
    setStatus('Spielstatus empfangen.');
    setGameState(state);
});

socket.on('game-error', (error) => {
    setStatus('Serverfehler empfangen.', error);
});