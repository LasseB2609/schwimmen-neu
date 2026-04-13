INFO: aktuell noch Fehler im code

vor der Abgabe noch folgendes machen:
    -  Nodemon wieder entfernen (in Dockerfile und in der yaml, siehe sein Repo)



damit Projekt funktioniert:
    - einmal node.js installieren aus dem internet
    - dann im Terminal in den ordner node-client-server-extended-with-database-nodemon/server wechseln
    - Befehl "npm install" ausführen

ToDos:
    - Kommentare überprüfen (z.B. bei "Funktionen" in server.js)
    - nochmal nachsehen, wo es noch Sinn macht try/catch blöcke hinzuzüfgen. oder generell alle weglassen?
    - in jeder datei nach "TODO" suchen
    - Status Ausgaben für das Debuggen wieder entfernen (überall) und auch andere debugging sachen raus
    - Überprüfungen/Validierungen bei den Spielregeln, ob überhaupt 3 Karten etc. nötig sind - wieder entfernen vllt?
    - es können aktuell (02.04) noch Games erstellt werden, auch wenn eine Fehlermeldung kommt, dass die gegebenen Spieler nicht existieren
    - filter(boolean) entfernen, da nach den regeln eh immer 3 karten in den händen/auf dem tisch liegen müssen
    - toInt Methode checken
    - Regeln einbauen, falls der Stapel leer ist
    - bei Spielende zurück in die Lobby
    -mehrere Server und Lastverteilung (für Lobby und Spiel)
    -> dann auch dieses reverseproxy
    -> auch online?
    - eigene Score Anzeige dauerhaft aktualisieren lassen
    - weniger Kommentare
    - Installationsanweisung ausfüllen
    - anzeigen, wer klopft
    - überprüfen, ob wir noch caching brauchen, da aktuell alles immer aus der db geholt wird
    - Gewinneranzeige oder so
    - was machen wenn client disconnected?
    - locks oder Transactions oder so hinzufügen
    -evtl dateien umbenennen (vllt deutlicher machen, was für client und was für server wichtig ist)
    - check ob wir leastconn brauchen
    -generell cleanup


Warum Socket.io:
    - SocketIO sorgt quasi dafür, dass der Client nicht immer den Server fragen muss, ob er neue Nachrichten für ihn hat, sondern dass der Server dem Client die Nachrichten einfach schickt, sobald er sie hat 
    - das geschieht durch eine Dauerhafte Verbindung zwischen Client und Server


Warum Redis:
Redis sorgt bei euch dafür, dass Events instanzübergreifend verteilt werden, also auch Clients auf anderen Servern sofort mitbekommen, dass etwas passiert ist. Und weil ihr den State zentral in der DB habt, sehen diese Clients dann beim nächsten game-state/Reload denselben aktuellen Stand.
also für die socket.on sachen zb

Redis macht bei euch 2 Jobs:

1 Login merken (Session)
    User loggt sich ein.
    Server speichert “User X ist eingeloggt” in Redis.
    Egal welcher Server die nächste Anfrage bekommt: er schaut in Redis nach und weiß wieder, wer der User ist.

2 Nachrichten zwischen Servern weitergeben (Socket.IO)
    Spieler auf Server A macht eine Aktion.
    Server A schickt Event an Redis.
    Server B und C bekommen dieses Event über Redis auch.
    So sehen alle Spieler (auch auf anderen Servern) sofort denselben Stand.