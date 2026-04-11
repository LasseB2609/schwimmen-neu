'use strict';

//Hilfsfunktion, um die Passwort-Hashing- und Verifizierungsfunktionen zu erstellen
function createPasswordHelpers(crypto, scryptAsync) {
    // Erstellt einen scrypt-basierten Passwort-Hash
    async function hashPassword(password) {
        const salt = crypto.randomBytes(16).toString('hex'); //Zufallswert, damit gleiche Passwörter nicht gleiche hashes erzeugen
        const derivedKey = await scryptAsync(password, salt, 64); //hashed das Passwort mit scrypt
        return `scrypt$${salt}$${Buffer.from(derivedKey).toString('hex')}`; //speichert
    }

    // Vergleicht Klartextpasswort mit gespeichertem Hash = Verifizierung des Passworts
    async function verifyPassword(password, storedHash) {
        //Überprüft, ob der gespeicherte Hash gültig ist
        if (!storedHash || typeof storedHash !== 'string') {
            return false;
        }

        const [algorithm, salt, hashHex] = storedHash.split('$'); //zerlegt den Hash in 3 Teile
        if (algorithm !== 'scrypt' || !salt || !hashHex) { //überprüft, ob das Format korrekt ist
            return false;
        }

        const expected = Buffer.from(hashHex, 'hex'); //wandelt den gespeicherten Hash-Teil (der aus der DB) zurück in Binärdaten
        const actual = Buffer.from(await scryptAsync(password, salt, expected.length)); //berechnet aus dem eingegebenen Passwort plus dem gespeicherten Salt einen neuen Hash
        if (expected.length !== actual.length) { //überprüft, ob die Längen der beiden Hashes gleich sind (da folgend gleiche Länge erwartet wird)
            return false;
        }

        return crypto.timingSafeEqual(expected, actual); //vregleicht beide Hashes
    }

    return {
        hashPassword,
        verifyPassword
    };
}

module.exports = {
    createPasswordHelpers
};
