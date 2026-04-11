//Methode, um den aktuell aktiven Spieler zurückzugeben
function getCurrentPlayer() {
    return this.players[this.currentPlayerIndex] || null;
}

//Methode, um den Zug zu wechseln und zu prüfen, ob die Runde nach Klopfen endet
function advanceTurn() {
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

module.exports = {
    getCurrentPlayer,
    advanceTurn
};