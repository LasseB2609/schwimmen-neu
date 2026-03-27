class Card { 

    //übergibt beim erstellen einer Karte die entsprechenden Parameter
    constructor(card_id, suit, rank, value) {
        this.card_id = card_id;  // Primärschlüssel in der Datenbank
        this.suit = suit;    // 'Herz', 'Karo', 'Kreuz', 'Pik'
        this.rank = rank;    // '7', '8', '9', '10', 'B', 'D', 'K', 'A'
        this.value = value;  // Kartenwert: 7-11
    }

    //erstellt eine Card-Instanz aus einer Datenbankzeile
    static fromDbRow(row) {
    if (!row) return null; //falls row nicht existiert, gib null zurück
    return new Card(row.card_id, row.suit, row.rank, row.value);
  }

  //wandelt eine Card-Instanz in ein Datenbankobjekt um
  static toDbRow(card) {
    if (!card) return null; //falls card nicht existiert, gib null zurück
    return {
      card_id: card.card_id,
      suit: card.suit,
      rank: card.rank,
      value: card.value
    };
  }
}

export default Card; // Exportiere die Card-Klasse, damit sie in anderen Modulen verwendet werden kann