//in dieser Datei schickt der Client events an den Server und empfängt die Antworten 
//für die Spiel-Funktionalität (Spiel erstellen, beitreten, Karte tauschen, etc.)
//Einfacher Spiel-Client mit Kartenbrett-Rendering.
//Die IDs aus der bisherigen Test-UI bleiben erhalten, damit bestehende Flows nicht brechen.

//stellt die Verbindung zum Socket.IO Server her
const socket = io();

//holt die HTML-Elemente, die für die Interaktion mit der Seite benötigt werden
const createGameButton = document.getElementById('createGameButton');
const joinGameButton = document.getElementById('joinGameButton');
const player1Input = document.getElementById('player1');
const player2Input = document.getElementById('player2');
const joinGameIdInput = document.getElementById('joinGameId');
const swapCardButton = document.getElementById('swapCardButton');
const swapAllButton = document.getElementById('swapAllButton');
const knockButton = document.getElementById('knockButton');
const passButton = document.getElementById('passButton');
const playGameIdInput = document.getElementById('playGameId');
const playPlayerIdInput = document.getElementById('playPlayerId');
const playHandCardIdInput = document.getElementById('playHandCardId');
const playTableCardIndexInput = document.getElementById('playTableCardIndex');
const statusOutput = document.getElementById('statusOutput');
const stateOutput = document.getElementById('stateOutput');

//html Elemente für Spielinformationen
const roundValue = document.getElementById('roundValue');
const turnInfo = document.getElementById('turnInfo');
const myScoreValue = document.getElementById('myScoreValue');
const ownPlayerLabel = document.getElementById('ownPlayerLabel');

//html Elemente für die eigenen Karten, die Karten auf dem Tisch und den Ablagestapel
const ownCardsContainer = document.getElementById('ownCardsContainer');
const tableCardsContainer = document.getElementById('tableCardsContainer');
const deckPile = document.getElementById('deckPile');

//html Elemente für die Karten und Informationen der Gegner
const opponentTopLabel = document.getElementById('opponentTopLabel');
const opponentLeftLabel = document.getElementById('opponentLeftLabel');
const opponentRightLabel = document.getElementById('opponentRightLabel');
const opponentTopCards = document.getElementById('opponentTopCards');
const opponentLeftCards = document.getElementById('opponentLeftCards');
const opponentRightCards = document.getElementById('opponentRightCards');

let selectedHandCardId = null;
let selectedTableCardIndex = null;
let lastGameState = null;

const pageParams = new URLSearchParams(window.location.search); //holt die Parameter aus der URL
const queryGameId = Number.parseInt(pageParams.get('gameId'), 10); //holt die gameId aus den Parametern
const queryPlayerId = Number.parseInt(pageParams.get('playerId'), 10); //holt die playerId aus den parametern

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

//Hilfsfunktion, um einen Wert aus dem Input als Integer zu holen
function toInt(value) {
    return Number.parseInt(value, 10);
}

//TODO: Ab hier muss noch kommentiert werden
function cardToText(card) {
    if (!card) {
        return '-';
    }

    const rankMap = {
        A: 'Ass',
        K: 'Koenig',
        Q: 'Dame',
        J: 'Bube'
    };
    const suitMap = {
        Herz: 'Herz',
        Karo: 'Karo',
        Kreuz: 'Kreuz',
        Pik: 'Pik'
    };

    const rankLabel = rankMap[card.rank] || String(card.rank || '?');
    const suitLabel = suitMap[card.suit] || String(card.suit || '?');
    return `${rankLabel} ${suitLabel}`;
}

function createCardElement(text, options = {}) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'game-card';
    if (options.isBack) {
        element.classList.add('back');
    }
    if (options.clickable) {
        element.classList.add('clickable');
    } else {
        element.disabled = true;
    }
    if (options.selected) {
        element.classList.add('selected');
    }
    element.textContent = text;
    if (typeof options.onClick === 'function') {
        element.addEventListener('click', options.onClick);
    }
    return element;
}

function renderOpponent(labelEl, cardsEl, player, revealCards) {
    cardsEl.innerHTML = '';

    if (!player) {
        labelEl.textContent = 'Frei';
        return;
    }

    const scoreText = revealCards ? (player.score ?? '-') : '?';
    labelEl.textContent = `${player.username || `Player ${player.player_id}`} | Leben: ${player.lives} | Score: ${scoreText}`;

    const hand = Array.isArray(player.hand) ? player.hand : [];
    for (const card of hand) {
        cardsEl.appendChild(createCardElement(revealCards ? cardToText(card) : 'Verdeckt', { isBack: !revealCards }));
    }
}

function getCircularOpponents(players, myIndex) {
    if (!Array.isArray(players) || players.length === 0 || myIndex < 0) {
        return [];
    }

    const result = [];
    for (let offset = 1; offset < players.length; offset += 1) {
        const idx = (myIndex + offset) % players.length;
        result.push(players[idx]);
    }
    return result;
}

