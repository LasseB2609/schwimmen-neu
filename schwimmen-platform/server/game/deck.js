class Deck {

    constructor(cards) {
        this.cards = cards; // Array von Card-Objekten
    }

    //Methode, um das Kartendeck zu mischen (Fisher-Yates Shuffle)
    shuffle() {
        //Gemischt wird, indem vom Ende des Arrays aus iteriert wird und jedes Element mit einem zufälligen Element aus dem noch nicht gemischten Teil vertauscht wird. 
        //Dadurch entsteht eine gleichmäßig zufällige Reihenfolge der Karten.
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));

            //Karten tauschen
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
        return this.cards;
    }

    //Methode, um die oberste Karte vom Stapel zu entfernen und zurückzugeben
    draw() {
        return this.cards.pop();
    }
}

module.exports = Deck;