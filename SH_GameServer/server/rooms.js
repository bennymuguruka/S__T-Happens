let rooms = {};
let roomHosts = {};
const {Round} = require("./round");

const crypto = require('crypto');

function generateRoomCode() {
    return crypto.randomBytes(3).toString('hex').toLocaleUpperCase();
}

class Room{
    constructor(roomCode, hostSessionToken) {
        this.roomCode = roomCode;
        this.hostSessionToken = hostSessionToken;
        this.players = [];
        this.state = "lobby";
        this.isPreparing = false;
        this.deck = null;
        this.currentRound = null;
    }

    addPlayer(player){
        if (this.state !== 'lobby') {
            throw new Error('This game has already started.');
        };

        if(typeof player.username !== "string"){
            throw new Error('Enter a valid username.');
        };

        const username = player.username.trim();

        if(username.length < 1 || username.length> 20){
            throw new Error('Username must be between 1 and 20 characters.');
        };

        if ((this.players.some((p) => p.PlayerID === player.PlayerID)) || (this.players.some((p) => p.sessionToken === player.sessionToken))) {
            throw new Error("Connection already exists");
        }
        else if ((this.players.some((p) => p.username === username))) {
            throw new Error("username");
        };

        const addedPlayer = {
            PlayerID: player.PlayerID,
            sessionToken: player.sessionToken,
            username,
            scale: [],
            score: 0

        }

        this.players.push(addedPlayer);
        return addedPlayer;
    }

    removePlayer(sessionToken){
        const playerLeft = this.players.find(p => p.sessionToken === sessionToken);

        if (playerLeft === undefined) return null;

        this.players = this.players.filter(p => p.sessionToken !== playerLeft.sessionToken);

        return playerLeft;
    }

    validateStart(connectedPlayers){
        if (this.state !== "lobby") {
            throw new Error("Game already started");
        }

        if(connectedPlayers < 2){
            throw new Error("Not enough players");
        }

    }

    startGame(connectedPlayers){
        this.validateStart(connectedPlayers);
        this.state = "playing";
    }

    dealStartingCards(deck){
        if (this.state != "lobby") {
            throw new Error("Game already started");
        }

        if (this.players.some(player => player.scale.length !== 0)) {
            throw new Error("Starting cards have been dealt"); 
        }

        if (deck.cards.length < (2 * this.players.length) + 1) {
            throw new Error("Not enough cards")
        }

        this.players.forEach(player => {
            for (let i = 0; i < 2; i++) {
                player.scale.push(deck.draw());
            }

            player.scale.sort((a,b) => a.miseryIndex - b.miseryIndex);
        });
    }

    startRound(){
        if (this.state !== "playing") {
            throw new Error("Game hasn't started");
        }

        let card = this.deck.draw();

        const round = new Round(card);
        this.currentRound = round;
    }
}

module.exports = {generateRoomCode, rooms, roomHosts, Room};

