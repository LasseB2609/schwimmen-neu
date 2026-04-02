//Imports
const Deck = require('./deck');
const Card = require('./card');
const Player = require('./player');
const Game = require('./game-server');

//Hilfsfunktion, um Datenbankabfragen mit Promises(=für asynchronität) abzuschicken
function dbQuery(connection, sql, params) { //connection für die DB-Verbindung, sql für den SQL-Befehl, params für "?" Platzhalter im SQL-Befehl
    return new Promise((resolve, reject) => {
        connection.query(sql, params, (error, results) => { //führt die sql Abfrage mit übergebenen Paramtern aus
            if (error) return reject(error); //gibt Fehler zurück, wenn es einen gibt
            resolve(results); //gibt Ergebnisse bei Erfolg zurück
        });
    });
}

//Methode, um ein neues Spiel zu erstellen,...
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
            [gameId, player.player_id, true, 3, 0]
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

//Methode, um den aktuellen GameState in der Datenbank zu speichern
async function saveGame(connection, game) {
    //Spielstatus wird in der Datenbank-Tabelle Game aktualisiert
    const currentPlayer = game.players[game.currentPlayerIndex] || null; //holt den aktuellen Spieler basierend auf currentPlayerIndex, falls es keinen gibt  wird null übergeben
    //evtl TODO = ergebnisse mit try/catch abfangen
    await dbQuery(
        connection,
        'UPDATE Game SET status = ?, round_number = ?, current_player_id = ?, knocked_by_player_id = ?, round_ended = ? WHERE game_id = ?',
        [
            'playing',
            game.currentRound || 1, //wenn game.currentRound existiert, übergib es, ansonsten 1 (weil es ja mindestens die erste Runde sein muss)
            currentPlayer ? currentPlayer.player_id : null, //wenn currentPlayer existiert, übergib dessen player_id, ansonsten null
            game.knockedByPlayerId || null,
            game.roundEnded ? 1 : 0,
            game.game_id
        ]
    );

    //Spielerstatus (mit Leben, Score und Aktivitätsstatus) wird in der Datenbank-Tabelle Game_Player aktualisiert
    for (const player of game.players) {
        await dbQuery(
            connection,
            'UPDATE Game_Player SET lives = ?, score = ?, is_active = ? WHERE game_id = ? AND player_id = ?',
            [player.lives, player.score || 0, true, game.game_id, player.player_id]
        );
    }

    //löscht alle aktuellen GameCard Einträge für dieses Spiel, damit sie anschließend mit den aktuellen Karten neu eingefügt werden können
    await dbQuery(
        connection,
        'DELETE FROM Game_Card WHERE game_id = ?',
        [game.game_id]
    );

    //speichert die aktuellen Karten des Nachziehstapels in der Datenbank-Tabelle Game_Card
    let deckPos = 0;
    for (const card of game.deck.cards) { //iteriert durch die Karten des Nachziehstapels und speichert sie in der DB
        await dbQuery(
            connection,
            'INSERT INTO Game_Card (game_id, card_id, location, owner_player_id, position) VALUES (?, ?, ?, ?, ?)',
            [game.game_id, card.card_id, 'deck', null, deckPos++]
        );
    }

    //speichert die aktuellen Karten der Spielerhände in der Datenbank-Tabelle Game_Card
    for (const player of game.players) {
        let handPos = 0;
        for (const card of player.hand) { //iteriert durch die Handkarten jedes Spielers und speichert sie in der DB
            await dbQuery(
                connection,
                'INSERT INTO Game_Card (game_id, card_id, location, owner_player_id, position) VALUES (?, ?, ?, ?, ?)',
                [game.game_id, card.card_id, 'hand', player.player_id, handPos++]
            );
        }
    }

    //speichert die aktuellen Tischkarten in der Datenbank-Tabelle Game_Card
    const tableCards = game.tableCards || [];
    let tablePos = 0;
    for (const card of tableCards) { //iteriert durch die Tischkarten und speichert sie in der DB
        if (!card) continue;
        await dbQuery(
            connection,
            'INSERT INTO Game_Card (game_id, card_id, location, owner_player_id, position) VALUES (?, ?, ?, ?, ?)',
            [game.game_id, card.card_id, 'table', null, tablePos++]
        );
    }

    return true; //erfolgreich gespeichert
}


