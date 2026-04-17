INFO: aktuell noch Fehler im code

vor der Abgabe noch folgendes machen:
    -  Nodemon wieder entfernen (in Dockerfile und in der yaml, siehe sein Repo)



ToDos:
   - Kommentare überprüfen
    - Regeln einbauen, falls der Stapel leer ist
    - weniger Kommentare
    - überprüfen, ob wir noch caching brauchen, da aktuell alles immer aus der db geholt wird
    - was machen wenn client disconnected?
    - check ob wir leastconn brauchen
    - autoreconnects?
    - eigene Lobby haben und dann selbst beitreten verhindern




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