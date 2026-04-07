// Auth-Client fuer index.html (Login und Registrierung).

const loginUsernameEl = document.getElementById('loginUsername');
const loginPasswordEl = document.getElementById('loginPassword');
const registerUsernameEl = document.getElementById('registerUsername');
const registerPasswordEl = document.getElementById('registerPassword');
const loginButton = document.getElementById('loginButton');
const registerButton = document.getElementById('registerButton');
const authStatus = document.getElementById('authStatus');

//Hilfsfunktion zum Debuggen: Statusanzeige
function setStatus(message, payload) {
    authStatus.textContent = payload
        ? `${message}\n\n${JSON.stringify(payload, null, 2)}`
        : message;
}

// Prüft beim Laden, ob bereits eine Session besteht.
async function loadMe() {
    try {
        //prüft, ob es zu dem Cookie mit der Session-ID eine gültige Session gibt
        const response = await fetch('/auth/me'); 
        if (!response.ok) { //keine gültige Session
            setStatus('Nicht angemeldet.');
            return;
        }

        const me = await response.json(); //speichert die Session-User-Daten
        setStatus('Angemeldet.', me); //setzt den Status mit den User-Daten
    } catch (error) { //Fehlerbehandlung
        setStatus('Fehler beim Laden der Session.', { message: error.message });
    }
}

// Event-Listener für den Login-Button
loginButton.addEventListener('click', async () => {
    //Username und Passwort werden aus den Eingabefeldern gelesen und gespeichert
    const payload = {
        username: String(loginUsernameEl.value || '').trim(),
        password: String(loginPasswordEl.value || '')
    };

    //Username und Passwort werden an den Server gesendet
    const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    //die Antwort des Servers wird gelesen und ausgewertet
    const data = await response.json();
    if (!response.ok) { //LOgin fehlgeschlagen
        setStatus('Login fehlgeschlagen.', data);
        return;
    }

    //Login erfolgreich, Weiterleitung zur Lobby-Seite
    setStatus('Login erfolgreich.', data);
    window.location.href = 'lobby.html';
});

//event-Listener für den Register-Button
registerButton.addEventListener('click', async () => {
    //Username und Passwort werden aus den Eingabefeldern gelesen und gespeichert
    const payload = {
        username: String(registerUsernameEl.value || '').trim(),
        password: String(registerPasswordEl.value || '')
    };

    //Username und Passwort werden an den Server gesendet
    const response = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    //die Antwort des Servers wird gelesen und ausgewertet
    const data = await response.json();
    if (!response.ok) { //Registrierung fehlgeschlagen
        setStatus('Registrierung fehlgeschlagen.', data);
        return;
    }

    //Registrierung erfolgreich, Weiterleitung zur Lobby-Seite
    setStatus('Registrierung erfolgreich.', data);
    window.location.href = 'lobby.html';
});

loadMe(); //prüft beim Laden, ob bereits eine Session besteht
