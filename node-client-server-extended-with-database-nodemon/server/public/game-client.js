//in dieser Datei schickt der Client events an den Server und empfängt die Antworten 
//für die Spiel-Funktionalität (Spiel erstellen, beitreten, Karte tauschen, etc.)
//Spiel-Client mit Kartenbrett-Rendering.

//stellt die Verbindung zum Socket.IO Server her
const socket = io();

//holt die HTML-Elemente, die für die Interaktion mit der Seite benötigt werden
const createGameButton = document.getElementById('createGameButton');
const joinGameButton = document.getElementById('joinGameButton');
const player1El = document.getElementById('player1');
const player2El = document.getElementById('player2');
const joinGameIdEl = document.getElementById('joinGameId');
const swapCardButton = document.getElementById('swapCardButton');
const swapAllButton = document.getElementById('swapAllButton');
const knockButton = document.getElementById('knockButton');
const passButton = document.getElementById('passButton');
const playGameIdEl = document.getElementById('playGameId');
const clientPlayerIdEl = document.getElementById('clientPlayerId');
const selectedHandCardIdEl = document.getElementById('selectedHandCardId');
const selectedTableCardIndexEl = document.getElementById('selectedTableCardIndex');
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
let lastCurrentPlayerId = null;
let interactionLocked = false;

const pageParams = new URLSearchParams(window.location.search); //holt die Parameter aus der URL
const queryGameId = Number.parseInt(pageParams.get('gameId'), 10); //holt die gameId aus den Parametern
const queryPlayerId = Number.parseInt(pageParams.get('playerId'), 10); //holt die playerId aus den parametern

