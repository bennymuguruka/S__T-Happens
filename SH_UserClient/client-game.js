const socket = io(`http://${window.location.hostname}:8000`);

const params = new URLSearchParams(window.location.search);
const roomCodeFromUrl = params.get('roomCode');

if(roomCodeFromUrl){
    document.getElementById("roomCode").value = roomCodeFromUrl;
}

//Reconnect Handling
let sessionReady = false;

socket.on('connect', ()=> {
    sessionReady = false;
    socket.emit('registerSession', sessionStorage.getItem("sessionToken"));
});

socket.on('sessionReady', token=> {
    sessionStorage.setItem('sessionToken', token);
    sessionReady = true;
})

socket.on('disconnect', ()=>{
    sessionReady = false;
})

socket.on('sessionRestored', room =>{
    console.log('Session restored:', room);
    renderRoomState(room.state);
});

socket.on('roomClosed', () => {
    renderRoomState('closed');
})

//Join Page
    const form = document.querySelector("#joinForm");
    form.addEventListener('submit', (event)=> {

        event.preventDefault();

        if (!sessionReady) {
            console.log("waiting for server connection");
            return;
        }
        
     const RoomCode = document.getElementById("roomCode").value;
    const username = document.getElementById("Username").value;
        socket.emit('join room', RoomCode, username);
    })

    socket.on('joinError', error =>{
        if (error === "username") {
            document.getElementById("usernameError").textContent = "Username is already taken";
        }
        else if(error === "code"){
            document.getElementById("codeError").textContent = "Wrong room code";
        }
    })

    socket.on('playerAdded', ()=> {
        renderRoomState('lobby');
    });

    socket.on('joinError', message => {
        document.getElementById('statusMessage').textContent = message;
    })

//State Change
socket.on('stateChanged', renderRoomState);

function renderRoomState(state) {
    const status = document.getElementById("statusMessage");
    const joinSection = document.getElementById('Join');

    switch(state){
        case "lobby":
            joinSection.hidden = true;
            status.textContent = "Waiting for the host to start game";
            break;
        case "playing":
            joinSection.hidden = true;
            status.textContent = "Playing game"
            break;
        case "finished":
            joinSection.hidden =true;
            status.textContent = 'Game finished.';
            break;
          case 'closed':
            joinSection.hidden = false;
            status.textContent = 'The room has closed.';
            document.getElementById('roomCode').value = '';
            break;

        default:
            console.warn('Unknown room state:', state);
            break;
    }
}