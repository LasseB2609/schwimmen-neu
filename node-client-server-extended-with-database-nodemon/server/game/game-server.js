//definiert die Spielregeln, d.h. alles was im Spiel erlaubt ist (Karten tauschen, Zug wechseln, etc.)

class Game {
    constructor(game_id, players, deck) {
        this.game_id = game_id;
        this.players = players; // Array von Spielern
        this.deck = deck;       // Deck-Objekt
        this.tableCards = [];   // Array für die Tischkarten
        this.currentRound = 1;
        this.currentPlayerIndex = 0;
        this.knockedByPlayerId = null; //speichert wer geklopft hat
        this.roundEnded = false; //speichert, ob die Runde beendet ist
        this.status = 'playing';
        this.lastRoundSummary = null; //todo: überprüfen, ob überhaupt nötig
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

    //Methode, um die Runde zu beenden
    endRound() {
        //wenn die Runde bereits beendet ist, wird entweder die Zusammenfassung der letzten Runde zurückgegeben oder das Spiel insgesamt beendet
        if (this.status === 'finished') {
            return this.lastRoundSummary || this.endGame();
        }

        //holt die Spieler, die noch Leben haben
        const activePlayers = this.players.filter((player) => player.lives > 0);

        //wenn nur noch 1 oder kein Spieler mehr Leben hat, ist das Spiel vorbei und es wird endGame aufgerufen
        if (activePlayers.length <= 1) {
            return this.endGame({
                winnerPlayerIds: activePlayers.map((player) => player.player_id),
                loserPlayerIds: [],
                scores: []
            });
        }

        //pro Spieler Rundenscore berechnen und speichern
        const scores = activePlayers.map((player) => {
            const roundScore = this.calculateHandScore(player.hand);
            player.score = roundScore;
            return {
                player_id: player.player_id,
                score: roundScore,
                comparableScore: this.toComparableScore(roundScore),
                livesBefore: player.lives
            };
        });

        //sucht nach einem Spieler mit Feuer
        const feuerPlayer = scores.find((entry) => entry.score === 'Feuer');

        //wenn es einen Feuer-Spieler gibt, wird folgend ausgewertet
        if (feuerPlayer) {
            const loserPlayerIds = scores
                .filter((entry) => entry.player_id !== feuerPlayer.player_id)
                .map((entry) => entry.player_id); //alle Spieler außer der Feuer-Spieler werden gespeichert

            //iteriert durch die Verlierer und zieht ein Leben ab
            for (const loserId of loserPlayerIds) {
                const loser = this.players.find((player) => player.player_id === loserId);
                if (loser) {
                    loser.lives = Math.max(0, loser.lives - 1); //alle anderen verlieren ein Leben, doch es wird nicht unter 0 gegangen
                }
            }

            //wenn nach der Auswertung von Feuer das Spiel vorbei ist, wird folgendes ausgeführt
            if (this.checkIfGameOver()) {
                return this.endGame({
                    winnerPlayerIds: this.players
                        .filter((player) => player.lives > 0)
                        .map((player) => player.player_id),
                    loserPlayerIds,
                    scores: scores.map((entry) => {
                        const player = this.players.find((p) => p.player_id === entry.player_id);
                        return {
                            player_id: entry.player_id,
                            score: entry.score,
                            livesAfter: player ? player.lives : entry.livesBefore
                        };
                    })
                }); //beendet das Spiel und gibt eine Zusammenfassung zurück
            }

            this.status = 'playing'; //das Spiel läuft weiter
            this.lastRoundSummary = {
                round: this.currentRound,
                winnerPlayerIds: [],
                loserPlayerIds,
                scores: scores.map((entry) => {
                    const player = this.players.find((p) => p.player_id === entry.player_id);
                    return {
                        player_id: entry.player_id,
                        score: entry.score,
                        livesAfter: player ? player.lives : entry.livesBefore
                    };
                }),
                gameIsOver: false
            };

            return this.lastRoundSummary; //springt hier raus, damit die weitere Auswertung übersprungen wird
        }

        const minComparableScore = Math.min(...scores.map((entry) => entry.comparableScore)); //Sucht den niedrigsten Score aus allen Scores
        const lowestScorePlayers = scores.filter((entry) => entry.comparableScore === minComparableScore); //Sucht die Spieler mit dem niedrigsten Score
        const loserPlayerIds = lowestScorePlayers.map((entry) => entry.player_id); //Speichert die Ids der Spieler mti dem niedrigsten Score

        //Verlierer verlieren ein Leben
        for (const loserId of loserPlayerIds) {
            const loser = this.players.find((player) => player.player_id === loserId);
            if (loser) {
                loser.lives = Math.max(0, loser.lives - 1);
            }
        }

        //nach der Auswertung wird geprüft, ob das Spiel insgesamt vorbei ist
        const gameIsOver = this.checkIfGameOver();
        if (gameIsOver) {
            return this.endGame({
                winnerPlayerIds: this.players
                    .filter((player) => player.lives > 0)
                    .map((player) => player.player_id),
                loserPlayerIds,
                scores: scores.map((entry) => {
                    const player = this.players.find((p) => p.player_id === entry.player_id);
                    return {
                        player_id: entry.player_id,
                        score: entry.score,
                        livesAfter: player ? player.lives : entry.livesBefore
                    };
                })
            }); //beendet das Spiel und gibt eine Zusammenfassung zurück
        }

        this.status = 'playing'; //das Spiel läuft weiter

        //speichert eine Zusammenfassung der Runde und gibt diese zurück
        this.lastRoundSummary = {
            round: this.currentRound,
            winnerPlayerIds: [],
            loserPlayerIds,
            scores: scores.map((entry) => {
                const player = this.players.find((p) => p.player_id === entry.player_id);
                return {
                    player_id: entry.player_id,
                    score: entry.score,
                    livesAfter: player ? player.lives : entry.livesBefore
                };
            }),
            gameIsOver: false
        };
        return this.lastRoundSummary;
    }

    //überprüft, ob eine Hand sofort die Runde beendet (31 oder Feuer)
    hasImmediateRoundEndHand(player) {
        const handScore = this.calculateHandScore(player?.hand || []);
        return handScore === 31 || handScore === 'Feuer';
    }

    //beendet die Runde sofort (bei 31 oder Feuer)
    endRoundImmediately() {
        this.roundEnded = true;
        return {
            nextPlayerId: this.getCurrentPlayer() ? this.getCurrentPlayer().player_id : null,
            knockActive: this.knockedByPlayerId != null,
            roundShouldEnd: true
        };
    }

    toComparableScore(score) {
        if (score === 'Feuer') {
            return Number.POSITIVE_INFINITY;
        }
        return Number(score) || 0;
    }

    //Methode, um die Runde zurückzusetzen und für die nächste Runde vorzubereiten
    resetForNewRound() {
        //alle bisher verwendeten Karten wieder ins Deck einsammeln
        const collectedCards = [
            ...this.deck.cards, //die restlichen Karten im Deck
            ...this.tableCards, //die Karten auf dem Tisch
            ...this.players.flatMap((player) => player.hand) //die Karten der Spieler, reduziert auf ein Array 
        ];

        this.deck.cards = collectedCards;
        this.deck.shuffle(); //mische das Kartendeck

        //leert die HÄnde der Spieler
        for (const player of this.players) {
            player.clearHand();
        }

        //setzt relevante Game-States zurück
        this.tableCards = [];
        this.knockedByPlayerId = null;
        this.roundEnded = false;
        this.lastRoundSummary = null;
        this.currentRound += 1;

        //aktiver Spieler bleibt am Tischindex stehen (der naechste Zug startet von dort)
        //TODO: Eine Start new Round methode?
        this.dealInitialHands();
        const roundEndsImmediately = this.checkForImmediateRoundEndOnDeal();
        if (!roundEndsImmediately) {
            this.dealTableCards();
        }
    }

    //überprüft nach dem Austeilen, ob jemand 31 oder Feuer hat und beendet die Runde sofort, falls ja
    checkForImmediateRoundEndOnDeal() {
        for (const player of this.players) {
            if (this.hasImmediateRoundEndHand(player)) {
                this.roundEnded = true;
                return true;
            }
        }
        return false;
    }

    //berechnet die Punktzahl einer Hand
    calculateHandScore(hand) {
        if (!Array.isArray(hand) || hand.length === 0) {
            return 0;
        }

        //Drilling zählt als 30.5
        const sameRank = hand.every((card) => card && card.rank === hand[0].rank); //geht durch jedes Element der Handkarten und gibt true zurück, falls alle Karten den gleichen Rang haben
        if (sameRank) {
            if (hand[0].rank === 'A') { //wenn alle Karten Asse sind, zählt es als Feuer (alle anderen verlieren ein Leben)
                return 'Feuer';
            }
            return 30.5;
        }

        //ansonsten zählt die beste Farbensumme
        const sumBySuit = new Map();
        for (const card of hand) {
            if (!card) continue; //Sicherheitscheck
            const previous = sumBySuit.get(card.suit) || 0; //holt die bisherige Summe für die Farbe der Karte, oder 0 wenn es noch keine Karten dieser Farbe gab
            sumBySuit.set(card.suit, previous + (card.value || 0)); //aktualisiert die Summe für die Farbe der Karte, indem der Kartenwert addiert wird
        }

        return Math.max(...sumBySuit.values()); //gibt die höchste Summe zurück, also die beste Farbe der Hand
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

        //Bei 31 oder Feuer wird sofort aufgedeckt und die Runde direkt beendet.
        if (this.hasImmediateRoundEndHand(player)) {
            return this.endRoundImmediately();
        }

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

        //Bei 31 oder Feuer wird sofort aufgedeckt und die Runde direkt beendet.
        if (this.hasImmediateRoundEndHand(player)) {
            return this.endRoundImmediately();
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
        //Spiel ist vorbei, wenn nur noch 1 aktiver Spieler (mit Leben > 0) übrig ist
        const activePlayers = this.players.filter((player) => player.lives > 0);
        return activePlayers.length <= 1;
    }

    endGame(overrides = {}) {
        const winnerPlayerIds = overrides.winnerPlayerIds || this.players
            .filter((player) => player.lives > 0)
            .map((player) => player.player_id); //speichert die Ids der Spieler, die gewonnen haben

        this.status = 'finished'; //Status auf beendet setzen
        this.roundEnded = true; //Runde beenden
        this.lastRoundSummary = {
            round: this.currentRound,
            winnerPlayerIds,
            loserPlayerIds: overrides.loserPlayerIds || [],
            scores: overrides.scores || [],
            gameIsOver: true
        }; //speichern einer Zusammenfassung der letzten Runde

        return this.lastRoundSummary;
    }
}

module.exports = Game;