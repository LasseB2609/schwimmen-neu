'use strict';

// Hilfsfunktion für DB-Abfragen mit Promises (analog zu game-state-store.js)
function dbQuery(connection, sql, params = []) {
    return new Promise((resolve, reject) => {
        connection.query(sql, params, (error, results) => {
            if (error) return reject(error);
            resolve(results);
        });
    });
}

// Erstellt eine neue Lobby in der DB und gibt sie als Objekt zurück
async function createLobby(connection, hostPlayerId, lobbyName) {
    const result = await dbQuery(
        connection,
        'INSERT INTO Lobby (lobby_name, host_player_id, status) VALUES (?, ?, ?)',
        [lobbyName, hostPlayerId, 'waiting']
    );
    const lobbyId = String(result.insertId);

    // Host direkt als ersten Spieler in Lobby_Player eintragen
    await dbQuery(
        connection,
        'INSERT INTO Lobby_Player (lobby_id, player_id) VALUES (?, ?)',
        [lobbyId, hostPlayerId]
    );

    // gibt die Lobby zurück
    return await getLobby(connection, lobbyId);
}

// Holt eine Lobby aus der DB anhand der ID. Gibt null zurück, wenn sie nicht existiert.
async function getLobby(connection, lobbyId) {
    //holt die LobbyDaten
    const rows = await dbQuery(
        connection,
        `SELECT l.lobby_id, l.lobby_name, l.host_player_id, l.status, p.username AS host_username
         FROM Lobby l
         LEFT JOIN Player p ON p.player_id = l.host_player_id
         WHERE l.lobby_id = ?
         LIMIT 1`,
        [lobbyId]
    );
    if (rows.length === 0) return null;

    //holt die Spieler, die in der Lobby sind
    const row = rows[0];
    const playerRows = await dbQuery(
        connection,
        `SELECT lp.player_id, p.username
         FROM Lobby_Player lp
         LEFT JOIN Player p ON p.player_id = lp.player_id
         WHERE lp.lobby_id = ?
         ORDER BY lp.player_id ASC`,
        [lobbyId]
    );
    //speichert die playerIDs und usernames der Spieler
    const playerIds = new Set(playerRows.map((r) => r.player_id));
    const playerUsernames = playerRows
        .map((r) => r.username)
        .filter(Boolean);

    return {
        lobbyId: String(row.lobby_id),
        lobbyName: row.lobby_name,
        hostPlayerId: row.host_player_id,
        hostUsername: row.host_username || null,
        playerIds,
        playerUsernames,
        status: row.status
    };
}

// Fügt einen Spieler einer Lobby hinzu
async function addPlayerToLobby(connection, lobbyId, playerId) {
    await dbQuery(
        connection,
        'INSERT IGNORE INTO Lobby_Player (lobby_id, player_id) VALUES (?, ?)',
        [lobbyId, playerId]
    );
}

// Entfernt einen Spieler aus einer Lobby.
// Falls die Lobby danach leer ist, wird sie gelöscht.
// Falls der Host entfernt wurde, wird ein neuer Host gesetzt.
// Gibt die aktualisierte Lobby zurück, oder null wenn sie gelöscht wurde.
async function removePlayerFromLobby(connection, lobbyId, playerId) {
    await dbQuery(
        connection,
        'DELETE FROM Lobby_Player WHERE lobby_id = ? AND player_id = ?',
        [lobbyId, playerId]
    );

    const remaining = await dbQuery(
        connection,
        'SELECT player_id FROM Lobby_Player WHERE lobby_id = ?',
        [lobbyId]
    );

    // Lobby leer -> löschen
    if (remaining.length === 0) {
        await deleteLobby(connection, lobbyId);
        return null;
    }

    // Falls der Host die Lobby verlassen hat, nächsten Spieler zum Host machen
    const lobbyRow = await dbQuery(
        connection,
        'SELECT host_player_id FROM Lobby WHERE lobby_id = ? LIMIT 1',
        [lobbyId]
    );
    const currentHostId = lobbyRow[0]?.host_player_id;
    const stillInLobby = remaining.some((r) => r.player_id === currentHostId);
    if (!stillInLobby) {
        const newHostId = remaining[0].player_id;
        await dbQuery(
            connection,
            'UPDATE Lobby SET host_player_id = ? WHERE lobby_id = ?',
            [newHostId, lobbyId]
        );
    }

    //gibt die aktualisierte Lobby zurück
    return getLobby(connection, lobbyId);
}

