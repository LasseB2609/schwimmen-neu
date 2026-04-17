# Schwimmen Neu

Dieses Repository enthält ein verteiltes Mehrspieler-Kartenspiel für Schwimmen. Der Schwerpunkt liegt nicht nur auf der Spiellogik selbst, sondern auf einem Setup, das typische Bausteine verteilter Webanwendungen zusammenführt: mehrere Node.js-Instanzen, ein vorgeschalteter Nginx-Load-Balancer, Redis für Sessions und Socket-Synchronisation sowie MySQL beziehungsweise MariaDB als persistente Datenbasis.

Der eigentliche Anwendungscode liegt im Unterordner `schwimmen-platform`. Die Root-Ebene dieses Repositories dient vor allem als Einstiegspunkt für Dokumentation, organisatorische Dateien und Installationshinweise.

## Ziel des Projekts

Die Anwendung bildet den kompletten Ablauf eines kleinen Multiplayer-Kartenspiels ab:

- Registrierung und Login von Spielern
- Verwaltung offener Lobbys
- Start eines Spiels aus einer Lobby heraus
- Echtzeit-Spielzustand mit mehreren verbundenen Clients
- Persistenz des Spielzustands in der Datenbank
- Betrieb über mehrere parallele App-Instanzen

Das Projekt ist damit sowohl ein Spielprototyp als auch ein Beispiel für die Umsetzung verteilter Websysteme mit gemeinsamem Zustand.

## Verwendete Technologien

Im Projekt kommen die folgenden zentralen Technologien zum Einsatz:

- Node.js mit Express als HTTP-Server und API-Grundlage
- Socket.IO für Echtzeit-Kommunikation zwischen Browser und Server
- Redis als gemeinsamer Session-Store
- Redis zusätzlich als Adapter-Bus für Socket.IO über mehrere Server-Instanzen
- MySQL beziehungsweise MariaDB zur dauerhaften Speicherung von Spielern, Lobbys, Spielen und Kartenpositionen
- Nginx als Reverse Proxy und Load Balancer vor mehreren App-Instanzen
- Docker Compose zum Starten der gesamten Entwicklungsumgebung
- phpMyAdmin zur Sicht auf die Datenbank im Browser

## Gesamtarchitektur

Die Anwendung läuft im Multi-Server-Setup mit mehreren identischen Node.js-Instanzen. Vor diesen Instanzen sitzt Nginx, das eingehende Requests annimmt und an eine der App-Instanzen weiterleitet.

### Architektur im Überblick

1. Der Browser ruft die Anwendung über Nginx auf.
2. Nginx leitet HTTP- und Socket.IO-Verbindungen an eine der drei Server-Instanzen weiter.
3. Die Server-Instanzen teilen sich denselben persistenten Zustand über die Datenbank.
4. Redis speichert die Session-Daten, damit Logins instanzübergreifend gültig bleiben.
5. Der Socket.IO-Redis-Adapter sorgt dafür, dass Socket-Ereignisse über mehrere Server-Instanzen synchronisiert werden.

## Eingesetzte Infrastruktur-Komponenten

### Nginx

Nginx ist der öffentliche Einstiegspunkt des Systems.

Aufgaben:

- nimmt Requests auf Port `8080` entgegen
- verteilt Requests auf `server1`, `server2` und `server3`
- leitet auch WebSocket-Upgrades für Socket.IO korrekt weiter
- verwendet `ip_hash`, um Clients bei Bedarf konsistenter an dieselbe Instanz zu binden

Die Konfiguration liegt in `schwimmen-platform/nginx/nginx.conf`.

### Redis

Redis wird in diesem Projekt an zwei Stellen verwendet:

1. als Session-Store für `express-session`
2. als Transport-Schicht für den Socket.IO-Redis-Adapter

Dadurch funktionieren Login-Sessions und Socket-Kommunikation auch dann stabil, wenn mehrere App-Instanzen parallel laufen.

Relevante Dateien:

- `schwimmen-platform/server/session/session-middleware.js`
- `schwimmen-platform/server/socket/socket-redis-adapter.js`

### MySQL / MariaDB

Die Datenbank speichert den dauerhaften Zustand des Systems.

Dazu gehören unter anderem:

- registrierte Spieler
- Lobbys und Lobby-Mitglieder
- Spiele und Spieler im Spiel
- Kartenpositionen im Spielzustand

Das Schema liegt in `schwimmen-platform/db/database.sql`.

Tabellen:

