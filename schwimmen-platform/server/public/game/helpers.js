//Hilfsfunktionen für das Spiel:
// - toInt: Hilfsfunktion, um einen Wert aus dem Input als Integer zu holen
// - clearSelection: Funktion, die die aktuelle Kartenauswahl zurücksetzt
// - isMyTurnInState: Prüft zentral, ob dieser Client gerade Karten auswählen darf.
// - cardToText: Methode, um eine Karte in ein lesbares Format umzuwandeln (für die Anzeige)
// - createCardElement: Funktion, die ein HTML-Element für eine Karte erstellt
// - renderOpponent: Methode, um die Informationen und Karten eines Gegners zu rendern
// - getOpponentSlots: ordnet Gegner relativ zum eigenen Sitz im Uhrzeigersinn an
// - renderBoard: Methode, um das gesamte Spielbrett zu rendern

//Hilfsfunktion, um einen Wert aus dem Input als Integer zu holen
function toInt(value) {
    return Number.parseInt(value, 10);
}

//Funktion, die die aktuelle Kartenauswahl zurücksetzt
function clearSelection(state) {
    state.selectedHandCardId = null;
    state.selectedTableCardIndex = null;
    state.selectedHandCardIdEl.value = '';
    state.selectedTableCardIndexEl.value = '';
}