function renderBoard(state) {
    if (!state) {
        return;
    }

    const players = Array.isArray(state.players) ? state.players : [];
    const myPlayerId = toInt(playPlayerIdInput.value);
    const myIndex = players.findIndex((player) => player.player_id === myPlayerId);
    const myPlayer = myIndex >= 0 ? players[myIndex] : null;
    const opponents = getCircularOpponents(players, myIndex);
    const revealOthers = Boolean(state.roundEnded || state.status === 'finished' || state.lastRoundSummary);

    roundValue.textContent = state.currentRound ?? '-';
    myScoreValue.textContent = myPlayer ? (myPlayer.score ?? '-') : '-';
    ownPlayerLabel.textContent = myPlayer
        ? `${myPlayer.username || `Player ${myPlayer.player_id}`} | Leben: ${myPlayer.lives}`
        : 'Deine Karten';

    if (Number.isInteger(state.currentPlayerIndex) && players[state.currentPlayerIndex]) {
        const currentPlayer = players[state.currentPlayerIndex];
        turnInfo.textContent = `Am Zug: ${currentPlayer.username || `Player ${currentPlayer.player_id}`}`;
    } else {
        turnInfo.textContent = 'Warte auf Spielstatus ...';
    }

    renderOpponent(opponentTopLabel, opponentTopCards, opponents[0], revealOthers);
    renderOpponent(opponentLeftLabel, opponentLeftCards, opponents[1], revealOthers);
    renderOpponent(opponentRightLabel, opponentRightCards, opponents[2], revealOthers);

    ownCardsContainer.innerHTML = '';
    const myHand = Array.isArray(myPlayer?.hand) ? myPlayer.hand : [];
    for (const card of myHand) {
        const isSelected = selectedHandCardId === card.card_id;
        ownCardsContainer.appendChild(createCardElement(cardToText(card), {
            clickable: true,
            selected: isSelected,
            onClick: () => {
                selectedHandCardId = card.card_id;
                playHandCardIdInput.value = String(card.card_id);
                renderBoard(lastGameState);
            }
        }));
    }

    tableCardsContainer.innerHTML = '';
    const tableCards = Array.isArray(state.tableCards) ? state.tableCards : [];
    tableCards.forEach((card, index) => {
        const isSelected = selectedTableCardIndex === index;
        tableCardsContainer.appendChild(createCardElement(cardToText(card), {
            clickable: true,
            selected: isSelected,
            onClick: () => {
                selectedTableCardIndex = index;
                playTableCardIndexInput.value = String(index);
                renderBoard(lastGameState);
            }
        }));
    });

    deckPile.textContent = 'Deck';
}

//bei buttonclick wird mit create-game und den eingetragenen playerIds versucht, ein neues Spiel zu erstellen
createGameButton.addEventListener('click', () => {
    const playerIds = [toInt(player1Input.value), toInt(player2Input.value)].filter(Number.isInteger);
    const payload = { playerIds };
    setStatus('Sende create-game ...', payload);
    socket.emit('create-game', payload);
});

//bei buttonclick wird mit join-game und der eingetragenen gameId versucht, einem bestehenden Spiel beizutreten
joinGameButton.addEventListener('click', () => {
    const gameId = toInt(joinGameIdInput.value);
    const payload = { gameId };
    setStatus('Sende join-game ...', payload);
    socket.emit('join-game', payload);
});

//bei buttonclick wird mit swap-card und den ausgewählten Karten versucht, eine Karte zu tauschen
swapCardButton.addEventListener('click', () => {
    const gameId = toInt(playGameIdInput.value);
    const playerId = toInt(playPlayerIdInput.value);

    if (!Number.isInteger(selectedHandCardId) || !Number.isInteger(selectedTableCardIndex)) {
        setStatus('Bitte zuerst eine eigene Karte und eine Tischkarte auswählen.');
        return;
    }

    const payload = {
        gameId,
        playerId,
        handCardId: selectedHandCardId,
        tableCardIndex: selectedTableCardIndex
    };

    setStatus('Sende swap-card ...', payload);
    socket.emit('swap-card', payload);
});

//todo: swapAllButton anbinden
swapAllButton.addEventListener('click', () => {
    setStatus('Alle Karten tauschen ist als UI vorbereitet, aber serverseitig noch nicht als Socket-Event verbunden.');
});

//bei buttonclick wird mit knock signalisiert, dass in dieser Runde jeder weiterer Spieler nur noch einen Zug machen darf
knockButton.addEventListener('click', () => {
    const payload = { gameId: toInt(playGameIdInput.value), playerId: toInt(playPlayerIdInput.value) };
    setStatus('Sende knock ...', payload);
    socket.emit('knock', payload);
});

//bei buttonclick wird mit pass signalisiert, dass der Spieler passen möchte
passButton.addEventListener('click', () => {
    const payload = { gameId: toInt(playGameIdInput.value), playerId: toInt(playPlayerIdInput.value) };
    setStatus('Sende pass ...', payload);
    socket.emit('pass', payload);
});

//folgende Socket.IO Event-Handler(des Clients) warten auf Nachrichten vom Server und reagieren entsprechend
//Client merkt, wenn die Verbindung zum Socket.IO Server hergestellt wurde und gibt dies als Status aus
//TODO: zukünftig nicht für Status verwenden, sondern um Spielupdates durchzuführhen etc.
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
    renderBoard(state);
});

//Client empfängt die Nachricht, dass die Runde nach Klopfen beendet ist
socket.on('round-ended', (data) => {
    setStatus('Runde beendet.', data);
});

//Client empfängt den Start einer neuen Runde
socket.on('round-started', (data) => {
    setStatus('Neue Runde gestartet.', data);
});

//Client empfängt die Nachricht, dass das Spiel beendet ist
socket.on('game-finished', (data) => {
    setStatus('Spiel beendet.', data);
});

//Client empfängt eine Fehlermeldung vom Server und gibt diese als Status aus
socket.on('game-error', (error) => {
    setStatus('Serverfehler empfangen.', error);
});