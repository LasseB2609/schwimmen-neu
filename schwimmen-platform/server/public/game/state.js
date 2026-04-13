//in dieser Datei schickt der Client events an den Server und empfängt die Antworten 
//für die Spiel-Funktionalität (Spiel erstellen, beitreten, Karte tauschen, etc.)
//Spiel-Client mit Kartenbrett-Rendering.

//Socket wird erst nach Session-Prüfung verbunden.
const socket = io({ autoConnect: false });

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

const pageParams = new URLSearchParams(window.location.search); //holt die Parameter aus der URL
const queryGameId = Number.parseInt(pageParams.get('gameId'), 10); //holt die gameId aus den Parametern
const queryPlayerId = Number.parseInt(pageParams.get('playerId'), 10); //holt die playerId aus den parametern

//wenn gameId oder playerId als Query-Parameter übergeben wurden, werden diese direkt in die entsprechenden Input-Felder eingetragen
if (Number.isInteger(queryGameId)) {
    joinGameIdEl.value = queryGameId;
    playGameIdEl.value = queryGameId;
}

function getState() {
    return {
        socket,
        createGameButton,
        joinGameButton,
        player1El,
        player2El,
        joinGameIdEl,
        swapCardButton,
        swapAllButton,
        knockButton,
        passButton,
        playGameIdEl,
        clientPlayerIdEl,
        selectedHandCardIdEl,
        selectedTableCardIndexEl,
        roundValue,
        turnInfo,
        myScoreValue,
        ownPlayerLabel,
        ownCardsContainer,
        tableCardsContainer,
        deckPile,
        opponentTopLabel,
        opponentLeftLabel,
        opponentRightLabel,
        opponentTopCards,
        opponentLeftCards,
        opponentRightCards,
        pageParams,
        queryGameId,
        queryPlayerId,
        selectedHandCardId: null,
        selectedTableCardIndex: null,
        lastGameState: null,
        lastCurrentPlayerId: null,
        interactionLocked: false
    };
}

export { getState };
