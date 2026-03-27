class Player {
    constructor(player_id, username) {
        this.player_id = player_id; // ID des Spielers
        this.username = username;   // Name des Spielers
        this.hand = [];             // Handkarten des Spielers (Array von Card-Objekten)
        this.lives = 3;              // Anzahl der Leben des Spielers
    }   

    //fügt eine Karte der Hand des Spielers hinzu
    addCard() {
        this.hand.push(card);
    }

    //entfernt eine Karte aus der Hand des Spielers
    removeCard(card_id) {
        for (let i = 0; i < this.hand.length; i++) { //geht jede Karte in der Hand durch
            if (this.hand[i].card_id === card_id) {
                this.hand.splice(i, 1); // entfernt eine Karte an der Stelle i
                return true; // Karte erfolgreich entfernt
            }
        }
        return false; // Karte nicht gefunden
    }

    //leert die Hand des Spielers
    clearHand() {
        this.hand = [];
    }
}  
export default Player; // Exportiere die Player-Klasse, damit sie in anderen Modulen verwendet werden kann