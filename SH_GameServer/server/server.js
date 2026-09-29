//Entry point to app
const express = require('express');
var app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, { cors: { origin: '*' } });
const { generateRoomCode, rooms, roomHosts, findRoomByHost } = require('./rooms')


app.get('/', (req, res) => {
    res.send("S**T Happens Server Running");
});

io.on('connection', (socket) => {

    socket.on('createRoom', () => {
        if (!(Object.keys(roomHosts).includes(socket.id))) {
            const roomCode = generateRoomCode();
            rooms[roomCode] = {
                hostID: socket.id,
                players: [],
                state: 'lobby'

            };

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

        if (!room) {
            console.log('wrong room code');
            return;
        };

        if ((room.players.some((player) => room.players.PlayerID == socket.id))) {

            console.log("Connection already exists");
            return;
        }
        else if ((room.players.some((player) => room.players.username == username))) {
            console.log("Username taken");
            return;
        }

        room.players.push({
            PlayerID: socket.id,
            username,
            score: 0
        })

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

        io.to(socket.io).emit(
            'playerAdded'
        );


    });

    socket.on('disconnect', () => {
        const roomCode = roomHosts[socket.id];

        if (roomCode) {

            console.log('Host left game: ' + roomCode);
            delete rooms[roomCode];
            delete roomHosts[socket.id];

            socket.emit('roomClosed');
            return
        }

        if (!roomCode || !rooms[roomCode])
            return;

        const player = rooms[roomCode].players.find(
            p => p.PlayerID === socket.id
        );

        if (!player)
            return;
        io.to(roomCode).emit('playerLeft', player.username);

        rooms[roomCode].players = rooms[roomCode].players.filter(
            p => p.PlayerID !== socket.id
        );

        console.log(`${player.username} left the game`);
    });


    socket.on("startGame", () => {
        if (roomHosts[socket.id]) {
            const roomCode = roomHosts[socket.id];
            console.log("game start button clicked");
            

            if (rooms[roomCode].state === 'lobby' && (rooms[roomCode].players.reduce((sum, num) => sum + 1, 0)) >= 2) {
                rooms[roomCode].state = 'playing';
                console.log(rooms[roomCode].state);
                socket.emit(
                    'stateChanged', rooms[roomCode].state
                );
                console.log("Sending state Change");
                
                return;
            }
            
            socket.emit('stateChanged', "Not enough players");

        }
    })

    console.log("Connection established")

});

server.listen(8000, () => console.log('Server running in http://localhost:8000'));



