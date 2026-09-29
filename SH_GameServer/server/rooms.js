let rooms = {};
let roomHosts = {};

const crypto = require('crypto');

function generateRoomCode() {
    return crypto.randomBytes(3).toString('hex').toLocaleUpperCase();
}

function findRoomByHost(hostID) {
    return roomHosts[hostID] || null;
}

module.exports = {generateRoomCode, rooms, roomHosts, findRoomByHost};

