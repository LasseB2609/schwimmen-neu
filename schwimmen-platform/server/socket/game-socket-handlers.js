'use strict';

//Funktion, um die Socket-Handler für die gesamte Spiellogik und Lobbylogik zu registrieren
function registerGameSocketHandlers(io, deps) {
    const { gameState, connection, ROUND_END_BUFFER_MS } = deps;
    const activeGames = new Map(); //wird verwendet, um die aktiven Spiele speichern zu können
    const activeLobbies = new Map(); //speichert wartende Lobbys bis ein Spiel gestartet wird
    let nextLobbyId = 1;

    //Funktion, um den aktuellen Spielstatus zurückzugeben, damit er später an die Clients gesendet werden kann 
    function getGameState(game) {
        return {
            gameId: game.game_id,
            status: game.status || 'playing',
            currentRound: game.currentRound,
            currentPlayerIndex: game.currentPlayerIndex,
            knockedByPlayerId: game.knockedByPlayerId || null,
            roundEnded: Boolean(game.roundEnded),
            lastRoundSummary: game.lastRoundSummary || null,
            players: game.players.map((player) => ({
                player_id: player.player_id,
                username: player.username,
                seat_index: player.seatIndex ?? null,
                lives: player.lives,
                score: player.score,
                hand: player.hand
            })),
            tableCards: game.tableCards
        };
    }

    //Funktion, um eine Lobby-Zusammenfassung zu erstellen, damit sie später an die Clients gesendet werden kann
    function getLobbySummary(lobby) {
        return {
            lobbyId: lobby.lobbyId,
            lobbyName: lobby.lobbyName,
            hostPlayerId: lobby.hostPlayerId,
            playerIds: Array.from(lobby.playerIds),
            status: lobby.status
        };
    }

    //Funktion, um die Liste der Lobbys an alle Clients zu senden, damit sie die verfügbaren Lobbys sehen können
    function emitLobbyList() {
        const lobbies = Array.from(activeLobbies.values()) //wandelt die Map in ein Array um
            .filter((lobby) => lobby.status === 'waiting') //filtert nur nach Lobbys mit dem Status "waiting"
            .map(getLobbySummary); //wandelt die Daten der Lobby mit der getLobbySummary Funktion in ein übersichtliches Format um
        io.emit('lobby-list', { lobbies }); //sendet die Lobby-Liste an alle Clients
    }

    //Funktion, um einen Spieler aus einer Lobby zu entfernen
    function removePlayerFromLobby(lobby, playerId) {
        lobby.playerIds.delete(playerId); //entfernt die playerId aus den playerIds der Lobby

        //falls die Lobby jetzt leer ist, wird sie aus activeLobbies gelöscht
        if (lobby.playerIds.size === 0) {
            activeLobbies.delete(lobby.lobbyId);
            return;
        }

        //falls der entfernte Spieler der Host war, wird ein neuer Host festgelegt (der erste Spieler in der Lobby)
        if (lobby.hostPlayerId === playerId) {
            lobby.hostPlayerId = Array.from(lobby.playerIds)[0];
        }
    }

    //lädt ein Spiel aus activeGames oder bei Bedarf aus der Datenbank
    async function getOrLoadGame(roomId) {
        //zunächst wird versucht das Spiel aus activeGames zu holen
        let game = activeGames.get(roomId);
        if (game) {
            console.log("INFO: DAS SPIEL WIRD AUS ACTIVE GAMES GEHOLT (RAM)");
            return game; //gibt das Spiel zurück
        }

        //falls das Spiel nicht in activeGames gefunden wird, wird versucht es aus der Datenbank zu laden
        const gameId = Number.parseInt(roomId, 10);
        game = await gameState.loadGame(connection, gameId);
        if (game) {
            console.log("INFO: DAS SPIEL WIRD AUS DER DATENBANK GELADEN");
            activeGames.set(roomId, game); //speichert das geladene Spiel in activeGames, damit es beim nächsten Mal direkt verfügbar ist
        }

        return game; //gibt das Spiel zurück
    }

    function wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    //wertet eine Runde aus, wenn die Aktion das Rundenende markiert hat
    async function finalizeRoundIfNeeded(game, roomId, actionResult) {
        if (!actionResult?.roundShouldEnd) {
            return;
        }

        const roundSummary = game.endRound(); //beendet die Runde
        await gameState.saveGame(connection, game); //speichert den aktualisierten Spielzustand in der Datenbank

        //sendet eine Nachricht an die Clients, dass die Runde beendet ist
        io.to(roomId).emit('round-ended', {
            reason: 'knock-cycle-complete',
            knockedByPlayerId: game.knockedByPlayerId,
            roundSummary
        });

        // Gibt allen Clients Zeit, die aufgedeckten Karten und Punkte zu sehen.
        await wait(ROUND_END_BUFFER_MS);

        //wenn durch das Rundenende das Spiel zu Ende ist, wird eine Nachricht (mit Sieger und weiteren Infos) an die Clients gesendet
        if (roundSummary.gameIsOver) {
            io.to(roomId).emit('game-finished', {
                winnerPlayerIds: roundSummary.winnerPlayerIds || []
            });
            io.to(roomId).emit('game-state', getGameState(game));
            return;
        }

        //Direkte Rundenenden nach dem Austeilen (31/Feuer) werden so lange aufgelöst,
        //bis eine spielbare Runde entstanden ist oder das Spiel beendet wurde.
        while (game.roundEnded) {
            game.resetForNewRound(); //nächste Runde vorbereiten

            //Falls durch das Austeilen keine sofortige Rundenbeendigung entstanden ist:
            if (!game.roundEnded) {
                await gameState.saveGame(connection, game); //Speichert den aktualisierten Spielzustand in der Datenbank
                io.to(roomId).emit('round-started', { //sendet eine Nachricht an die Clients, dass eine neue Runde gestartet ist
                    currentRound: game.currentRound,
                    currentPlayerId: game.getCurrentPlayer() ? game.getCurrentPlayer().player_id : null
                });
                io.to(roomId).emit('game-state', getGameState(game)); //sendet den aktualisierten Spielstatus an die Clients
                return; //verlässt die Funktion
            }

            //Falls durch das Austeilen eine sofortige Rundenbeendigung entstanden ist:
            const immediateRoundSummary = game.endRound(); //beendet die Runde direkttte
            await gameState.saveGame(connection, game); //speichert das Spiel mit der sofortigen Rundenbeendigung in der Datenbank
            io.to(roomId).emit('round-ended', {
                reason: 'immediate-round-end-on-deal',
                roundSummary: immediateRoundSummary
            }); //informt die Clients über die sofortige Rundenbeendigung

            // Auch bei direkten Rundenenden denselben Sichtbarkeits-Puffer einhalten.
            await wait(ROUND_END_BUFFER_MS);

            //wenn durch das sofortige Rundenende das SPiel zu Ende ist, wird folgendes durchgeführt
            if (immediateRoundSummary.gameIsOver) {
                //informiert die Clients über das Spielende, die Sieger und sendet den finalen Spielstand
                io.to(roomId).emit('game-finished', {
                    winnerPlayerIds: immediateRoundSummary.winnerPlayerIds || []
                }); 
                io.to(roomId).emit('game-state', getGameState(game));
                return;
            }
        }
    }

    //wenn sich ein Client mit Socket.io verbindet, wird die folgende Funktion ausgeführt
    io.on('connection', (socket) => {
        console.log('Socket connected:', socket.id); //Konsolenausgabe der Socket-ID des verbundenen Clients

        //wenn der Client eine "lobby-list" anfragt, wird folgende Funktion ausgeführt
        socket.on('lobby-list-request', () => {
            const lobbies = Array.from(activeLobbies.values()) //wandelt die Map in ein Array um
                .filter((lobby) => lobby.status === 'waiting') //filtert nur nach Lobbys mit dem Status "waiting"
                .map(getLobbySummary); //wandelt die Daten der Lobby mit der getLobbySummary Funktion in ein übersichtliches Format um
            socket.emit('lobby-list', { lobbies });
        });

        //wenn der Client eine "lobby-create" Nachricht sendet, wird folgende Funktion ausgeführt
        socket.on('lobby-create', (data) => {
            const playerId = socket.data.playerId; //speichert die playerId aus der socket-Verbindung
            const lobbyName = String(data?.lobbyName || '').trim() || 'Neue Lobby'; //speichert den LobbyNamen als String ab, falls nicht vorhanden, wird "Neue Lobby" verwendet

            //überprüft, ob die playerId gültig ist
            if (!Number.isInteger(playerId)) {
                socket.emit('game-error', { message: 'Ungültige playerId für lobby-create.' });
                return;
            }

            const lobbyId = String(nextLobbyId++); //erstellt eine neue LobbyId und erhöht den nextLobbyId Zähler für die nächste Lobby
            const lobbyRoomId = `lobby-${lobbyId}`; //erstellt eine eindeutige RaumId für jede Lobby (basierend auf der LobbyId)
            const lobby = {
                lobbyId,
                lobbyName,
                hostPlayerId: playerId,
                playerIds: new Set([playerId]), //speichert die playerIds als Set, damit keine doppelten Einträge möglich sind
                status: 'waiting'
            }; //erstellt ein Lobby-Objekt


            activeLobbies.set(lobbyId, lobby); //fügt die Lobby den activeLobbies hinzu
            socket.join(lobbyRoomId); //erstellt einen Socket.io Raum für die Lobby
            socket.data.playerId = playerId; //speichert die playerId im Socket-Datenobjekt, damit man später weiß, wer diese Socket-Verbindung hat
            socket.data.lobbyId = lobbyId; //speichert die lobbyId im Socket-Datenobjekt

            io.to(lobbyRoomId).emit('lobby-updated', getLobbySummary(lobby)); //sendet eine Nachricht an alle Clients im Lobby-Raum, dass die Lobby aktualisiert wurde
            emitLobbyList(); //schickt die aktualisierte Lobby-Liste an alle Clients, damit sie die neue Lobby sehen können
        });

        //wenn der Client eine "lobby-join" Nachricht sendet, wird folgende Funktion ausgeführt
        socket.on('lobby-join', (data) => {
            const playerId = socket.data.playerId; //speichert die playerId aus der Socket Verbindung
            const lobbyId = String(data?.lobbyId || ''); //speichert die lobbyId aus den übergebenen Daten als String ab
            const lobby = activeLobbies.get(lobbyId); //speichert die Lobby ab, die der Client joinen möchte
            const lobbyRoomId = `lobby-${lobbyId}`; //erstellt die RoomId für den Socket.io Raum der Lobby
            //überprüft, ob die playerId gültig ist und die Lobby existiert
            if (!Number.isInteger(playerId) || !lobbyId) {
                socket.emit('game-error', { message: 'Ungültige Daten für lobby-join.' });
                return;
            }

            //überprüft, ob die Lobby existiert und den Status "waiting" hat
            if (!lobby || lobby.status !== 'waiting') {
                socket.emit('game-error', { message: 'Lobby nicht gefunden.' });
                return;
            }

            //fügt den Spieler der Lobby hinzu
            lobby.playerIds.add(playerId); //fügt die playerId zu den playerIds der Lobby hinzu
            socket.join(lobbyRoomId); //Client joint dem Socket.io Raum der Lobby
            socket.data.playerId = playerId; //speichert die playerId im Socket-Datenobjekt, damit man später weiß, wer diese Socket-Verbindung hat
            socket.data.lobbyId = lobbyId; //speichert die lobbyId im Socket-Datenobjekt

            io.to(lobbyRoomId).emit('lobby-updated', getLobbySummary(lobby)); //sendet eine Nachricht an alle Clients im Lobby-Raum, dass die Lobby aktualisiert wurde
            emitLobbyList(); //schickt die aktualisierte Lobby-Liste an alle Clients, damit sie die neue Spieleranzahl in der Lobby sehen können
        });

        //wenn der Client eine "lobby-leave" Nachricht sendet, wird folgende Funktion ausgeführt
        socket.on('lobby-leave', (data) => {
            const playerId = socket.data.playerId; //speichert die plyaerId aus der socket-Verbindung
            const lobbyId = String(data?.lobbyId ?? socket.data.lobbyId ?? ''); //speichert die lobbyId aus den übergebenen Daten oder aus den Socket-Daten als String
            const lobby = activeLobbies.get(lobbyId); //speichert die Lobby ab, die der Client verlassen möchte
            const lobbyRoomId = `lobby-${lobbyId}`; //erstellt die RoomId für den Socket.io Raum der Lobby

            //überprüft, ob die playerId gültig ist und die Lobby existiert
            if (!Number.isInteger(playerId) || !lobby) {
                return;
            }

            removePlayerFromLobby(lobby, playerId); //entfernt den Spieler aus der Lobby und löscht die Lobby, falls sie jetzt leer ist
            socket.leave(lobbyRoomId); //lässt den Client den Socket.io Raum der Lobby verlassen
            socket.data.lobbyId = null; //entfernt die lobbyId aus den Socket-Daten, da der Client ja jetzt keine Lobby mehr hat

            //falls die Lobby noch existiert, wird eine Nachricht an die Clients im Lobby-Raum gesendet, dass die Lobby aktualisiert wurde
            if (activeLobbies.has(lobbyId)) {
                io.to(lobbyRoomId).emit('lobby-updated', getLobbySummary(lobby));
            }
            emitLobbyList(); //schickt die aktualisierte Lobby-Liste an alle Clients
        });

        //wenn der Client eine "lobby-start-game" Nachricht sendet, wird folgende Funktion ausgeführt
        socket.on('lobby-start-game', async (data) => {
            try {
                const lobbyId = String(data?.lobbyId || socket.data.lobbyId || ''); //speichert die LobbyId aus den übergebenen Daten oder aus den Socket-Daten als String ab
                const playerId = socket.data.playerId; //speichert die playerId aus der Socket-Verbindung
                const lobby = activeLobbies.get(lobbyId); //speichert die Lobby ab, die das Spiel starten möchte
                const lobbyRoomId = `lobby-${lobbyId}`; //erstellt die RoomId für den Socket.io Raum der Lobby
                //überprüft, ob die Lobby existiert und den Status "waiting" hat 
                if (!lobby || lobby.status !== 'waiting') {
                    socket.emit('game-error', { message: 'Lobby nicht gefunden.' });
                    return;
                }

                //überprüft, ob der Spieler, der das Spiel starten möchte, tatsächlich der Host der Lobby ist
                if (!Number.isInteger(playerId) || lobby.hostPlayerId !== playerId) {
                    socket.emit('game-error', { message: 'Nur der Host darf das Spiel starten.' });
                    return;
                }

                const playerIds = Array.from(lobby.playerIds); //erstellt ein Array aus den Spieler-IDs der Lobby
                //überprüft, ob mindestens 2 Spieler in der Lobby sind, damit das Spiel gestartet werden kann
                if (playerIds.length < 2) {
                    socket.emit('game-error', { message: 'Mindestens 2 Spieler werden benötigt.' });
                    return;
                }

                //erstellt ein neues Spiel mit den playerIds der Lobby
                const game = await gameState.createGame(connection, playerIds); //erstellt das Game und speichert es als Objekt ab
                const roomId = String(game.game_id); //speichert die game_id als roomId ab
                activeGames.set(roomId, game); //speichert das Spiel in der activeGames Map

                lobby.status = 'started'; //der Lobby-Status wird auf started gesetzt
                io.to(lobbyRoomId).emit('lobby-game-started', { gameId: game.game_id, lobbyId }); //sendet eine Nachricht an alle Clients im Lobby-Raum, dass das Spiel gestartet wurde
                activeLobbies.delete(lobbyId); //entfernt die Lobby aus den activeLobbies
                emitLobbyList(); //schickt die aktualisierte Lobby-Liste an alle Clients 
            } catch (error) { //Fehlerbehandlung
                console.error('lobby-start-game failed:', error);
                socket.emit('game-error', { message: error.message });
            }
        });

        //Wenn der Client eine "create-game" Nachricht sendet, wird folgende Funktion ausgeführt
        socket.on('create-game', async (data) => {
            try {
                //data könnte entweder ein Array von playerIds sein oder ein Objekt mit einem playerIds-Array
                //todo: überlegen, was wirklich übergeben wird und nicht benötigtes entfernen
                const playerIds = Array.isArray(data)
                    ? data // Wenn data direkt ein Array ist, verwenden wir es
                    : Array.isArray(data?.playerIds) // Wenn data ein Objekt mit einem playerIds-Array ist, verwenden wir dieses Array
                        ? data.playerIds
                        : []; // Wenn keines der beiden Fälle zutrifft, verwenden wir ein leeres Array

                const game = await gameState.createGame(connection, playerIds); //erstellt ein neues Spiel mit der Datenbankverbindung und den übergebenen Spieler-IDs
                const roomId = String(game.game_id); //speichert die game_id als roomId ab
                activeGames.set(roomId, game); //speichert das Spiel in der activeGames Map, damit es später abgerufen werden kann (z.B. wenn ein Spieler beitritt oder der Spielstatus aktualisiert werden muss)

                socket.join(roomId); //erstellt einen socket.io Raum mit der roomID, damit darüber mit allen Clients kommuniziert werden kann

                socket.emit('game-created', { //sendet Nachricht an den Client, dass das Spiel(mit der game_id) erstellt wurde
                    gameId: game.game_id
                });

                io.to(roomId).emit('game-state', getGameState(game)); //sendet an den Raum (mit den Clients) den aktuellen Gamestate
            } catch (error) {
                console.error('create-game failed:', error);
                socket.emit('game-error', { message: error.message });
            }
        });

        //wenn der Client eine "join-game" Nachricht sendet, wird folgende Funktion ausgeführt
        socket.on('join-game', async (data) => {
            const roomId = String(data?.gameId || ''); //holt die GameID aus den übergebenen Daten und speichert sie als RoomId ab
            const game = await getOrLoadGame(roomId); //holt das Spiel aus activeGames oder lädt es aus der Datenbank
            const playerId = socket.data.playerId; //holt die playerId aus der Socket-Verbindung

            
            if (!game) { //wird ausgeführt falls das Spiel nicht existiert/nicht gefunden wurde
                socket.emit('game-error', { message: 'Spiel nicht in activeGames gefunden.' });
                return;
            }

            //Nur Spieler im Spiel dürfen dem Spielraum beitreten
            const isPlayerInGame = game.players.some((player) => player.player_id === playerId);
            if (!isPlayerInGame) {
                socket.emit('game-error', { message: 'Du bist kein Spieler in diesem Spiel.' });
                return;
            }

            socket.join(roomId); //lässt den Client dem Socket.io Raum beitreten
            socket.emit('game-state', getGameState(game)); //sendet den aktuellen Gamestate an den Client
        });

        //wenn der Client eine "swap-card" Nachricht sendet, wird folgende Funktion ausgeführt
        socket.on('swap-card', async (data) => {
            try {
                //holt die benötigten Werte aus den übergebenen Daten
                const roomId = String(data?.gameId || '');
                const playerId = socket.data.playerId;
                const handCardId = Number.parseInt(data?.handCardId, 10);
                const tableCardIndex = Number.parseInt(data?.tableCardIndex, 10);

                //validiert, dass alle benötigten Werte gesetzt sind
                if (!roomId || !Number.isInteger(playerId) || !Number.isInteger(handCardId) || !Number.isInteger(tableCardIndex)) {
                    socket.emit('game-error', { message: 'Ungültige Daten für swap-card.' });
                    return;
                }

                const game = await getOrLoadGame(roomId);
                //überprüfen, ob das Spiel existiert
                if (!game) {
                    socket.emit('game-error', { message: 'Spiel nicht in activeGames gefunden.' });
                    return;
                }

                //führt die Spiellogik aus (tauscht Handkarte gegen Tischkarte)
                const actionResult = game.swapCard(playerId, handCardId, tableCardIndex);

                //speichert den aktualisierten Spielzustand in der Datenbank
                await gameState.saveGame(connection, game);

                //sendet den aktualisierten Spielstatus an alle Clients im Spielraum
                io.to(roomId).emit('game-state', getGameState(game));
                await finalizeRoundIfNeeded(game, roomId, actionResult);
            } catch (error) {
                console.error('swap-card failed:', error);
                socket.emit('game-error', { message: error.message });
            }
        });

        //wenn der Client eine "swap-all-cards" Nachricht sendet, wird folgende Funktion ausgeführt
        socket.on('swap-all-cards', async (data) => {
            try {
                //holt die benötigten Werte aus den übergebenen Daten
                const roomId = String(data?.gameId || '');
                const playerId = socket.data.playerId; //holt die playerId aus der Socket-Verbindung

                //validiert, dass alle benötigten Werte gesetzt sind
                if (!roomId || !Number.isInteger(playerId)) {
                    socket.emit('game-error', { message: 'Ungültige Daten für swap-all-cards.' });
                    return;
                }

                const game = await getOrLoadGame(roomId); //holt das Spiel aus activeGames oder lädt es aus der Datenbank
                if (!game) { //überprüfen, ob das Spiel existiert
                    socket.emit('game-error', { message: 'Spiel nicht in activeGames gefunden.' });
                    return;
                }

                const actionResult = game.swapAllCards(playerId); //tauscht alle Handkarten mit den Tischkarten
                await gameState.saveGame(connection, game); //speichert den aktualisierten Spielzustand in der Datenbank
                //sendet den aktualisierten Spielstatus an die Clients im Spielraum
                io.to(roomId).emit('game-state', getGameState(game)); 
                await finalizeRoundIfNeeded(game, roomId, actionResult);
            } catch (error) { //Fehlerbehandlung
                console.error('swap-all-cards failed:', error);
                socket.emit('game-error', { message: error.message });
            }
        });

        //wenn der Client eine "knock" Nachricht sendet, wird folgende Funktion ausgeführt
        socket.on('knock', async (data) => {
            try {
                const roomId = String(data?.gameId || ''); //holt die GameID aus den übergebenen Daten und speichert sie als RoomId ab
                const playerId = socket.data.playerId; //holt die playerId aus der Socket-Verbindung

                const game = await getOrLoadGame(roomId); //holt das Spiel aus activeGames oder lädt es aus der Datenbank
                
                //überprüfen, ob das Spiel existiert
                if (!game) {
                    socket.emit('game-error', { message: 'Spiel nicht in activeGames gefunden.' });
                    return;
                }

                
                const actionResult = game.knock(playerId);//führt die Spiellogik für das Klopfen aus
                await gameState.saveGame(connection, game);//speichert den aktualisierten Spielzustand in der Datenbank
                io.to(roomId).emit('game-state', getGameState(game)); //sendet den aktualisierten Spielstatus an die Clients
                await finalizeRoundIfNeeded(game, roomId, actionResult);
            } catch (error) { //Fehlerbehandlung
                console.error('knock failed:', error);
                socket.emit('game-error', { message: error.message });
            }
        });

        //wenn der Client eine "pass" Nachricht sendet, wird folgende Funktion ausgeführt
        socket.on('pass', async (data) => {
            try {
                const roomId = String(data?.gameId || ''); //holt die GameID aus den übergebenen Daten und speichert sie als RoomId ab
                const playerId = socket.data.playerId; //holt die playerId aus der socket-Verbindung

                if (!roomId || !Number.isInteger(playerId)) { //validiert, dass die benötigten Werte gesetzt sind
                    socket.emit('game-error', { message: 'Ungültige Daten für pass.' });
                    return;
                }

                const game = await getOrLoadGame(roomId); //holt das Spiel aus activeGames oder lädt es aus der Datenbank
                if (!game) { //überprüfen, ob das Spiel existiert
                    socket.emit('game-error', { message: 'Spiel nicht in activeGames gefunden.' });
                    return;
                }

                const actionResult = game.pass(playerId); //führt die Spiellogik für das Passen aus)
                await gameState.saveGame(connection, game); //speichert den aktualisierten Spielzustand in der Datenbank
                io.to(roomId).emit('game-state', getGameState(game)); //sendet den aktualisierten Spielstatus an die Clients
                await finalizeRoundIfNeeded(game, roomId, actionResult);
            } catch (error) { //Fehlerbehandlung
                console.error('pass failed:', error);
                socket.emit('game-error', { message: error.message });
            }
        });

        //wenn der Client sich trennt, wird dies in der Konsole ausgegeben
        //todo: evtl spieler aus dem Spiel entfernen oder ähnliches
        socket.on('disconnect', () => {
            console.log('Socket disconnected:', socket.id);
        });
    });
}

module.exports = {
    registerGameSocketHandlers
};