//Methode, um ein Spiel aus der Datenbank zu laden(notwendig bei Server Crashes/Restarts) und als Game-Objekt zu konstruieren
async function loadGame(connection, gameId) {
    //wandelt die übergebene gameId in eine Ganzzahl um und überprüft, ob sie gültig ist
    const intGameId = Number.parseInt(gameId, 10);
    if (!Number.isInteger(intGameId)) {
        return null;
    }

    //lädt die Daten aus der Datenbanktabelle Game, mit game_id, status, round_number und current_player_id
    const gameRows = await dbQuery(
        connection,
        'SELECT game_id, status, round_number, current_player_id, knocked_by_player_id, round_ended FROM Game WHERE game_id = ? LIMIT 1',
        [intGameId]
    );

    //falls kein Spiel/keine Zeile mit der gameId gefunden wurde, wird null zurückgegeben
    if (gameRows.length === 0) {
        return null;
    }

    const gameRow = gameRows[0]; //nimmt nur die erste Zeile, da es ja nur eine pro game_id geben sollte

    //lädt die Spieler für das Spiel aus der Datenbanktabelle Game_Player und Player mit player_id, username, lives und score
    //als Join, damit wir auch den Usernamen der Spieler bekommen
    const playerRows = await dbQuery(
        connection,
        `SELECT gp.player_id, p.username, gp.lives, gp.score
         FROM Game_Player gp
         JOIN Player p ON p.player_id = gp.player_id
         WHERE gp.game_id = ?
         ORDER BY gp.game_player_id ASC`,
        [intGameId]
    );

    //erstellt aus den Datenbankzeilen Player-Objekte und speichert sie als Array
    const players = playerRows.map((row) => {
        const player = new Player(row.player_id, row.username);
        player.lives = row.lives;
        player.score = row.score || 0;
        return player;
    });

    //lädt die Karten für das Spiel aus der Datenbanktabelle Game_Card und Card mit location, owner_player_id, position, suit, rank und value
    //als Join, damit wir auch die Kartendetails(Suit, Rank, Value) bekommen
    const gameCardRows = await dbQuery(
        connection,
        `SELECT gc.location, gc.owner_player_id, gc.position, c.card_id, c.suit, c.rank, c.value
         FROM Game_Card gc
         JOIN Card c ON c.card_id = gc.card_id
         WHERE gc.game_id = ?
         ORDER BY gc.location ASC, gc.owner_player_id ASC, gc.position ASC`,
        [intGameId]
    );

    const deckCards = [];
    const tableCards = [];
    const handFromPlayers = new Map(); // bestehend aus Schlüssel = player_id und Wert = Array der Handkarten des Spielers

    //läuft durch die Datenbankzeilen der Karten und sortiert sie nach der location(Deck, Tisch, Hand) und speichert sie entsprechend ab
    for (const row of gameCardRows) {
        const card = Card.fromDbRow(row);

        //Deckkarten
        if (row.location === 'deck') {
            deckCards[row.position] = card; //speichert die Karten des Nachziehstapels entsprechend ihrer Position im deckCards Array
            continue; //zum nächsten Durchlauf der Schleife springen
        }

        //Tischkarten
        if (row.location === 'table') {
            tableCards[row.position] = card; //speichert die Karten auf dem Tisch entsprechend ihrer Position im tableCards Array
            continue; //zum nächsten Durchlauf der Schleife springen
        }

        //Handkarten
        if (row.location === 'hand' && row.owner_player_id != null) {
            if (!handFromPlayers.has(row.owner_player_id)) { //überprüft, ob für den Spieler bereits ein Eintrag in der handFromPlayers Map existiert, wenn nicht, wird ein neuer Eintrag mit einem leeren Array erstellt
                handFromPlayers.set(row.owner_player_id, []);
            }
            const handCards = handFromPlayers.get(row.owner_player_id); //holt die Handkarten für den Spieler aus der handFromPlayers Map
            handCards[row.position] = card; //speichert die Karte an der entsprechenden Position im Array der Handkarten des Spielers
        }
    }

    //Rekonstruiert mit den vorher gesammelten Datein ein Game-Objekt, das zurückgegeben wird
    const deck = new Deck(deckCards); //erstellt ein Deck-Objekt mit den Karten des Nachziehstapels
    const game = new Game(intGameId, players, deck); //erstellt ein Game-Objekt mit der gameId, den Spielern und dem Deck
    game.tableCards = tableCards; //übergibt die Tischkarten an das Game-Objekt
    game.currentRound = gameRow.round_number || 1; //übergibt die aktuelle Rundennummer an das Game-Objekt, wenn sie in der Datenbankzeile existiert, ansonsten 1
    game.knockedByPlayerId = gameRow.knocked_by_player_id || null; //übergibt die ID des klopfenden Spielers
    game.roundEnded = Boolean(gameRow.round_ended); //übergibt, ob die Runde bereits beendet ist
    if (gameRow.current_player_id != null) {
        const currentPlayerIndex = game.getPlayerIndexById(gameRow.current_player_id);
        game.currentPlayerIndex = currentPlayerIndex >= 0 ? currentPlayerIndex : 0; //übergibt den Index des aktuellen Spielers an das Game-Objekt (falls er nicht existiert oder ungültig ist, wird 0 übergeben)
    } else { 
        game.currentPlayerIndex = 0; //falls kein aktueller Spieler in der Datenbankzeile angegeben ist, wird der Index auf 0 gesetzt
    }

    //übergibt den Spielern des Game-Objekts die entsprechenden Handkarten, indem es die handFromPlayers Map verwendet, um die Handkarten für jeden Spieler zu finden
    for (const player of game.players) {
        const handCards = handFromPlayers.get(player.player_id) || [];
        player.hand = handCards.filter(Boolean);
    }

    return game; //gibt das rekonstruierte Game-Objekt zurück
}

module.exports = {
    createGame,
    saveGame,
    loadGame
};