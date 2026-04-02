//definiert die Spielregeln, d.h. alles was im Spiel erlaubt ist (Karten tauschen, Zug wechseln, etc.)

class Game {
    constructor(game_id, players, deck) {
        this.game_id = game_id;
        this.players = players; // Array von Spielern
        this.deck = deck;       // Deck-Objekt
        this.tableCards = [];   // Array für die Tischkarten
        this.currentRound = 0;
        this.currentPlayerIndex = 0;
        this.knockedByPlayerId = null; //speichert wer geklopft hat
        this.roundEnded = false; //speichert, ob die Runde beendet ist
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

    //wirft Fehler, falls die Runde bereits beendet ist
    assertRoundNotEnded() {
        if (this.roundEnded) {
            throw new Error('Fehler: Die Runde ist beendet.');
        }
    }

    //Methode, um den Zug zu wechseln und zu prüfen, ob die Runde nach Klopfen endet
    advanceTurn() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length; //wechselt zum nächsten Spieler, wenn am Ende der Spielerreihe angekommen ist, wird wieder von vorne begonnen

        const nextPlayer = this.getCurrentPlayer(); //holt den nächsten Spieler
        const nextPlayerId = nextPlayer ? nextPlayer.player_id : null; //holt die player_id des nächsten Spielers (falls es eine gibt, ansonsten null)
        //wenn geklopft wurde und der Klopfer wieder dran wäre, endet die Runde
        if (this.knockedByPlayerId != null && nextPlayerId === this.knockedByPlayerId) {
            this.roundEnded = true;
        }

        return {
            nextPlayerId,
            knockActive: this.knockedByPlayerId != null,
            roundShouldEnd: this.roundEnded
        }; //gibt die player_id des nächsten Spielers, ob geklopft wurde und ob die Runde enden sollte, zurück
    }

    //Methode, um eine Handkarte mit einer Tischkarte zu tauschen
    //player_id = wer den Zug macht
    //handCardId = welche Karte aus der Hand gespielt werden soll
    //tableCardIndex = welche Tischkarte (0,1,2) getauscht werden soll
    swapCard(player_id, handCardId, tableCardIndex) {
        this.assertRoundNotEnded(); //fängt hier ab, falls die Runde bereits beendet ist
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
        //todo: ist das hier überhaupt nötig?
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
        const turnInfo = this.advanceTurn();

        //gibt den neuen Zustand nach dem Zug zurück (hilfreich für Logs/Debug)
        return {
            nextPlayerId: turnInfo.nextPlayerId,
            playedBy: player_id,
            tableCardIndex,
            knockActive: turnInfo.knockActive,
            roundShouldEnd: turnInfo.roundShouldEnd
        };
    }

    //new
    //Methode, um alle Handkarten mit den Tischkarten zu tauschen 
    swapAllCards(player_id) {
        this.assertRoundNotEnded(); //fängt hier ab, falls die Runde bereits beendet ist
        const playerIndex = this.getPlayerIndexById(player_id);
        const player = this.players[playerIndex];
        //überprüfen, ob der Spieler im Spiel ist
        if (playerIndex === -1) {
            throw new Error('Spieler nicht im Spiel gefunden.');
        }

        //überprüfen, ob der Spieler an der Reihe ist
        if (this.currentPlayerIndex !== playerIndex) {
            throw new Error('Du bist aktuell nicht am Zug.');
        }

        //überprüfen, ob 3 Tischkarten liegen
        //todo: überhaupt nötig?
        if (this.tableCards.length !== 3) {
            throw new Error('Es müssen 3 Karten auf dem Tisch liegen, um alle Karten zu tauschen.');
        }

        //überprüfen, ob der Spieler tatsächlich 3 Karten auf der Hand hat
        //todo: überhaupt nötig?
        if (player.hand.length !== 3) {
            throw new Error('Der Spieler muss 3 Karten auf der Hand haben, um alle Karten zu tauschen.');
        }

        //iteriert durch die Handkarten des Spielers und tauscht sie jeweils mit einer Tischkarte aus
        for(let i = 0; i < player.hand.length; i++) {
            const handCard = player.hand[i];
            const tableCard = this.tableCards[i];

            player.hand[i] = tableCard;
            this.tableCards[i] = handCard;
        }

        const turnInfo = this.advanceTurn(); //zum nächsten Spieler wechseln
        return {
            nextPlayerId: turnInfo.nextPlayerId,
            playedBy: player_id,
            knockActive: turnInfo.knockActive,
            roundShouldEnd: turnInfo.roundShouldEnd
        }; //gibt den nächsten Spieler, wer gespielt hat, ob geklopft wurde und ob die Runde enden sollte zurück
    }

    //MEthode, um zu klopfen, d.h. dass in dieser Runde jeder weitere Spieler nur noch einen Zug machen darf
    //TODO: es darf nicht in der ersten Runde geklopft werden
    knock(player_id) {
        this.assertRoundNotEnded(); //fängt hier ab, falls die Runde bereits beendet ist

        //es darf pro Runde nur einmal geklopft werden
        if (this.knockedByPlayerId != null) {
            throw new Error('Es wurde in dieser Runde bereits geklopft.');
        }
        const playerIndex = this.getPlayerIndexById(player_id);

        //überprüfen, ob der Spieler im Spiel ist
        //todo: überhaupt nötig?
        if (playerIndex === -1) {
            throw new Error('Spieler nicht im Spiel gefunden.');
        }

        //überprüfen, ob der Spieler an der Reihe ist
        //todo: überhaupt nötig? oder evlt knopf irgendwie solange ausgrauen lassen oder so
        if (this.currentPlayerIndex !== playerIndex) {
            throw new Error('Du bist aktuell nicht am Zug.');
        }

        this.knockedByPlayerId = player_id;
        const turnInfo = this.advanceTurn(); //nächster Spieler ist dran

        return {
            knockedBy: player_id,
            nextPlayerId: turnInfo.nextPlayerId,
            knockActive: true,
            roundShouldEnd: turnInfo.roundShouldEnd
        }; 
    } 

    //Methode, um den Zug zu passen
    pass(player_id) {
        this.assertRoundNotEnded(); //fängt hier ab, falls die Runde bereits beendet ist
        const playerIndex = this.getPlayerIndexById(player_id); //speichert den Index des Spielers, der passen möchte

        //überprüfen, ob der Spieler im Spiel ist
        if (playerIndex === -1) {
            throw new Error('Spieler nicht im Spiel gefunden.');
        }

        //überprüfen, ob der Spieler an der Reihe ist
        if (this.currentPlayerIndex !== playerIndex) {
            throw new Error('Du bist aktuell nicht am Zug.');
        }

        const turnInfo = this.advanceTurn(); //wechselt zum nächsten Spieler
        return {
            nextPlayerId: turnInfo.nextPlayerId,
            playedBy: player_id,
            knockActive: turnInfo.knockActive,
            roundShouldEnd: turnInfo.roundShouldEnd
        };
    }

    //setzt die Runde für die nächste Runde zurück
    resetRoundEndState() {
        this.knockedByPlayerId = null;
        this.roundEnded = false;
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