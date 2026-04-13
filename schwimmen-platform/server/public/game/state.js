//in dieser Datei schickt der Client events an den Server und empfängt die Antworten 
//für die Spiel-Funktionalität (Spiel erstellen, beitreten, Karte tauschen, etc.)
//Spiel-Client mit Kartenbrett-Rendering.

//Socket wird erst nach Session-Prüfung verbunden.
const socket = io({ autoConnect: false });

//holt die HTML-Elemente, die für die Interaktion mit der Seite benötigt werden
const swapCardButton = document.getElementById('swapCardButton');
const swapAllButton = document.getElementById('swapAllButton');
const knockButton = document.getElementById('knockButton');
const passButton = document.getElementById('passButton');

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

function getState() {
    return {
        socket,
        swapCardButton,
        swapAllButton,
        knockButton,
        passButton,
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
        myPlayerId: null,
        selectedHandCardId: null,
        selectedTableCardIndex: null,
        lastGameState: null,
        lastCurrentPlayerId: null,
        interactionLocked: false
    };
}

export { getState };
