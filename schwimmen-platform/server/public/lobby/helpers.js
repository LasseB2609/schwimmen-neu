//Hilfsfunktionen für die Lobby-Seite
// - setStatus: gibt eine Nachricht im Status-Output aus (zum debuggen)
// - getPlayerId: liest die playerId aus den Session-User-Daten und gibt sie als Integer zurück
// - setCurrentLobby: setzt die aktuelle Lobby im State und gibt sie im currentLobbyOutput aus (zum debuggen)
// - renderLobbyList: rendert die Liste der Lobbys, die übergeben wird, in der Lobby-Seite


//gibt den Status aus (zum debuggen)
function setStatus(state, message, payload) {
    state.statusOutput.textContent = payload
        ? `${message}\n\n${JSON.stringify(payload, null, 2)}`
        : message;
}

//Hilfsfunktion, um die playerId aus dem Input als Integer zu holen
function getPlayerId(state) {
    return Number.parseInt(state.me?.playerId, 10);
}

//setzt die aktuelle Lobby und gibt sie im currentLobbyOutput aus (zum debuggen)
function setCurrentLobby(state, lobby) {
    state.currentLobby = lobby || null;
    state.currentLobbyOutput.textContent = state.currentLobby
        ? JSON.stringify(state.currentLobby, null, 2)
        : 'Noch keiner Lobby beigetreten.';
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
    for (const lobby of lobbies) {
        const item = document.createElement('li');
        item.className = 'list-group-item d-flex justify-content-between align-items-center';

        //nennt die Lobby-Id, den Namen der Lobby, die Id des Hosts(todo: besser den Namen oder?) und die Anzahl der Spieler in der Lobby
        const text = document.createElement('span');
        text.textContent = `#${lobby.lobbyId} ${lobby.lobbyName} | Host: ${lobby.hostPlayerId} | Spieler: ${lobby.playerIds.length}`;

        //Button zum BEitreten der Lobby
        const button = document.createElement('button');
        button.className = 'btn btn-sm btn-outline-primary';
        button.textContent = 'Beitreten';
        button.addEventListener('click', () => { // beim klick
            state.socket.emit('lobby-join', { lobbyId: lobby.lobbyId }); //schickt die lobby-join Nachricht mit der lobbyId an den Server
        });

        //fügt die html-Elemente zusammen und hängt sie an die Liste der Lobbys an
        item.appendChild(text);
        item.appendChild(button);
        state.lobbyList.appendChild(item);
    }
}

export {
    setStatus,
    getPlayerId,
    setCurrentLobby,
    renderLobbyList
};
