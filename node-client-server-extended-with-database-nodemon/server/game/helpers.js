//überprüft, ob eine Hand sofort die Runde beendet (31 oder Feuer)
function hasImmediateRoundEndHand(player) {
    const handScore = this.calculateHandScore(player?.hand || []);
    return handScore === 31 || handScore === 'Feuer';
}

//beendet die Runde sofort (bei 31 oder Feuer)
function endRoundImmediately() {
    this.roundEnded = true;
    return {
        nextPlayerId: this.getCurrentPlayer() ? this.getCurrentPlayer().player_id : null,
        knockActive: this.knockedByPlayerId != null,
        roundShouldEnd: true
    };
}

//Hilfsfunktion, um Feuer als höchsten Score zu behandeln, damit die Auswertung der Runde korrekt funktioniert
function toComparableScore(score) {
    if (score === 'Feuer') {
        return Number.POSITIVE_INFINITY;
    }
    return Number(score) || 0;
}

//überprüft nach dem Austeilen, ob jemand 31 oder Feuer hat und beendet die Runde sofort, falls ja
function checkForImmediateRoundEndOnDeal() {
    for (const player of this.players) {
        if (this.hasImmediateRoundEndHand(player)) {
            this.roundEnded = true;
            return true;
        }
    }
    return false;
}

//berechnet die Punktzahl einer Hand
function calculateHandScore(hand) {
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

//Methode, um den Spielerindex anhand der player_id zu finden 
function getPlayerIndexById(player_id) {
    return this.players.findIndex((player) => player.player_id === player_id);
}

//wirft Fehler, falls die Runde bereits beendet ist
function assertRoundNotEnded() {
    if (this.roundEnded) {
        throw new Error('Fehler: Die Runde ist beendet.');
    }
}

//setzt die Runde für die nächste Runde zurück
function resetRoundEndState() {
    this.knockedByPlayerId = null;
    this.roundEnded = false;
}

//Methode, um zu überprüfen, ob das Spiel vorbei ist, indem die Leben der Spieler überprüft werden
function checkIfGameOver() {
    //Spiel ist vorbei, wenn nur noch 1 aktiver Spieler (mit Leben > 0) übrig ist
    const activePlayers = this.players.filter((player) => player.lives > 0);
    return activePlayers.length <= 1;
}

module.exports = {
    hasImmediateRoundEndHand,
    endRoundImmediately,
    toComparableScore,
    checkForImmediateRoundEndOnDeal,
    calculateHandScore,
    getPlayerIndexById,
    assertRoundNotEnded,
    resetRoundEndState,
    checkIfGameOver
};