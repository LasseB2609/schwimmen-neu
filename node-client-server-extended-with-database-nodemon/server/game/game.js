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
                }   else {
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