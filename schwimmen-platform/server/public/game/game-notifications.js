//Datei enthält Funktionen, die für die Anzeige von Benachrichtigungen und Informationen über Spielereignisse im Spielverlauf zuständig sind

//Funktion zu Anzeigen von Eventnachrichten im Spiel, z.B. wenn ein Spieler geklopft hat oder eine Runde gewonnen hat
function showEventMessage(state, message, durationMs = 3000) {
    if (!state.eventMessage) { //falls kein Element für Eventnachrichten definiert ist, keine Nachricht anzeigen
        return;
    }

    //setzt den Text der Eventnachricht und löscht ggf. einen bestehenden Timeout
    state.eventMessage.textContent = message;
    if (state.eventMessageTimeoutId) {
        clearTimeout(state.eventMessageTimeoutId);
        state.eventMessageTimeoutId = null;
    }

    if (durationMs > 0) { //falls eine Anzeigedauer angegeben ist, Nachricht nach Ablauf der Zeit ausblenden
        state.eventMessageTimeoutId = setTimeout(() => {
            state.eventMessage.textContent = '\u00a0';
            state.eventMessageTimeoutId = null;
        }, durationMs);
    }
}

//Funktion, um überlappende EndCountdowns zu verhindern
function stopRoundEndCountdown(state) {
    if (state.roundEndCountdownIntervalId) {
        clearInterval(state.roundEndCountdownIntervalId);
        state.roundEndCountdownIntervalId = null;
    }
}

//startet einen Countdown zum Rundenende, wenn die Karten aufgedeckt werden und zeigt eine entsprechende Nachricht an
function startRoundEndCountdown(state, totalMs) {
    stopRoundEndCountdown(state); //beendet ggf. einen bestehenden Countdown, um Überlappungen zu verhindern

    //wenn keine gültige Zeit angegeben ist, wird direkt eine Nachricht ohne Countdown angezeigt
    if (!Number.isFinite(totalMs) || totalMs <= 0) {
        showEventMessage(state, 'Runde beendet. Leben werden abgezogen.', 3000);
        return;
    }

    //setzt die verbleibende Zeit auf die nächste volle Sekunde hoch, damit die Anzeige nicht zu schnell von 1s auf 0s springt
    let secondsLeft = Math.max(1, Math.ceil(totalMs / 1000));
    //gibt die initiale Nachricht mit der verbleibenden Zeit aus
    showEventMessage(state, `Runde beendet. Leben werden abgezogen. Neue Runde in ${secondsLeft}s.`, 0);

    //setzt ein Intervall, das jede Sekunde die verbleibende Zeit aktualisiert und nach Ablauf der Zeit die Nachricht ausblendet
    state.roundEndCountdownIntervalId = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
            stopRoundEndCountdown(state);
            if (state.eventMessage) {
                state.eventMessage.textContent = '\u00a0';
            }
            return;
        }

        showEventMessage(state, `Runde beendet. Leben werden abgezogen. Neue Runde in ${secondsLeft}s.`, 0);
    }, 1000);
}

//Funktion, die ausgibt, welche Spieler das Spiel gewonnen haben
function getWinnerText(gameState, winnerPlayerIds) {
    const players = Array.isArray(gameState?.players) ? gameState.players : [];
    const winnerNames = winnerPlayerIds
        .map((id) => players.find((player) => player.player_id === id)?.username || null)
        .filter(Boolean);

    if (winnerNames.length === 1) {
        return `${winnerNames[0]} hat das Spiel gewonnen.`;
    }
    return `Unentschieden: ${winnerNames.join(', ')} haben das Spiel gewonnen.`;
}

//Funktion, die nach Spielende eine Nachricht anzeigt und nach einer kurzen Verzögerung zurück zur Lobby leitet
function startGameFinishRedirect(state, winnerText) {
    stopRoundEndCountdown(state);

    let secondsLeft = 10;
    showEventMessage(state, `${winnerText} Weiterleitung zur Lobby in ${secondsLeft}s.`, 0);

    //setzt ein Intervall, das jede Sekunde die verbleibende Zeit aktualisiert und nach Ablauf der Zeit zur Lobby weiterleitet
    state.gameFinishRedirectIntervalId = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
            clearInterval(state.gameFinishRedirectIntervalId);
            state.gameFinishRedirectIntervalId = null;
            window.location.href = '/static/lobby/lobby.html';
            return;
        }

        showEventMessage(state, `${winnerText} Weiterleitung zur Lobby in ${secondsLeft}s.`, 0);
    }, 1000);
}

export {
    showEventMessage,
    stopRoundEndCountdown,
    startRoundEndCountdown,
    getWinnerText,
    startGameFinishRedirect
};