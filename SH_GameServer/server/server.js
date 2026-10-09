const express = require('express');
var app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, { cors: { origin: '*' } });
const { generateRoomCode, rooms, roomHosts, Room} = require('./rooms');
const crypto = require('crypto');
const {getCards} = require("./card-repository");
const {Deck} = require("./decks");
const { ifError } = require('assert');

const sessions = new Map();


app.get('/', (req, res) => {
    res.send("S**T Happens Server Running");
});

const RECONNECT_GRACE_MS = 30_000;

function clearRoomSession(session) {
    clearTimeout(session.disconnectTimer);
    session.disconnectTimer = null;
    session.roomCode = null;
    session.role = null;
}

function closeRoom(roomCode) {
    const room = rooms[roomCode];
    if (!room) {
        return;
    }

    delete roomHosts[room.hostID];
    delete rooms[roomCode];

    for (const [token, session] of sessions) {
        if (session.roomCode != roomCode) {
            continue;
        }

        clearRoomSession(session);

        if (session.socketId === null) {
            sessions.delete(token);
        }
        else{
            io.to(session.socketId).emit("sessionReset");
        }
    }

    io.to(roomCode).emit("roomClosed");
    io.in(roomCode).socketsLeave(roomCode);
}

io.on('connection', (socket) => {

    socket.on('createRoom', () => {
        const sessionToken = socket.data.sessionToken;
        const session = sessions.get(sessionToken);

        if (!session) {
            socket.emit('sessionError', "Session not ready");
            return;
        }

        if (session.roomCode) {
            socket.emit('sessionError', "Already in a room");
            return;
        }


        if (!(Object.keys(roomHosts).includes(socket.id))) {
            let roomCode;
            do {
                roomCode = generateRoomCode();
            } while (Object.prototype.hasOwnProperty.call(rooms, roomCode));

            const room = new Room(roomCode, sessionToken);
            rooms[roomCode] = room;

            room.hostID = socket.id;

            session.roomCode = roomCode;
            session.role = "host";

            roomHosts[socket.id] = roomCode;
            socket.join(roomCode);
            socket.emit('roomCreated', roomCode);
        }
        else {
            console.log('Room already created');
            return;

        };


    });

    socket.on('join room', (roomCode, username) => {
        const room = rooms[roomCode];
        const sessionToken = socket.data.sessionToken;
        const session = sessions.get(sessionToken);
        if (!session) {
            socket.emit('sessionError', "session not ready");
            return;
        }

        if (session.roomCode) {
            socket.emit('sessionError', "Already in a room");
            return;
        }
        
        if(!room){
            socket.emit('joinError', "code");
            return;
        }
        let player;
        try{
            player = room.addPlayer({
                PlayerID: socket.id,
                sessionToken,
                username
            });
        }
        catch(err){
            socket.emit("joinError", err.message);
            return;
        }

        session.roomCode = roomCode;
        session.role = "player";

        socket.join(roomCode);

        console.log(
            "Sending player:", player.username
        );

        io.to(room.hostID).emit(
            'playerJoined',
            player.username
        );

        socket.emit(
            'playerAdded'
        );


    });

    socket.on('registerSession', (token) => {

        token = socket.data.sessionToken || token;

        let session = typeof token === 'string' ? sessions.get(token) : undefined;

        if (!session) {
            token = crypto.randomBytes(32).toString('hex');

            session = {
                socketId: socket.id,
                roomCode: null,
                role: null
            };

            sessions.set(token, session);
        }

        clearTimeout(session.disconnectTimer);
        session.disconnectTimer = null;

        const previousSocketId = session.socketId;

        session.socketId = socket.id;
        socket.data.sessionToken = token;

        if (previousSocketId && previousSocketId !== socket.id) {
            delete roomHosts[previousSocketId];
            io.sockets.sockets.get(previousSocketId)?.disconnect(true);
        }

        const roomCode = session.roomCode;
        const room = rooms[roomCode];

        if (room) {
            let membershipRestored = false;

            if (session.role == "host" && room.hostSessionToken === token) {
                delete roomHosts[room.hostID];
                room.hostID = socket.id;
                roomHosts[socket.id] = roomCode;
                membershipRestored = true;
            }
            else if (session.role == "player") {
                const player = room.players.find(p => p.sessionToken === token);

                if (player) {
                    player.PlayerID = socket.id;
                    membershipRestored = true;
                }
            }

            if (membershipRestored) {
                socket.join(roomCode);
            }
            else {
                clearRoomSession(session);
            }
        }
        else {
            clearRoomSession(session);
        }

        socket.emit('sessionReady', token);

        if (session.roomCode) {
            const restoredRoom = rooms[session.roomCode];

            socket.emit('sessionRestored', {
                roomCode: session.roomCode,
                role: session.role,
                state: restoredRoom.state,
                hasSubmitted: room.currentRound.submissions.has(socket.data.sessionToken),
                players: restoredRoom.players.map(player => ({ username: player.username, score: player.score }))
            });

            if (session.role === "player") {
                const player = restoredRoom.players.find(p => p.sessionToken === token);
                if (player) {
                    socket.emit("playerCards", player.scale);
                }
            }

            if (session.role === "host" && restoredRoom.currentRound) {
                const scenario = restoredRoom.currentRound.scenario_card;
                socket.emit("roundStarted", {
                    cardID: scenario.cardID,
                    scenarioText: scenario.scenarioText
                });
            }
        }
        else{
            socket.emit('sessionReset');
        }
    })

    socket.on('disconnect', () => {
        const token = socket.data.sessionToken;
        const session = sessions.get(token);

        if (!session || session.socketId !== socket.id) {
            return;
        }

        session.socketId = null;
        delete roomHosts[socket.id];

        session.disconnectTimer = setTimeout(() => {
            if (sessions.get(token) !== session || session.socketId !== null) {
                return;
            }

            const roomCode = session.roomCode;
            const room = rooms[roomCode];

            if (room && session.role == "host" && room.hostSessionToken === token) {
                closeRoom(roomCode);
                console.log(`Room ${roomCode} closed: host timed out`);
                
            }
            else if (room && session.role == "player") {
                const player = room.removePlayer(token);

                if (player) {
                    io.to(roomCode).emit('playerLeft', player.username);
                }
            }

            sessions.delete(token);
        }, RECONNECT_GRACE_MS);
    })


    socket.on("startGame", async () => {
        const roomCode = roomHosts[socket.id];
        const room = rooms[roomCode];

        if(!room || room.hostID !== socket.id){
            socket.emit("startGameError", "Only the room host can start")
            return;
        }

        if (room.isPreparing) {
            socket.emit("startGameError", "Game setup is already running");
            return;
        }

        const countConnectedPlayers = () => room.players.filter(player => {
            const session = sessions.get(player.sessionToken);

            return session && session.socketId && io.sockets.sockets.has(session.socketId);
        }).length;

        try {
            room.validateStart(countConnectedPlayers());
        } catch (err) {
            socket.emit("startGameError", err.message);
            return;
        }

        room.isPreparing = true;

        try {
            const cards = await getCards();

            if (rooms[roomCode] !== room || room.hostID !== socket.id || !socket.connected) {
                return;
            }

            const connectedPlayers = countConnectedPlayers();
            room.validateStart(connectedPlayers);
            const deck = new Deck(cards);

            deck.shuffle();
            room.dealStartingCards(deck);
            room.deck = deck;
            room.startGame(connectedPlayers);
            room.startRound();

            io.to(roomCode).emit("stateChanged", room.state);

            const scenario = room.currentRound.scenario_card;

            io.to(room.hostID).emit("roundStarted", {
                cardID: scenario.cardID,
                scenarioText: scenario.scenarioText
            });
            
            room.players.forEach(player => {
                io.to(player.PlayerID).emit("playerCards", player.scale)
            });

        } catch (err) {
            socket.emit("startGameError", err.message);
            return;
        } finally {
            room.isPreparing = false;
        }


    });

    socket.on("leaveRoom", ()=>{
        const token = socket.data.sessionToken;
        const session = sessions.get(token);

        if (!session || session.socketId !== socket.id) {
            socket.emit("sessionError", "Session not ready");
            return;
        }

        const roomCode = session.roomCode;
        const room = rooms[roomCode];

        if(room && session.role === "host" && room.hostSessionToken === token){
            closeRoom(roomCode);
            return;
        }

        if (roomCode) {
            socket.leave(roomCode);
        }

        if(room && session.role === "player"){
        const player = room.removePlayer(token);

        if (!(player === null)) {
            io.to(roomCode).emit("playerLeft", player.username);
        }}

        clearRoomSession(session);
        socket.emit("sessionReset");
    })

    socket.on("submitPlacement", (position, acknowledge)=> {
        
        if (typeof(acknowledge) != "function") {
            return;
        }

        try
        {
            const token = socket.data.sessionToken;
            const session = sessions.get(token);

            if (!session || session.socketId !== socket.id || session.role !== "player") {
                throw new Error("Player is not in this room");
            }

            const room = rooms[session.roomCode];

            if (!room || room.state !== "playing" || !room.currentRound) {
                throw new Error("No active round");
            }

            const player = room.players.find(player => player.sessionToken === token);

            if (!player) {
                throw new Error("Player not in this room");
            }

            room.currentRound.submit(player, position);
            acknowledge({success: true});
        } 
        catch (error) 
        {
            acknowledge({
                success: false,
                message: error.message
            }) ;           
        }

    });

    console.log("Connection established")

});

server.listen(8000, () => console.log('Server running in http://localhost:8000'));



