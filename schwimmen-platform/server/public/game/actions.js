import { setStatus, toInt, isMyTurnInState } from './helpers.js';

//Funktion, die die Event-Listener für die Buttons und andere interaktive Elemente auf der Spiel-Seite registriert,
// damit bei Interaktionen die entsprechenden Nachrichten an den Server gesendet werden
function registerGameActions(state) {
    const {
        socket,
        createGameButton,
        joinGameButton,
        player1El,
        player2El,
        joinGameIdEl,
        swapCardButton,
        swapAllButton,
        knockButton,
        passButton,
        playGameIdEl,
        clientPlayerIdEl
    } = state;

    //bei buttonclick wird mit create-game und den eingetragenen playerIds versucht, ein neues Spiel zu erstellen
    createGameButton.addEventListener('click', () => {
        const playerIds = [toInt(player1El.value), toInt(player2El.value)].filter(Number.isInteger);
        const payload = { playerIds };
        setStatus(state, 'Sende create-game ...', payload);
        socket.emit('create-game', payload);
    });

    //bei buttonclick wird mit join-game und der eingetragenen gameId versucht, einem bestehenden Spiel beizutreten
    joinGameButton.addEventListener('click', () => {
        const gameId = toInt(joinGameIdEl.value);
        const payload = { gameId };
        setStatus(state, 'Sende join-game ...', payload);
        socket.emit('join-game', payload);
    });

    //bei buttonclick wird mit swap-card und den ausgewählten Karten versucht, eine Karte zu tauschen
    swapCardButton.addEventListener('click', () => {
        const gameId = toInt(playGameIdEl.value);
        const playerId = toInt(clientPlayerIdEl.value);

        const players = Array.isArray(state.lastGameState?.players) ? state.lastGameState.players : [];
        const currentIndex = state.lastGameState?.currentPlayerIndex;
        const currentPlayerId = Number.isInteger(currentIndex) && players[currentIndex]
            ? players[currentIndex].player_id
            : null;
        if (currentPlayerId !== playerId) {
            setStatus(state, 'Du bist aktuell nicht am Zug.');
            return;
        }

        if (!Number.isInteger(state.selectedHandCardId) || !Number.isInteger(state.selectedTableCardIndex)) {
            setStatus(state, 'Bitte zuerst eine eigene Karte und eine Tischkarte auswählen.');
            return;
        }

        const payload = {
            gameId,
            playerId,
            handCardId: state.selectedHandCardId,
            tableCardIndex: state.selectedTableCardIndex
        };

        setStatus(state, 'Sende swap-card ...', payload);
        socket.emit('swap-card', payload);
    });

    //bei buttonclick wird mit swap-all-cards versucht, alle handkarten mit allen Tischkarten zu tauschen
    swapAllButton.addEventListener('click', () => {
        const gameId = toInt(playGameIdEl.value);
        const playerId = toInt(clientPlayerIdEl.value);

        //prüft, ob der Spieler am Zug ist, bevor die Aktion gesendet wird
        if (!isMyTurnInState(state, state.lastGameState)) {
            setStatus(state, 'Du bist aktuell nicht am Zug.');
            return;
        }

        const payload = { gameId, playerId };
        setStatus(state, 'Sende swap-all-cards ...', payload);
        socket.emit('swap-all-cards', payload);
    });

    //bei buttonclick wird mit knock signalisiert, dass in dieser Runde jeder weiterer Spieler nur noch einen Zug machen darf
    knockButton.addEventListener('click', () => {
        const gameId = toInt(playGameIdEl.value);
        const playerId = toInt(clientPlayerIdEl.value);

        //prüft, ob der Spieler am Zug ist, bevor die Aktion gesendet wird
        if (!isMyTurnInState(state, state.lastGameState)) {
            setStatus(state, 'Du bist aktuell nicht am Zug.');
            return;
        }

        const payload = { gameId, playerId };
        setStatus(state, 'Sende knock ...', payload);
        socket.emit('knock', payload);
    });

    //bei buttonclick wird mit pass signalisiert, dass der Spieler passen möchte
    passButton.addEventListener('click', () => {
        const gameId = toInt(playGameIdEl.value);
        const playerId = toInt(clientPlayerIdEl.value);

        //prüft, ob der Spieler am Zug ist, bevor die Aktion gesendet wird
        if (!isMyTurnInState(state, state.lastGameState)) {
            setStatus(state, 'Du bist aktuell nicht am Zug.');
            return;
        }

        const payload = { gameId, playerId };
        setStatus(state, 'Sende pass ...', payload);
        socket.emit('pass', payload);
    });
}

export { registerGameActions };
