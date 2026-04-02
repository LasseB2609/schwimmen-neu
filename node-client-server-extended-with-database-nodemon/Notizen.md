vor der Abgabe noch folgendes machen:
    -  Nodemon wieder entfernen (in Dockerfile und in der yaml, siehe sein Repo)



damit Projekt funktioniert:
    - einmal node.js installieren aus dem internet
    - dann im Terminal in den ordner node-client-server-extended-with-database-nodemon/server wechseln
    - Befehl "npm install" ausführen



ToDos:
    - evtl. noch einen sleep einbauen, dass Server nicht versucht mit der Datenbank zu connecten, obwohl diese noch nicht bereit ist
    - Kommentare überprüfen (z.B. bei "Funktionen" in server.js)
    - mal sehen ob server.js evtl noch aufgeteilt werden sollte in server-lobby.js und server-game.js oder so
    - generell nochmal sehen, ob Dateien zu groß sind und ggf. auftrennen
    - wahrscheinlich noch socketid aus der db entfernen
    - nochmal nachsehen, wo es noch Sinn macht try/catch blöcke hinzuzüfgen. oder generell alle weglassen?
    - in jeder datei nach "TODO" suchen
    - nachsehen, wozu die ganzen Sachen aus der URL geholt werden? evtl. wieder rausnehmen
    - Status Ausgaben für das Debuggen wieder entfernen (überall)
    - Überprüfungen/Validierungen bei den Spielregeln, ob überhaupt 3 Karten etc. nötig sind - wieder entfernen vllt?
    - es können aktuell (02.04) noch Games erstellt werden, auch wenn eine Fehlermeldung kommt, dass die gegebenen Spieler nicht existieren


Warum Socket.io:
    - SocketIO sorgt quasi dafür, dass der Client nicht immer den Server fragen muss, ob er neue Nachrichten für ihn hat, sondern dass der Server dem Client die Nachrichten einfach schickt, sobald er sie hat 
    - das geschieht durch eine Dauerhafte Verbindung zwischen Client und Server