- `Player`: Benutzerkonten
- `Lobby`: offene oder gestartete Lobbys
- `Lobby_Player`: Zuordnung Spieler zu Lobby
- `Game`: Spiel-Metadaten und Rundenstatus
- `Game_Player`: Zuordnung Spieler zu Spiel mit Leben, Score und Sitzposition
- `Game_Card`: Position jeder Karte im Spiel, zum Beispiel im Deck, in einer Hand, auf dem Tisch oder im Discard
- `Card`: statische Definitionen des 32er-Kartensatzes

### Docker Compose

Docker Compose startet die komplette Entwicklungsumgebung mit allen benötigten Diensten.

Enthaltene Services:

- `nginx`
- `server1`
- `server2`
- `server3`
- `schwimmen_db`
- `redis`
- `phpmyadmin`

Die zentrale Compose-Datei liegt in `schwimmen-platform/docker-compose.yaml`.

## Projektstruktur

Die wichtigsten Ordner und Dateien sind wie folgt aufgebaut:

```text
schwimmen-neu/
|-- README.md
|-- Installationsanweisung.md
|-- LICENSE
|-- SECURITY.md
`-- schwimmen-platform/
	|-- docker-compose.yaml
	|-- README.md
	|-- nginx/
	|   `-- nginx.conf
	|-- db/
	|   |-- Dockerfile
	|   `-- database.sql
	`-- server/
		|-- Dockerfile
		|-- package.json
		|-- server.js
		|-- auth/
		|-- game/
		|-- lobby/
		|-- public/
		|-- session/
		`-- socket/
```

## Was liegt wo?

### Root-Ebene

- `README.md`: zentrale Projektdokumentation auf Repository-Ebene
- `Installationsanweisung.md`: kurze Startanleitung
- `LICENSE`: Lizenzhinweise
- `SECURITY.md`: Sicherheitsinformationen des Repositories
- `schwimmen-platform/`: eigentliche Anwendung

### schwimmen-platform

- `docker-compose.yaml`: definiert das gesamte Laufzeit-Setup mit App, Datenbank, Redis, Nginx und phpMyAdmin
- `README.md`: kurze projektbezogene Zusatzinfo
- `nginx/`: Load-Balancer-Konfiguration
- `db/`: Datenbank-Image und SQL-Schema
- `server/`: Node.js-Anwendung inklusive Frontend-Dateien

## Aufbau des Server-Codes

Der Ordner `schwimmen-platform/server` enthält die eigentliche Anwendungslogik.

### server.js

`server.js` ist der Einstiegspunkt des Node.js-Servers.

Dort passiert unter anderem:

- Aufbau der MySQL-Verbindung über einen Pool
- Retry-Logik beim Warten auf die Datenbank
- Erstellung der Express-Anwendung
- Registrierung der Session-Middleware mit Redis
- Registrierung der Auth-Routen
- Bereitstellung statischer Dateien unter `/static`
- Start von Socket.IO
- Registrierung des Redis-Adapters für Socket.IO
- Registrierung der Spiel- und Lobby-Socket-Handler

### auth/

Der Ordner `auth` enthält alles rund um Login und Registrierung.

- `routes.js`: HTTP-Endpunkte für Registrierung, Login, Logout und Session-Abfrage
- `guards.js`: Schutz für Seiten und API-Endpunkte, die nur mit gültiger Session erreichbar sein sollen
- `password.js`: Hilfsfunktionen für Passwort-Hashing und Verifikation

### session/

- `session-middleware.js`: erstellt die `express-session`-Middleware und bindet Redis als gemeinsamen Store an

### socket/

Hier liegt die Socket.IO-spezifische Infrastruktur.

- `session-auth.js`: verknüpft Socket-Verbindungen mit der HTTP-Session
- `socket-redis-adapter.js`: aktiviert die Synchronisation von Socket-Events über Redis
- `game-socket-handlers.js`: zentrale Echtzeitlogik für Lobby- und Spielereignisse

### lobby/

Dieser Bereich verwaltet offene Lobbys und deren Zustand.

- `lobby-state-store.js`: liest und schreibt Lobby-Daten in die Datenbank

Verantwortlichkeiten:

- Lobbys erstellen
- Spieler Lobbys beitreten oder verlassen lassen
- offene Lobbys auflisten
- Host-Informationen und Spielernamen an Clients liefern
- Spielstart aus einer Lobby vorbereiten

### game/

Hier liegt die Spiellogik auf dem Server.

Wichtige Dateien:

- `game-server.js`: definiert das Game-Objekt und bindet die Spiellogik-Module zusammen
- `game-state-store.js`: persistiert und lädt den kompletten Spielzustand aus der Datenbank
- `deck.js`: Kartendeck, Ziehen und Mischen
- `card.js`: Kartenmodell
- `player.js`: Spielermodell auf Server-Seite
- `actions.js`: erlaubte Spielaktionen wie Tauschen, Klopfen oder Passen
- `turns.js`: Steuerung des aktiven Spielers
- `rounds.js`: Start, Ende und Reset von Runden
- `helpers.js`: Hilfsfunktionen für Wertung und Spielzustand

### public/

Der Ordner `public` enthält die statischen Frontend-Dateien, die vom Server ausgeliefert werden.

Unterteilung:

- `public/auth/`: Login- und Registrierungsoberfläche
- `public/lobby/`: Lobby-Frontend
- `public/game/`: Spiel-Frontend
- `public/css/`: Stylesheets für Auth, Lobby und Spiel

Die Frontend-Struktur ist modular aufgebaut. Typisch sind getrennte Dateien für:

- `init.js`: Initialisierung des jeweiligen Bereichs
- `state.js`: lokaler Client-State
- `socket.js`: Socket-Ereignisse
- `actions.js`: Benutzeraktionen
- `helpers.js`: Darstellungs- oder Formatierungslogik

Im Spiel-Frontend existiert zusätzlich `game-notifications.js` für laufende Status- und Ereignismeldungen während der Partie.

## Laufzeitfluss der Anwendung

### 1. Authentifizierung

Der Nutzer ruft die Anwendung unter `http://localhost:8080` auf.

