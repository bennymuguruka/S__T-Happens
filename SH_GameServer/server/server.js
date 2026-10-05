const express = require('express');
var app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, { cors: { origin: '*' } });
const { generateRoomCode, rooms, roomHosts, findRoomByHost } = require('./rooms');
const crypto = require('crypto');

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
            const roomCode = generateRoomCode();
            rooms[roomCode] = {
                hostID: socket.id,
                hostSessionToken: sessionToken,
                players: [],
                state: 'lobby'

            };

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
        if (!room) {
            socket.emit('joinError', "code");
            return;
        };

        if (room.state !== 'lobby') {
            socket.emit('joinError', 'This game has already started.');
            return;
        }

        if(typeof username !== "string"){
            socket.emit("joinError", 'Enter a valid username.');
            return;
        }

        username = username.trim();

        if(username.length < 1 || username.length> 20){
            socket.emit('joinError', 'Username must be between 1 and 20 characters.');
            return;
        }

        if ((room.players.some((player) => player.PlayerID === socket.id))) {

            console.log("Connection already exists");
            return;
        }
        else if ((room.players.some((player) => player.username === username))) {
            socket.emit('joinError', "username");
            return;
        }

        room.players.push({
            PlayerID: socket.id,
            sessionToken,
            username,
            score: 0
        });

        session.roomCode = roomCode;
        session.role = "player";

        socket.join(roomCode);

        console.log(
            "Sending player:",
            room.players.filter(player => player.PlayerID == socket.id).map(player => player.username)
        );

        const player = room.players.find(p => p.PlayerID === socket.id)

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
                socketID: socket.id,
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
                players: restoredRoom.players.map(player => ({ username: player.username, score: player.score }))
            })
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
                const player = room.players.find(p => p.sessionToken === token);

                room.players = room.players.filter(p => p.sessionToken !== token);

                if (player) {
                    io.to(roomCode).emit('playerLeft', player.username);
                }
            }

            sessions.delete(token);
        }, RECONNECT_GRACE_MS);
    })


    socket.on("startGame", () => {
        if (roomHosts[socket.id]) {
            const roomCode = roomHosts[socket.id];
            console.log("game start button clicked");


            if (rooms[roomCode].state === 'lobby' && (rooms[roomCode].players.reduce((sum, num) => sum + 1, 0)) >= 2) {
                rooms[roomCode].state = 'playing';
                console.log(rooms[roomCode].state);
                io.to(roomCode).emit(
                    'stateChanged', rooms[roomCode].state
                );
                console.log("Sending state Change");

                return;
            }

            socket.emit('stateChanged', "Not enough players");

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

        if (room && session.role === "player") {
            const player = room.players.find(
                p => p.sessionToken === token
            );

            room.players = room.players.filter(
                p => p.sessionToken !== token
            );

            if (player) {
                io.to(roomCode).emit("playerLeft", player.username);
            }
        }

        clearRoomSession(session);
        socket.emit("sessionReset");
    })

    console.log("Connection established")

});

server.listen(8000, () => console.log('Server running in http://localhost:8000'));



