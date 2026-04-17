//definiert die Spielregeln, d.h. alles was im Spiel erlaubt ist (Karten tauschen, Zug wechseln, etc.)

const roundMethods = require('./rounds');
const turnMethods = require('./turns');
const actionMethods = require('./actions');
const helperMethods = require('./helpers');

class Game {
    constructor(game_id, players, deck) {
        this.game_id = game_id;
        this.players = players; // Array von Spielern
        this.deck = deck;       // Deck-Objekt
        this.tableCards = [];   // Array für die Tischkarten
        this.discardPile = [];  // Karten, die in der Runde vom Tisch verworfen wurden
        this.currentRound = 1;
        this.currentPlayerIndex = 0;
        this.knockedByPlayerId = null; //speichert wer geklopft hat
        this.passCycleStartPlayerId = null; //speichert, wer die aktuelle Pass-Serie gestartet hat
        this.consecutivePasses = 0; //zählt aufeinanderfolgende Pass-Züge
        this.roundEnded = false; //speichert, ob die Runde beendet ist
        this.status = 'playing';
        this.lastRoundSummary = null;
    }
}

Object.assign(Game.prototype, roundMethods, turnMethods, actionMethods, helperMethods);

module.exports = Game;