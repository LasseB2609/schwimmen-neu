import { isMyTurnInState } from './helpers.js';

//Funktion, die die Event-Listener für die Buttons und andere interaktive Elemente auf der Spiel-Seite registriert,
// damit bei Interaktionen die entsprechenden Nachrichten an den Server gesendet werden
function registerGameActions(state) {
    const {
        socket,
        swapCardButton,
        swapAllButton,
        knockButton,
        passButton
    } = state;

    //bei buttonclick wird mit swap-card und den ausgewählten Karten versucht, eine Karte zu tauschen
    swapCardButton.addEventListener('click', () => {
        if (!isMyTurnInState(state, state.lastGameState)) {
            return;
        }

        if (!Number.isInteger(state.selectedHandCardId) || !Number.isInteger(state.selectedTableCardIndex)) { //es wurden nicht beide Karten ausgewählt
            return;
        }

        const payload = {
            gameId: state.queryGameId,
            playerId: state.myPlayerId,
            handCardId: state.selectedHandCardId,
            tableCardIndex: state.selectedTableCardIndex
        };

        socket.emit('swap-card', payload);
    });

    //bei buttonclick wird mit swap-all-cards versucht, alle handkarten mit allen Tischkarten zu tauschen
    swapAllButton.addEventListener('click', () => {
        if (!isMyTurnInState(state, state.lastGameState)) {
            return;
        }

        socket.emit('swap-all-cards', { gameId: state.queryGameId, playerId: state.myPlayerId });
    });

    //bei buttonclick wird mit knock signalisiert, dass in dieser Runde jeder weiterer Spieler nur noch einen Zug machen darf
    knockButton.addEventListener('click', () => {
        //prüft, ob der Spieler am Zug ist, bevor die Aktion gesendet wird
        if (!isMyTurnInState(state, state.lastGameState)) {
            return;
        }

        socket.emit('knock', { gameId: state.queryGameId, playerId: state.myPlayerId });
    });

    //bei buttonclick wird mit pass signalisiert, dass der Spieler passen möchte
    passButton.addEventListener('click', () => {
        //prüft, ob der Spieler am Zug ist, bevor die Aktion gesendet wird
        if (!isMyTurnInState(state, state.lastGameState)) {
            return;
        }

        socket.emit('pass', { gameId: state.queryGameId, playerId: state.myPlayerId });
    });
}

export { registerGameActions };
