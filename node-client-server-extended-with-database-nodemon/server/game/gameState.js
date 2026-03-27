import Player from "./player.js";
import Deck from "./deck.js";
import Card from "./card.js";
import Game from "./game.js";

//Hilfsfunktion, um Datenbankabfragen mit Promises(=für asynchronität) abzuschicken
function dbQuery(connection, sql, params) { //connection für die DB-Verbindung, sql für den SQL-Befehl, params für "?" Platzhalter im SQL-Befehl
    return new Promise((resolve, reject) => {
        connection.query(sql, params, (error, results) => { //führt die sql Abfrage mit übergebenen Paramtern aus
            if (error) return reject(error); //gibt Fehler zurück, wenn es einen gibt
            resolve(results); //gibt Ergebnisse bei Erfolg zurück
        });
    });
}

async function createGame(connection, player_ids) {

    //speichert das Game in die Datenbank und gibt die Game-Instanz zurück
    const gameInsert = await dbQuery(
        connection,
        'INSERT INTO Game (status, round_number, current_player_id) VALUES (?, ?, ?)',
        ['waiting', 1, null]
    );
    const gameId = gameInsert.insertId; //übergibt den automatisch generierten Primärschlüssel der eben eingefügten Game-Zeile

    //sucht die Spieler zunächst in der Datenbank
    //wenn sie gefunden werden, werden sie als Player-Objekte erstellt und in einem Array gespeichert. Gleichzeitig wird die Beziehung zwischen Game und Player in der Game_Player Tabelle gespeichert, damit wir später wissen, welche Spieler zu welchem Spiel gehören.
    const players = [];
    for (const playerId of player_ids) {
        const playerRows = await dbQuery(
            connection,
            'SELECT player_id, username FROM Player WHERE player_id = ? LIMIT 1',
            [playerId]
        );
        if (playerRows.length === 0) {
            throw new Error('Spieler nicht gefunden: ' + playerId);
        }

        //erstellt ein Player-Objekt aus der Datenbankzeile und fügt es dem players Array hinzu
        const player = new Player(playerRows[0].player_id, playerRows[0].username);
        players.push(player);

        //fügt den Spieler mit dem Spiel in die Game_Player Tabelle ein
        //zu Beginn mit 3 Leben und einem Score von 0. is_active wird auf false gesetzt
        await dbQuery(
            connection,
            'INSERT INTO Game_Player (game_id, player_id, is_active, lives, score) VALUES (?, ?, ?, ?, ?)',
            [gameId, player.player_id, false, 3, 0]
        );
    }

    //holt Karten aus der Datenbank
    const cardRows = await dbQuery(
        connection,
        'SELECT card_id, suit, rank, value FROM Card'
    );
    const cards = cardRows.map(Card.fromDbRow); //für jede Zeile aus der Card Tabelle wird eine Card-Instanz erstellt (=lädt Karten aus der DB und erstellt daraus Card-Objekte)

    //erstellt basierend auf den Karten ein Deck-Objekt und mischt es
    const deck = new Deck(cards);
    deck.shuffle();

    //erstellt ein Game-Objekt mit der ID, den Spielern und dem Deck
    const game = new Game(gameId, players, deck);
    game.dealInitialHands(); //teilt Anfangshände aus
    game.dealTableCards(); //teilt Tischkarten aus

    
    //ruft die Funktion saveGame auf, um den aktuellen Zustand des Spiels in der Datenbank zu speichern
    await saveGame(connection, game);
    return game;
}


async function saveGame() {

}

function loadGame() {
}