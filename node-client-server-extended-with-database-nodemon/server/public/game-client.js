//in dieser Datei schickt der Client events an den Server und empfängt die Antworten 
//für die Spiel-Funktionalität (Spiel erstellen, beitreten, Karte tauschen, etc.)

//stellt die Verbindung zum Socket.IO Server her
const socket = io();

//holt die HTML-Elemente, die für die Interaktion mit der Seite benötigt werden
const createGameButton = document.getElementById('createGameButton');
const joinGameButton = document.getElementById('joinGameButton');
const player1Input = document.getElementById('player1');
const player2Input = document.getElementById('player2');
const joinGameIdInput = document.getElementById('joinGameId');
const swapCardButton = document.getElementById('swapCardButton');
const knockButton = document.getElementById('knockButton');
const passButton = document.getElementById('passButton');
const playGameIdInput = document.getElementById('playGameId');
const playPlayerIdInput = document.getElementById('playPlayerId');
const playHandCardIdInput = document.getElementById('playHandCardId');
const playTableCardIndexInput = document.getElementById('playTableCardIndex');
const statusOutput = document.getElementById('statusOutput');
const stateOutput = document.getElementById('stateOutput');

const pageParams = new URLSearchParams(window.location.search); //holt die Parameter aus der URL
const queryGameId = Number.parseInt(pageParams.get('gameId'), 10); //holt die gameId aus der URL
const queryPlayerId = Number.parseInt(pageParams.get('playerId'), 10); //holt die playerId aus der URL

//wenn gameId oder playerId als Query-Parameter übergeben wurden, werden diese direkt in die entsprechenden Input-Felder eingetragen
if (Number.isInteger(queryGameId)) {
    joinGameIdInput.value = queryGameId;
    playGameIdInput.value = queryGameId;
}
if (Number.isInteger(queryPlayerId)) {
    playPlayerIdInput.value = queryPlayerId;
}

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

//bei buttonclick wird mit knock signalisiert, dass in dieser Runde jeder weiterer Spieler nur noch einen Zug machen darf
knockButton.addEventListener('click', () => {
    const gameId = Number.parseInt(playGameIdInput.value, 10); //holt die gameId aus dem Input-Feld
    const playerId = Number.parseInt(playPlayerIdInput.value, 10); //holt die playerId aus dem Input-Feld

    const payload = { gameId, playerId }; //speichert die gameId und playerId
    setStatus('Sende knock ...', payload); //setzt den Status, dass die knock Nachricht gesendet wird
    socket.emit('knock', payload); //sendet die knock Nachricht an den Server mit der gameId und playerId als Payload
});

//bei buttonclick wird pass gesendet (Zug aussetzen)
passButton.addEventListener('click', () => {
    const gameId = Number.parseInt(playGameIdInput.value, 10);
    const playerId = Number.parseInt(playPlayerIdInput.value, 10);

    const payload = { gameId, playerId };
    setStatus('Sende pass ...', payload);
    socket.emit('pass', payload);
});

//folgende Socket.IO Event-Listener werden eingerichtet, um auf Nachrichten vom Server zu reagieren:
//Client merkt, wenn die Verbindung zum Socket.IO Server hergestellt wurde, und gibt dies als Status aus
//TODO: zukünftig nicht für Status verwenden, sondern um Spielupdates durchzufürhren etc.
socket.on('connect', () => {
    setStatus('Socket verbunden.', { socketId: socket.id });

    //wenn gameId über Query-Parameter übergeben wurde, direkt dem Spiel beitreten
    if (Number.isInteger(queryGameId)) {
        socket.emit('join-game', { gameId: queryGameId });
    }
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

//Client empfängt die Nachricht, dass die Runde nach Klopfen beendet ist
socket.on('round-ended', (data) => {
    setStatus('Runde beendet.', data);
});

//Client empfängt eine Fehlermeldung vom Server und gibt diese als Status aus
socket.on('game-error', (error) => {
    setStatus('Serverfehler empfangen.', error);
});