//Entry point to app
const express = require('express');
var app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);


app.get('/', (req, res) => {
    res.send("S**T Happens Server Running");
});

io.on('connection', (socket) => {
    console.log("Player Connected")

});

server.listen(8000, () => console.log('Server running in http://localhost:8000'));