// Entfernt einen Spieler aus allen Lobbys, in denen er aktuell eingetragen ist.
// Gibt pro Lobby das Ergebnis zurück, damit Aufrufer passende Events senden können.
async function removePlayerFromAllLobbies(connection, playerId) {
    const rows = await dbQuery(
        connection,
        'SELECT lobby_id FROM Lobby_Player WHERE player_id = ?',
        [playerId]
    );

    const results = [];
    for (const row of rows) {
        const lobbyId = String(row.lobby_id);
        const updatedLobby = await removePlayerFromLobby(connection, lobbyId, playerId);
        results.push({ lobbyId, updatedLobby });
    }

    return results;
}

// Löscht eine Lobby und alle zugehörigen Lobby_Player Einträge
async function deleteLobby(connection, lobbyId) {
    await dbQuery(connection, 'DELETE FROM Lobby_Player WHERE lobby_id = ?', [lobbyId]);
    await dbQuery(connection, 'DELETE FROM Lobby WHERE lobby_id = ?', [lobbyId]);
}

// Gibt alle Lobbys mit Status "waiting" zurück (instanzübergreifend aus der DB)
async function getWaitingLobbies(connection) {
    //holt alle Lobbys mit Status "waiting"
    const rows = await dbQuery(
        connection,
        `SELECT l.lobby_id, l.lobby_name, l.host_player_id, l.status, p.username AS host_username
         FROM Lobby l
         LEFT JOIN Player p ON p.player_id = l.host_player_id
         WHERE l.status = ?`,
        ['waiting']
    );
    if (rows.length === 0) return [];

    // Spieler für alle Lobbys holen
    const lobbyIds = rows.map((r) => r.lobby_id);
    const playerRows = await dbQuery(
        connection,
        `SELECT lp.lobby_id, lp.player_id, p.username
         FROM Lobby_Player lp
         LEFT JOIN Player p ON p.player_id = lp.player_id
         WHERE lp.lobby_id IN (?)
         ORDER BY lp.lobby_id ASC, lp.player_id ASC`,
        [lobbyIds]
    );

    // playerRows nach lobby_id gruppieren (damit nicht für jede Lobby eine separate DB-Abfrage nötig ist)
    const playersByLobby = {};
    const usernamesByLobby = {};
    for (const pr of playerRows) {
        if (!playersByLobby[pr.lobby_id]) playersByLobby[pr.lobby_id] = new Set();
        playersByLobby[pr.lobby_id].add(pr.player_id);

        if (!usernamesByLobby[pr.lobby_id]) usernamesByLobby[pr.lobby_id] = [];
        if (pr.username) usernamesByLobby[pr.lobby_id].push(pr.username);
    }

    return rows.map((row) => ({
        lobbyId: String(row.lobby_id),
        lobbyName: row.lobby_name,
        hostPlayerId: row.host_player_id,
        hostUsername: row.host_username || null,
        playerIds: playersByLobby[row.lobby_id] || new Set(),
        playerUsernames: usernamesByLobby[row.lobby_id] || [],
        status: row.status
    }));
}

module.exports = {
    createLobby,
    getLobby,
    addPlayerToLobby,
    removePlayerFromLobby,
    removePlayerFromAllLobbies,
    deleteLobby,
    getWaitingLobbies
};
