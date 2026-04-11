'use strict';

const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

//Initialisiert den Socket.IO Redis Adapter
async function registerSocketRedisAdapter(io) {
    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';

    const pubClient = createClient({ url: redisUrl }); //Publisher Client, für das Senden von Nachrichten an andere Socket.IO Instanzen
    const subClient = pubClient.duplicate(); //Subscriber Client, für das Empfangen von Nachrichten von anderen Socket.IO Instanzen

    //Fehlermanagement für die Redis-Clients
    pubClient.on('error', (error) => { 
        console.error('Socket Redis pub client error:', error);
    });

    subClient.on('error', (error) => { 
        console.error('Socket Redis sub client error:', error);
    });

    //beide Clients verbinden sich mit Redis
    await pubClient.connect();
    await subClient.connect();

    //Socket.io nutzt jetzt redis, um Events zwischen verschiedenen Instanzen zu synchronisieren
    io.adapter(createAdapter(pubClient, subClient));
}

module.exports = {
    registerSocketRedisAdapter
};
