//Hilfsfunktionen für die Lobby-Seite
// - getPlayerId: liest die playerId aus den Session-User-Daten und gibt sie als Integer zurück
// - setCurrentLobby: setzt die aktuelle Lobby im State
// - renderLobbyList: rendert die Liste der Lobbys, die übergeben wird, in der Lobby-Seite
// - formatCurrentLobbyText: formatiert die Informationen der aktuellen Lobby als Text, um sie anzuzeigen

//Formatiert die Informationen der aktuellen Lobby als Text, um sie anzuzeigen
function formatCurrentLobbyText(lobby) {
    if (!lobby) { //falls keine Lobby ausgewählt ist, passende Nachricht anzeigen
        return 'Noch keiner Lobby beigetreten.';
    }

    //speichert den Namen des Hosts und die Namen der anderen Spieler in der Lobby, um sie anzuzeigen
    const hostName = lobby.hostUsername || `Player ${lobby.hostPlayerId}`;
    const allPlayers = Array.isArray(lobby.playerUsernames) ? lobby.playerUsernames : [];
    const otherPlayers = allPlayers.filter((name) => name && name !== lobby.hostUsername);

    //Formatiert die Informationen
    const lines = [
        `Lobby: ${lobby.lobbyName} (#${lobby.lobbyId})`,
        `Host: ${hostName}`
    ];

    if (otherPlayers.length === 0) {
        lines.push('Mitspieler: -');
    } else {
        lines.push('Mitspieler:');
        for (const playerName of otherPlayers) {
            lines.push(`- ${playerName}`);
        }
    }

    return lines.join('\n'); //gibt die formatierten Informationen zurück
}

//Hilfsfunktion, um die playerId aus dem Input als Integer zu holen
function getPlayerId(state) {
    return Number.parseInt(state.me?.playerId, 10);
}

//setzt die aktuelle Lobby im State
function setCurrentLobby(state, lobby) {
    state.currentLobby = lobby || null;
    state.currentLobbyOutput.textContent = formatCurrentLobbyText(state.currentLobby);
}

//rendert die Liste der Lobbys, die übergeben wird
function renderLobbyList(state, lobbies) {
    state.lobbyList.innerHTML = ''; //leert die aktuelle Liste, bevor die neuen Lobbys hinzugefügt werden

    //wenn keine Lobbys vorhanden sind, passende Nachricht anzeigen
    if (!Array.isArray(lobbies) || lobbies.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'list-group-item text-muted'; //fügt eine Nachricht hinzu, wenn keine Lobbys vorhanden sind
        emptyItem.textContent = 'Keine offenen Lobbys vorhanden.';
        state.lobbyList.appendChild(emptyItem);
        return;
    }

    //iteriert durch die gegebenen Lobbys und erstellt für jede Lobby ein html-Element in der Liste mit den entsprechenden Informationen und einem Button zum Beitreten
        const myPlayerId = getPlayerId(state);
        for (const lobby of lobbies) {
            const item = document.createElement('li');
            item.className = 'list-group-item d-flex justify-content-between align-items-center';

            //nennt die Lobby-Id, den Namen der Lobby, den Host und die Anzahl der Spieler in der Lobby
            const text = document.createElement('span');
            const hostName = lobby.hostUsername || `Player ${lobby.hostPlayerId}`;
            const playerCount = Array.isArray(lobby.playerUsernames)
                ? lobby.playerUsernames.length
                : 0; //Anzahl der Spieler in der Lobby
            text.textContent = `#${lobby.lobbyId} ${lobby.lobbyName} | Host: ${hostName} | Spieler: ${playerCount}`;

            //Button zum Beitreten der Lobby
            const button = document.createElement('button');
            button.className = 'btn btn-sm btn-outline-primary';
            button.textContent = 'Beitreten';

            // Spieler ist bereits Mitglied dieser Lobby
            const isMember = Array.isArray(lobby.playerIds) && lobby.playerIds.includes(myPlayerId);
            if (isMember) { //Button wird nicht angezeigt
                button.disabled = true;
                button.classList.add('btn-secondary');
                button.classList.remove('btn-outline-primary');
                button.textContent = (myPlayerId === lobby.hostPlayerId) ? 'Eigene Lobby' : 'Bereits beigetreten';
            } else { //Button wird angezeigt
                button.addEventListener('click', () => {
                    state.socket.emit('lobby-join', { lobbyId: lobby.lobbyId }); //schickt beim click die lobby-join Nachricht an den Server
                });
            }

            //fügt die html-Elemente zusammen und hängt sie an die Liste der Lobbys an
            item.appendChild(text);
            item.appendChild(button);
            state.lobbyList.appendChild(item);
        }
}

export {
    getPlayerId,
    setCurrentLobby,
    renderLobbyList
};
