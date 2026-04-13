//Methode, um eine Handkarte mit einer Tischkarte zu tauschen
//player_id = wer den Zug macht
//handCardId = welche Karte aus der Hand gespielt werden soll
//tableCardIndex = welche Tischkarte (0,1,2) getauscht werden soll
function swapCard(player_id, handCardId, tableCardIndex) {
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

    //Score direkt nach dem Zug aktualisieren, damit der neue Handstand sofort sichtbar ist
    player.score = this.calculateHandScore(player.hand);

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
function swapAllCards(player_id) {
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

    //Score direkt nach dem Zug aktualisieren, damit der neue Handstand sofort sichtbar ist
    player.score = this.calculateHandScore(player.hand);

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
function knock(player_id) {
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
function pass(player_id) {
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

module.exports = {
    swapCard,
    swapAllCards,
    knock,
    pass
};