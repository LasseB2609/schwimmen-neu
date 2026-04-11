### Ein Schwimmen Kartenspiel für das Modul "Entwicklung verteilter Systeme".


## Zugriff im Multi-Server-Setup

Die Anwendung läuft mit einem Nginx Load Balancer vor drei App-Instanzen.

* Einstiegspunkt für die Anwendung: `http://localhost:8080`
* phpMyAdmin: `http://localhost:8085`
* Health-Check über den Load Balancer: `http://localhost:8080/health`

Die App-Instanzen `server`, `server2` und `server3` veröffentlichen keine direkten Host-Ports mehr und sind nur intern über das Docker-Netzwerk erreichbar.