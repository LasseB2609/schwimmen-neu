vor der Abgabe noch folgendes machen:
    -  Nodemon wieder entfernen (in Dockerfile und in der yaml, siehe sein Repo)



damit Projekt funktioniert:
    - einmal node.js installieren aus dem internet
    - dann im Terminal in den ordner node-client-server-extended-with-database-nodemon/server wechseln
    - Befehl "npm install" ausführen



ToDos:
    - evtl. noch einen sleep einbauen, dass Server nicht versucht mit der Datenbank zu connecten, obwohl diese noch nicht bereit ist


Warum Socket.io:
    - SocketIO sorgt quasi dafür, dass der Client nicht immer den Server fragen muss, ob er neue Nachrichten für ihn hat, sondern dass der Server dem Client die Nachrichten einfach schickt, sobald er sie hat 
    - das geschieht durch eine Dauerhafte Verbindung zwischen Client und Server