- nicht eingeloggte Nutzer landen auf der Auth-Seite
- nach Registrierung oder Login wird eine Session angelegt
- die Session wird in Redis gespeichert
- geschützte Seiten wie Lobby und Spiel prüfen diese Session serverseitig

### 2. Lobby-Phase

Nach dem Login gelangt der Nutzer in die Lobby-Oberfläche.

Hier können Spieler:

- offene Lobbys sehen
- eine eigene Lobby erstellen
- einer offenen Lobby beitreten
- eine Lobby verlassen
- als Host ein Spiel starten

Die Lobby-Daten werden nicht nur im Speicher gehalten, sondern aus der Datenbank gelesen und dort aktualisiert. Das ist für die Multi-Server-Architektur wichtig.

### 3. Spielphase

Beim Start des Spiels wird der Spielzustand serverseitig erzeugt und gespeichert.

Dazu gehören:

- Spielerreihenfolge und Sitzpositionen
- Hände der Spieler
- Tischkarten
- Nachziehstapel
- Rundenzustand, aktiver Spieler und Spielfortschritt

Aktionen im Spiel werden über Socket.IO an den Server gesendet, dort geprüft, verarbeitet und anschließend als aktualisierter Zustand oder Ereignis an alle relevanten Clients verteilt.

### 4. Persistenz des Spielzustands

Der Spielzustand wird datenbankgeschützt gespeichert.

Das bedeutet:

- Änderungen werden in der Datenbank gespeichert
- Server-Instanzen können denselben Zustand laden
- Socket-Ereignisse bleiben instanzübergreifend verwendbar
- Lobby- und Spielzustand hängen nicht nur von Prozessspeicher einer einzelnen Node.js-Instanz ab

## Relevante technische Entscheidungen

### Mehrere App-Instanzen

Es laufen drei identische Server-Container:

- `server1`
- `server2`
- `server3`

Das dient dazu, die Anwendung als verteiltes System zu betreiben und nicht nur als einzelnen Monolithen in einem Prozess.

### Sessions in Redis statt im Prozessspeicher

Würden Sessions nur lokal in einer Node.js-Instanz liegen, wäre ein Nutzer nach einem Wechsel auf eine andere Instanz unter Umständen nicht mehr eingeloggt. Redis löst dieses Problem durch einen gemeinsamen Store.

### Socket.IO mit Redis-Adapter

Da Socket-Verbindungen je nach Routing auf unterschiedlichen App-Instanzen landen können, müssen Socket-Events zwischen den Instanzen ausgetauscht werden. Genau dafür wird der Redis-Adapter verwendet.

### Datenbank als persistente Quelle des Zustands

Lobby- und Spielzustände werden so verwaltet, dass nicht eine einzelne Server-Instanz exklusiv Besitzer des Zustands ist. Das erhöht die Konsistenz im Multi-Server-Betrieb.

## URLs und Zugriffspunkte

Im lokalen Compose-Setup sind standardmäßig folgende Adressen relevant:

- Anwendung: `http://localhost:8080`
- Health-Check: `http://localhost:8080/health`
- phpMyAdmin: `http://localhost:8085`

Die App-Instanzen selbst veröffentlichen keine eigenen Host-Ports, sondern sind nur intern über das Docker-Netz erreichbar.



## Lizenz

Siehe [LICENSE](LICENSE).