//wenn gameId oder playerId als Query-Parameter übergeben wurden, werden diese direkt in die entsprechenden Input-Felder eingetragen
if (Number.isInteger(queryGameId)) {
    joinGameIdEl.value = queryGameId;
    playGameIdEl.value = queryGameId;
}
if (Number.isInteger(queryPlayerId)) {
    clientPlayerIdEl.value = queryPlayerId;
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

//Funktion, die die aktuelle Kartenauswahl zurücksetzt
function clearSelection() {
    selectedHandCardId = null;
    selectedTableCardIndex = null;
    selectedHandCardIdEl.value = '';
    selectedTableCardIndexEl.value = '';
}

//Prüft zentral, ob dieser Client gerade Karten auswählen darf.
function isMyTurnInState(state) {
    if (!state || interactionLocked) {
        return false;
    }

    const players = Array.isArray(state.players) ? state.players : [];
    const myPlayerId = toInt(clientPlayerIdEl.value);
    const myPlayer = players.find((player) => player.player_id === myPlayerId);
    const currentPlayer = Number.isInteger(state.currentPlayerIndex) ? players[state.currentPlayerIndex] : null;

    return Boolean(
        myPlayer
        && currentPlayer
        && currentPlayer.player_id === myPlayer.player_id
        && myPlayer.lives > 0
        && !state.roundEnded
        && state.status !== 'finished'
    );
}

//TODO: Ab hier muss noch kommentiert werden

//Methode, um eine Karte in ein lesbares Format umzuwandeln (für die Anzeige)
function cardToText(card) {
    if (!card) {
        return '-';
    }

    //Maps für die Farbe und den Wert der Karten
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

    //erstellt aus den Maps lesbare Labels für die Karte
    const rankLabel = rankMap[card.rank] || String(card.rank || '?');
    const suitLabel = suitMap[card.suit] || String(card.suit || '?');
    return `${rankLabel} ${suitLabel}`;
}

//Funktion, die ein HTML-Element für eine Karte erstellt
function createCardElement(text, options = {}) {
    const element = document.createElement('button'); //damit die Karte anklickbar wird
    element.type = 'button';
    element.className = 'game-card';
    //entsprechend der übergebenen Optionen werden z.B. Klassen hinzugefügt
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
    //wenn eine onClick-Funktion übergeben wurde, wird diese als EventListener hinzugefügt
    if (typeof options.onClick === 'function') {
        element.addEventListener('click', options.onClick);
    }
    return element;
}

//Methode, um die Informationen und Karten eines Gegners zu rendern
function renderOpponent(labelElement, cardsElement, player, revealCards) {
    cardsElement.innerHTML = ''; //leert das Element komplett (falls vorher schon Karten drin waren)

    //falls es dort keinen Spieler gibt, wird "Frei" angezeigt und die Funktion verlassen
    if (!player) {
        labelElement.textContent = 'Frei';
        return;
    }

    //der Name des Gegners wird angezeigt, sowie die Anzahl der Leben und ggf. der Score (je nachdem, ob die Karten aufgedeckt wurden))
    const scoreText = revealCards ? (player.score ?? '-') : '?';
    labelElement.textContent = `${player.username || `Player ${player.player_id}`} | Leben: ${player.lives} | Score: ${scoreText}`;

    //die Karten des Gegners werden gerendert (als Text oder als "Verdeckt", je nachdem, ob die Karten aufgedeckt wurden)
    const hand = Array.isArray(player.hand) ? player.hand : [];
    for (const card of hand) {
        cardsElement.appendChild(createCardElement(revealCards ? cardToText(card) : 'Verdeckt', { isBack: !revealCards }));
    }
}

//ordnet Gegner relativ zum eigenen Sitz im Uhrzeigersinn an
//offset 1 = links, offset 2 = oben, offset 3 = rechts (bei 4 Spielern)
function getOpponentSlots(players, myPlayer) {
    const slots = { top: null, left: null, right: null }; //die möglichen Positionen
    //wenn Spieler oder eigener Spieler nicht definiert sind oder es weniger als 2 Spieler gibt, können keine Slots sinnvoll zugeordnet werden
    if (!Array.isArray(players) || !myPlayer || players.length < 2) {
        return slots;
    }

    const i = players.length;
    const mySeat = myPlayer.seat_index;
    for (const player of players) {
        //überspringt den eigenen Spieler (da dieser immer unten sitzt)
        if (player.player_id === myPlayer.player_id) {
            continue;
        }

        const offset = (player.seat_index - mySeat + i) % i; //berechnet die relative Position des Gegners basierend auf der Sitzordnung
        if (offset === 1) { //links
            slots.left = player;
        } else if (offset === 2) { //oben
            slots.top = player;
        } else if (offset === 3) { //rechts
            slots.right = player;
        }
    }

    return slots; //Rückgabe
}

//Methode, um das gesamte Spielbrett zu rendern
function renderBoard(state) {
    //falls kein Gamestate übergeben wurde, wird die Funktion verlassen
    if (!state) {
        return;
    }

    //Merkt sich den letzten bekannten State, damit Auswahl-Re-Render ohne neues Socket-Event funktioniert.
    lastGameState = state;

    const players = Array.isArray(state.players) ? state.players : []; //Spieler
    const myPlayerId = toInt(clientPlayerIdEl.value); //eigene playerId aus dem Input Feld
    const myPlayer = players.find((player) => player.player_id === myPlayerId) || null; //eigener Spieler
    const opponentSlots = getOpponentSlots(players, myPlayer); //Sitze der Gegner
    const revealOthers = Boolean(state.roundEnded || state.status === 'finished' || state.lastRoundSummary); //legt fest, ob die Karten der Gegner aufgedeckt werden sollen (z.B. am Ende der Runde oder des Spiels)

    //legt die Werte für die aktuelle Runde, den eigenen Score und die Informationen zum aktuellen Spieler am Zug fest
    roundValue.textContent = state.currentRound ?? '-';
    myScoreValue.textContent = myPlayer ? (myPlayer.score ?? '-') : '-';
    ownPlayerLabel.textContent = myPlayer
        ? `${myPlayer.username || `Player ${myPlayer.player_id}`} | Leben: ${myPlayer.lives}`
        : 'Deine Karten';
    //zeigt an, welcher Spieler am Zug ist und speichert seine playerId (für spätere Verwendung)
    let currentPlayerId = null;
    if (Number.isInteger(state.currentPlayerIndex) && players[state.currentPlayerIndex]) {
        const currentPlayer = players[state.currentPlayerIndex];
        currentPlayerId = currentPlayer.player_id;
        turnInfo.textContent = `Am Zug: ${currentPlayer.username || `Player ${currentPlayer.player_id}`}`;
    } else {
        turnInfo.textContent = 'Warte auf Spielstatus ...';
    }

    const isMyTurn = isMyTurnInState(state); //prüft, ob der eigene Spieler aktuell am Zug ist

    //Wenn der Zug wechselt, wird die lokale Auswahl zurückgesetzt,
    //damit keine alte Auswahl beim nächsten Spieler hängen bleibt.
    if (currentPlayerId !== lastCurrentPlayerId) {
        clearSelection();
        lastCurrentPlayerId = currentPlayerId;
    }

    //rendert die 3 Gegner mit ihren Informationen und Karten (Vorder- oder Rückseite)
    renderOpponent(opponentTopLabel, opponentTopCards, opponentSlots.top, revealOthers);
    renderOpponent(opponentLeftLabel, opponentLeftCards, opponentSlots.left, revealOthers);
    renderOpponent(opponentRightLabel, opponentRightCards, opponentSlots.right, revealOthers);

    ownCardsContainer.innerHTML = ''; //löscht mögliche alten Karten des eigenen Spielers
    const myHand = Array.isArray(myPlayer?.hand) ? myPlayer.hand : [];
    const handCardIds = new Set(myHand.map((card) => card.card_id)); //nimmt nur die Ids
    //überprüft, ob die aktuell ausgewählte Handkarte noch in der Hand ist, falls nicht, wird die Auswahl zurückgesetzt
    if (!handCardIds.has(selectedHandCardId)) {
        selectedHandCardId = null;
        selectedHandCardIdEl.value = '';
    }
    //für jede Karte der Hand wird ein HTML-Element erstellt, das den Kartentext anzeigt und ggf. anklickbar ist
    for (const card of myHand) {
        const isSelected = selectedHandCardId === card.card_id; //speichert, ob die Karte aktuell ausgewählt ist
        ownCardsContainer.appendChild(createCardElement(cardToText(card), {
            clickable: Boolean(isMyTurn), //legt fest, ob die Karte anklickbar ist
            selected: isSelected, //legt fest, ob die Karte als ausgewählt angezeigt wird
            onClick: () => { //beim Klick auf die Karte wird sie ausgewählt oder die Auswahl aufgehoben, und das Board wird neu gerendert, damit die Auswahl sichtbar wird
                selectedHandCardId = selectedHandCardId === card.card_id ? null : card.card_id;
                selectedHandCardIdEl.value = selectedHandCardId == null ? '' : String(selectedHandCardId);
                renderBoard(lastGameState);
            }
        }));
    }

    tableCardsContainer.innerHTML = ''; //löscht mögliche alten Karten auf dem Tisch
    const tableCards = Array.isArray(state.tableCards) ? state.tableCards : []; //speichert die Tischkarten
    //setzt die aktuell ausgewählte Tischkarte zurück, falls folgende checks fehlschlagen:
    // - die Auswahl ist keine gültige Zahl
    // - die Auswahl ist außerhalb der Grenzen der Tischkarten
    // - die ausgewählte Karte existiert nicht
    if (
        !Number.isInteger(selectedTableCardIndex)
        || selectedTableCardIndex < 0
        || selectedTableCardIndex >= tableCards.length
        || !tableCards[selectedTableCardIndex]
    ) {
        selectedTableCardIndex = null;
        selectedTableCardIndexEl.value = '';
    }

    //für jede Karte auf dem Tisch wird ein HTML-Element erstellt, das den Kartentext anzeigt und ggf. anklickbar ist
    tableCards.forEach((card, index) => {
        const isSelected = selectedTableCardIndex === index;
        tableCardsContainer.appendChild(createCardElement(cardToText(card), {
            clickable: Boolean(isMyTurn),
            selected: isSelected,
            onClick: () => {
                selectedTableCardIndex = selectedTableCardIndex === index ? null : index;
                selectedTableCardIndexEl.value = selectedTableCardIndex == null ? '' : String(selectedTableCardIndex);
                renderBoard(lastGameState);
            }
        }));
    });

    deckPile.textContent = 'Deck'; //TODO: Deck als Stapel mit Rückseite rendern (aktuell nur Text mit "Deck")
}

//bei buttonclick wird mit create-game und den eingetragenen playerIds versucht, ein neues Spiel zu erstellen
createGameButton.addEventListener('click', () => {
    const playerIds = [toInt(player1El.value), toInt(player2El.value)].filter(Number.isInteger);
    const payload = { playerIds };
    setStatus('Sende create-game ...', payload);
    socket.emit('create-game', payload);
});

//bei buttonclick wird mit join-game und der eingetragenen gameId versucht, einem bestehenden Spiel beizutreten
joinGameButton.addEventListener('click', () => {
    const gameId = toInt(joinGameIdEl.value);
    const payload = { gameId };
    setStatus('Sende join-game ...', payload);
    socket.emit('join-game', payload);
});

//bei buttonclick wird mit swap-card und den ausgewählten Karten versucht, eine Karte zu tauschen
swapCardButton.addEventListener('click', () => {
    const gameId = toInt(playGameIdEl.value);
    const playerId = toInt(clientPlayerIdEl.value);

    const players = Array.isArray(lastGameState?.players) ? lastGameState.players : [];
    const currentIndex = lastGameState?.currentPlayerIndex;
    const currentPlayerId = Number.isInteger(currentIndex) && players[currentIndex]
        ? players[currentIndex].player_id
        : null;
    if (currentPlayerId !== playerId) {
        setStatus('Du bist aktuell nicht am Zug.');
        return;
    }

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
    const payload = { gameId: toInt(playGameIdEl.value), playerId: toInt(clientPlayerIdEl.value) };
    setStatus('Sende knock ...', payload);
    socket.emit('knock', payload);
});

//bei buttonclick wird mit pass signalisiert, dass der Spieler passen möchte
passButton.addEventListener('click', () => {
    const payload = { gameId: toInt(playGameIdEl.value), playerId: toInt(clientPlayerIdEl.value) };
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
    joinGameIdEl.value = data.gameId;
    playGameIdEl.value = data.gameId;
    setStatus('Spiel erstellt.', data);
});

//Client empfängt den aktuellen Spielstatus und gibt diesen als GameState aus
socket.on('game-state', (state) => {
    interactionLocked = false;
    lastGameState = state; //speichert den letzten bekannten Spielstatus, damit bei Auswahländerungen ohne neues Server-Event gerendert werden kann
    setStatus('Spielstatus empfangen.');
    setGameState(state);
    renderBoard(state);
});

//Client empfängt die Nachricht, dass die Runde nach Klopfen beendet ist
socket.on('round-ended', (data) => {
    interactionLocked = true;
    clearSelection();
    setStatus('Runde beendet.', data);
    renderBoard(lastGameState);
});

//Client empfängt den Start einer neuen Runde
socket.on('round-started', (data) => {
    interactionLocked = true;
    clearSelection();
    setStatus('Neue Runde gestartet.', data);
    renderBoard(lastGameState);
});

//Client empfängt die Nachricht, dass das Spiel beendet ist
socket.on('game-finished', (data) => {
    interactionLocked = true;
    clearSelection();
    setStatus('Spiel beendet.', data);
    renderBoard(lastGameState);
});

//Client empfängt eine Fehlermeldung vom Server und gibt diese als Status aus
socket.on('game-error', (error) => {
    setStatus('Serverfehler empfangen.', error);
});