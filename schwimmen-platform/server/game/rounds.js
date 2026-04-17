//Methode, um jedem Spieler zu Beginn einer Runde 3 Karten zu geben
function dealInitialHands() {
    for (let i = 0; i < 3; i++) { // Jeder Spieler erhält 3 Karten
        for (let player of this.players) {
            const card = this.deck.draw();
            if (card) {
                player.addCard(card);
            } else { //sollte nicht eintreten, da zuvor erst das Deck aufgefüllt wird
                console.log("Keine Karten mehr im Deck zum Austeilen!");
            }
        }
    }

    //Live-Score direkt nach dem Austeilen setzen
    for (const player of this.players) {
        player.score = this.calculateHandScore(player.hand);
    }
}

//Methode, um 3 Karten auf den Tisch zu legen
function dealTableCards() {
    //Vorherige Tischkarten dieser Runde in den Ablagestapel verschieben.
    const currentTableCards = Array.isArray(this.tableCards) ? this.tableCards.filter(Boolean) : [];
    if (!Array.isArray(this.discardPile)) {
        this.discardPile = [];
    }
    if (currentTableCards.length > 0) {
        this.discardPile.push(...currentTableCards);
    }

    this.tableCards = [
        this.deck.draw(),
        this.deck.draw(),
        this.deck.draw()
    ];
}

//Methode, um die Runde zu beenden
function endRound() {
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

//Methode, um die Runde zurückzusetzen und für die nächste Runde vorzubereiten
function resetForNewRound() {
    //alle bisher verwendeten Karten wieder ins Deck einsammeln
    const collectedCards = [
        ...this.deck.cards, //die restlichen Karten im Deck
        ...(Array.isArray(this.discardPile) ? this.discardPile : []), //verworfene Tischkarten
        ...this.tableCards, //die Karten auf dem Tisch
        ...this.players.flatMap((player) => player.hand) //die Karten der Spieler, reduziert auf ein Array 
    ].filter(Boolean);

    this.deck.cards = collectedCards;
    this.deck.shuffle(); //mische das Kartendeck

    //leert die HÄnde der Spieler
    for (const player of this.players) {
        player.clearHand();
    }

    //setzt relevante Game-States zurück
    this.tableCards = [];
    this.discardPile = [];
    this.knockedByPlayerId = null;
    this.passCycleStartPlayerId = null;
    this.consecutivePasses = 0;
    this.roundEnded = false;
    this.lastRoundSummary = null;
    this.currentRound += 1;

    //teilt neue Karten aus (alter aktueller Spieler bleibt gleich)
    this.dealInitialHands();
    const roundEndsImmediately = this.checkForImmediateRoundEndOnDeal();
    if (!roundEndsImmediately) {
        this.dealTableCards();
    }
}

function endGame(overrides = {}) {
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

module.exports = {
    dealInitialHands,
    dealTableCards,
    endRound,
    resetForNewRound,
    endGame
};