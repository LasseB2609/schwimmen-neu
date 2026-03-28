//definiert die Spielregeln, d.h. alles was im Spiel erlaubt ist (Karten tauschen, Zug wechseln, etc.)

class Game {
    constructor(game_id, players, deck) {
        this.game_id = game_id;
        this.players = players; // Array von Spielern
        this.deck = deck;       // Deck-Objekt
        this.tableCards = [];   // Array für die Tischkarten
        this.currentRound = 0;
        this.currentPlayerIndex = 0;
    }

    //Methode, um jedem Spieler zu Beginn einer Runde 3 Karten zu geben
    dealInitialHands() {
        for (let i = 0; i < 3; i++) { // Jeder Spieler erhält 3 Karten
            for (let player of this.players) {
                const card = this.deck.draw();
                if (card) {
                    player.addCard(card);
                } else {
                    console.log("Keine Karten mehr im Deck zum Austeilen!");
                    //TODO: hier noch abfangen, dass Spiel dann beendet werden sollte oder ähnliches
                }
            }
        }
    }

    //Methode, um 3 Karten auf den Tisch zu legen
    dealTableCards() {
        this.tableCards = [
            this.deck.draw(),
            this.deck.draw(),
            this.deck.draw()
        ]
    }

    startRound() {
        //todo
    }

    endRound() {
        //todo
    }

    resetForNewRound() {
        //todo
    }

    //Methode, um den aktuell aktiven Spieler zurückzugeben
    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex] || null;
    }

    //Methode, um den Spielerindex anhand der player_id zu finden
    getPlayerIndexById(player_id) {
        return this.players.findIndex((player) => player.player_id === player_id);
    }

    //Methode, um eine Handkarte mit einer Tischkarte zu tauschen
    //player_id = wer den Zug macht
    //handCardId = welche Karte aus der Hand gespielt werden soll
    //tableCardIndex = welche Tischkarte (0,1,2) getauscht werden soll
    swapCard(player_id, handCardId, tableCardIndex) {
        const playerIndex = this.getPlayerIndexById(player_id);

        //überprüfen, ob der Spieler im Spiel ist
        if (playerIndex === -1) {
            throw new Error('Spieler nicht im Spiel gefunden.');
        }

        //überprüfen, ob der Spieler an der Reihe ist
        if (this.currentPlayerIndex !== playerIndex) {
            throw new Error('Du bist aktuell nicht am Zug.');
        }

        //überprüfen, ob der Tischkartenindex gültig ist (Index 0, 1 oder 2)
        if (!Number.isInteger(tableCardIndex) || tableCardIndex < 0 || tableCardIndex > 2) {
            throw new Error('Ungültiger tableCardIndex (erlaubt: 0 bis 2).');
        }

        //überprüfen, ob an dem angegebenen Tischkartenindex tatsächlich eine Karte liegt
        //ist das hier überhaupt nötig?
        if (!this.tableCards[tableCardIndex]) {
            throw new Error('An dieser Tischposition liegt keine Karte.');
        }

        const player = this.players[playerIndex];
        const tableCard = this.tableCards[tableCardIndex];
        const handCardPos = player.hand.findIndex((card) => card.card_id === handCardId); //sucht die Karte in der Hand des Spielers und speichert den Index ab

        //überprüfen, ob die Handkarte tatsächlich in der Hand des Spielers ist
        if (handCardPos === -1) {
            throw new Error('Die ausgewählte Handkarte gehört nicht zum Spieler.');
        }

        //tauscht die Handkarte mit der ausgewählten Tischkarte
        const handCard = player.hand[handCardPos];
        player.hand[handCardPos] = tableCard;
        this.tableCards[tableCardIndex] = handCard;

        //wechselt den Zug zum nächsten Spieler
        //currentPlayerIndex wird um 1 erhöht, damit der nächste Spieler an der Reihe ist. Wenn currentPlayerIndex das Ende des players-Arrays erreicht, wird es wieder auf 0 gesetzt (durch Modulo-Operation), damit der erste Spieler wieder am Zug ist.
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;

        //gibt den neuen Zustand nach dem Zug zurück (hilfreich für Logs/Debug)
        return {
            nextPlayerId: this.getCurrentPlayer() ? this.getCurrentPlayer().player_id : null,
            playedBy: player_id,
            tableCardIndex
        };
    }

    //Methode, um zu überprüfen, ob das Spiel vorbei ist, indem die Leben der Spieler überprüft werden
    checkIfGameOver() {
        for (let player of this.players) {
            if (player.lives <= 0) {
                return true; // Spiel ist vorbei, wenn ein Spieler keine Leben mehr hat
            }
        }
        return false; // Spiel ist noch nicht vorbei
    }

    endGame() {
        //todo
    }
}

module.exports = Game;