//Prüft zentral, ob dieser Client gerade Karten auswählen darf.
function isMyTurnInState(state, gameState) {
    if (!gameState || state.interactionLocked) {
        return false;
    }

    const players = Array.isArray(gameState.players) ? gameState.players : [];
    const myPlayerId = toInt(state.clientPlayerIdEl.value);
    const myPlayer = players.find((player) => player.player_id === myPlayerId);
    const currentPlayer = Number.isInteger(gameState.currentPlayerIndex) ? players[gameState.currentPlayerIndex] : null;

    return Boolean(
        myPlayer
        && currentPlayer
        && currentPlayer.player_id === myPlayer.player_id
        && myPlayer.lives > 0
        && !gameState.roundEnded
        && gameState.status !== 'finished'
    );
}

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
    return `${suitLabel} ${rankLabel}`;
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
function renderBoard(state, gameState) {
    //falls kein Gamestate übergeben wurde, wird die Funktion verlassen
    if (!gameState) {
        return;
    }

    //Merkt sich den letzten bekannten State, damit Auswahl-Re-Render ohne neues Socket-Event funktioniert.
    state.lastGameState = gameState;

    const players = Array.isArray(gameState.players) ? gameState.players : []; //Spieler
    const myPlayerId = toInt(state.clientPlayerIdEl.value); //eigene playerId aus dem Input Feld
    const myPlayer = players.find((player) => player.player_id === myPlayerId) || null; //eigener Spieler
    const opponentSlots = getOpponentSlots(players, myPlayer); //Sitze der Gegner
    const revealOthers = Boolean(gameState.roundEnded || gameState.status === 'finished' || gameState.lastRoundSummary); //legt fest, ob die Karten der Gegner aufgedeckt werden sollen (z.B. am Ende der Runde oder des Spiels)

    //legt die Werte für die aktuelle Runde, den eigenen Score und die Informationen zum aktuellen Spieler am Zug fest
    state.roundValue.textContent = gameState.currentRound ?? '-';
    state.myScoreValue.textContent = myPlayer ? (myPlayer.score ?? '-') : '-';
    state.ownPlayerLabel.textContent = myPlayer
        ? `${myPlayer.username || `Player ${myPlayer.player_id}`} | Leben: ${myPlayer.lives}`
        : 'Deine Karten';
    //zeigt an, welcher Spieler am Zug ist und speichert seine playerId (für spätere Verwendung)
    let currentPlayerId = null;
    if (Number.isInteger(gameState.currentPlayerIndex) && players[gameState.currentPlayerIndex]) {
        const currentPlayer = players[gameState.currentPlayerIndex];
        currentPlayerId = currentPlayer.player_id;
        state.turnInfo.textContent = `Am Zug: ${currentPlayer.username || `Player ${currentPlayer.player_id}`}`;
    } else {
        state.turnInfo.textContent = 'Warte auf Spielstatus ...';
    }

    const isMyTurn = isMyTurnInState(state, gameState); //prüft, ob der eigene Spieler aktuell am Zug ist

    //Wenn der Zug wechselt, wird die lokale Auswahl zurückgesetzt,
    //damit keine alte Auswahl beim nächsten Spieler hängen bleibt.
    if (currentPlayerId !== state.lastCurrentPlayerId) {
        clearSelection(state);
        state.lastCurrentPlayerId = currentPlayerId;
    }

    //rendert die 3 Gegner mit ihren Informationen und Karten (Vorder- oder Rückseite)
    renderOpponent(state.opponentTopLabel, state.opponentTopCards, opponentSlots.top, revealOthers);
    renderOpponent(state.opponentLeftLabel, state.opponentLeftCards, opponentSlots.left, revealOthers);
    renderOpponent(state.opponentRightLabel, state.opponentRightCards, opponentSlots.right, revealOthers);

    state.ownCardsContainer.innerHTML = ''; //löscht mögliche alten Karten des eigenen Spielers
    const myHand = Array.isArray(myPlayer?.hand) ? myPlayer.hand : [];
    const handCardIds = new Set(myHand.map((card) => card.card_id)); //nimmt nur die Ids
    //überprüft, ob die aktuell ausgewählte Handkarte noch in der Hand ist, falls nicht, wird die Auswahl zurückgesetzt
    if (!handCardIds.has(state.selectedHandCardId)) {
        state.selectedHandCardId = null;
        state.selectedHandCardIdEl.value = '';
    }
    //für jede Karte der Hand wird ein HTML-Element erstellt, das den Kartentext anzeigt und ggf. anklickbar ist
    for (const card of myHand) {
        const isSelected = state.selectedHandCardId === card.card_id; //speichert, ob die Karte aktuell ausgewählt ist
        state.ownCardsContainer.appendChild(createCardElement(cardToText(card), {
            clickable: Boolean(isMyTurn), //legt fest, ob die Karte anklickbar ist
            selected: isSelected, //legt fest, ob die Karte als ausgewählt angezeigt wird
            onClick: () => { //beim Klick auf die Karte wird sie ausgewählt oder die Auswahl aufgehoben, und das Board wird neu gerendert, damit die Auswahl sichtbar wird
                state.selectedHandCardId = state.selectedHandCardId === card.card_id ? null : card.card_id;
                state.selectedHandCardIdEl.value = state.selectedHandCardId == null ? '' : String(state.selectedHandCardId);
                renderBoard(state, state.lastGameState);
            }
        }));
    }

    state.tableCardsContainer.innerHTML = ''; //löscht mögliche alten Karten auf dem Tisch
    const tableCards = Array.isArray(gameState.tableCards) ? gameState.tableCards : []; //speichert die Tischkarten
    //setzt die aktuell ausgewählte Tischkarte zurück, falls folgende checks fehlschlagen:
    // - die Auswahl ist keine gültige Zahl
    // - die Auswahl ist außerhalb der Grenzen der Tischkarten
    // - die ausgewählte Karte existiert nicht
    if (
        !Number.isInteger(state.selectedTableCardIndex)
        || state.selectedTableCardIndex < 0
        || state.selectedTableCardIndex >= tableCards.length
        || !tableCards[state.selectedTableCardIndex]
    ) {
        state.selectedTableCardIndex = null;
        state.selectedTableCardIndexEl.value = '';
    }

    //für jede Karte auf dem Tisch wird ein HTML-Element erstellt, das den Kartentext anzeigt und ggf. anklickbar ist
    tableCards.forEach((card, index) => {
        const isSelected = state.selectedTableCardIndex === index;
        state.tableCardsContainer.appendChild(createCardElement(cardToText(card), {
            clickable: Boolean(isMyTurn),
            selected: isSelected,
            onClick: () => {
                state.selectedTableCardIndex = state.selectedTableCardIndex === index ? null : index;
                state.selectedTableCardIndexEl.value = state.selectedTableCardIndex == null ? '' : String(state.selectedTableCardIndex);
                renderBoard(state, state.lastGameState);
            }
        }));
    });

    state.deckPile.textContent = 'Deck'; //TODO: Deck als Stapel mit Rückseite rendern (aktuell nur Text mit "Deck")
}

export {
    toInt,
    clearSelection,
    isMyTurnInState,
    renderBoard
};
