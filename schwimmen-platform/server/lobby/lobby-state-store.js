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

    return {
        lobbyId,
        lobbyName,
        hostPlayerId,
        playerIds: new Set([hostPlayerId]),
        status: 'waiting'
    };
}

// Holt eine Lobby aus der DB anhand der ID. Gibt null zurück, wenn sie nicht existiert.
async function getLobby(connection, lobbyId) {
    const rows = await dbQuery(
        connection,
        'SELECT lobby_id, lobby_name, host_player_id, status FROM Lobby WHERE lobby_id = ? LIMIT 1',
        [lobbyId]
    );
    if (rows.length === 0) return null;

    const row = rows[0];
    const playerRows = await dbQuery(
        connection,
        'SELECT player_id FROM Lobby_Player WHERE lobby_id = ?',
        [lobbyId]
    );

    return {
        lobbyId: String(row.lobby_id),
        lobbyName: row.lobby_name,
        hostPlayerId: row.host_player_id,
        playerIds: new Set(playerRows.map((r) => r.player_id)),
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

    // Lobby leer → löschen
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

    return getLobby(connection, lobbyId);
}

// Löscht eine Lobby und alle zugehörigen Lobby_Player Einträge
async function deleteLobby(connection, lobbyId) {
    await dbQuery(connection, 'DELETE FROM Lobby_Player WHERE lobby_id = ?', [lobbyId]);
    await dbQuery(connection, 'DELETE FROM Lobby WHERE lobby_id = ?', [lobbyId]);
}

// Gibt alle Lobbys mit Status "waiting" zurück (instanzübergreifend aus der DB)
async function getWaitingLobbies(connection) {
    const rows = await dbQuery(
        connection,
        'SELECT lobby_id, lobby_name, host_player_id, status FROM Lobby WHERE status = ?',
        ['waiting']
    );
    if (rows.length === 0) return [];

    // Spieler für alle Lobbys holen
    const lobbyIds = rows.map((r) => r.lobby_id);
    const playerRows = await dbQuery(
        connection,
        'SELECT lobby_id, player_id FROM Lobby_Player WHERE lobby_id IN (?)',
        [lobbyIds]
    );

    // playerRows nach lobby_id gruppieren (damitnicht für jede Lobby eine separate DB-Abfrage nötig ist) und in Sets umwandeln
    const playersByLobby = {};
    for (const pr of playerRows) {
        if (!playersByLobby[pr.lobby_id]) playersByLobby[pr.lobby_id] = new Set();
        playersByLobby[pr.lobby_id].add(pr.player_id);
    }

    return rows.map((row) => ({
        lobbyId: String(row.lobby_id),
        lobbyName: row.lobby_name,
        hostPlayerId: row.host_player_id,
        playerIds: playersByLobby[row.lobby_id] || new Set(),
        status: row.status
    }));
}

module.exports = {
    createLobby,
    getLobby,
    addPlayerToLobby,
    removePlayerFromLobby,
    deleteLobby,
    getWaitingLobbies
};
