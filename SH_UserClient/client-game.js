const socket = io(`http://${window.location.hostname}:8000`);

const params = new URLSearchParams(window.location.search);
const roomCodeFromUrl = params.get('roomCode');

if(roomCodeFromUrl){
    document.getElementById("roomCode").value = roomCodeFromUrl;
}

//Reconnect Handling
let sessionReady = false;

const connectionStatus = document.getElementById("connectionStatus");
const joinButton = document.getElementById("joinButton");

socket.on('connect', ()=> {
    sessionReady = false;
    joinButton.disabled = true;
    connectionStatus.textContent = "Restoring session...";

    socket.emit('registerSession', sessionStorage.getItem("sessionToken"));
});

socket.on('sessionReady', token=> {
    sessionStorage.setItem('sessionToken', token);

    sessionReady = true;
    joinButton.disabled = false;
    connectionStatus.textContent = "";
});

socket.on('disconnect', reason =>{
    sessionReady = false;
    joinButton.disabled = true;

    if (reason === "io server disconnect" || reason === "io client disconnect") {
        connectionStatus.textContent = "Disconnected. Refresh to reconnect."
    }
    else{
        connectionStatus.textContent = "Connection lost. Reconnecting...";
    }
});

socket.on("connect_error", () =>{
    sessionReady = false;
    joinButton.disabled = true;
    connectionStatus.textContent = "Cannot reach the server. Retrying...";
});

socket.on("sessionError", message =>{
    document.getElementById("statusMessage").textContent = message;
});

socket.on('sessionRestored', room =>{
    console.log('Session restored:', room);
    renderRoomState(room.state);
});

socket.on('roomClosed', () => {
    renderRoomState('closed');
});

socket.on('sessionReset', ()=>{
    gameScreen.hidden = true;
    gameScreen.replaceChildren();
    document.getElementById("Join").hidden = false;
    document.getElementById("statusMessage").textContent = "";
    document.getElementById("codeError").textContent = "";
    document.getElementById("usernameError").textContent = "";
    document.getElementById("submittedScreen").hidden = true;
    submissionPending = false;
    hasSubmitted = false;
});

//Join Page
    const form = document.querySelector("#joinForm");
    document.getElementById("statusMessage").textContent = "";
    form.addEventListener('submit', (event)=> {

        event.preventDefault();

        if (!sessionReady) {
            console.log("waiting for server connection");
            return;
        }
        
     const RoomCode = document.getElementById("roomCode").value;
    const username = document.getElementById("Username").value;
        socket.emit('join room', RoomCode, username);
    });

    socket.on('joinError', error =>{
        if (error === "username") {
            document.getElementById("usernameError").textContent = "Username is already taken";
        }
        else if(error === "code"){
            document.getElementById("codeError").textContent = "Wrong room code";
        }
        else{
            document.getElementById('statusMessage').textContent = error;
        }
    });

    socket.on('playerAdded', ()=> {
        renderRoomState('lobby');
    });


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
            gameScreen.hidden = hasSubmitted;
            document.getElementById("submittedScreen").hidden = !hasSubmitted;
            status.textContent = "Playing game"
            break;
        case "finished":
            joinSection.hidden =true;
            status.textContent = 'Game finished.';
            break;
          case 'closed':
            gameScreen.hidden = true;
            gameScreen.replaceChildren();
            document.getElementById("submittedScreen").hidden = true;
            submissionPending = false;
            hasSubmitted = false;
            joinSection.hidden = false;
            status.textContent = 'The room has closed.';
            document.getElementById('roomCode').value = '';
            break;

        default:
            console.warn('Unknown room state:', state);
            break;
    }
}

//Game Screen
const gameScreen = document.getElementById("gameScreen");
function renderCards(cards){
    gameScreen.replaceChildren(); 
    cards.forEach((card, placementIndex) => {

        const placementButton = document.createElement("button");
        placementButton.textContent = "Place here";

        placementButton.addEventListener("click", () => {submitPlacement(placementIndex)})

        const cardArea = document.createElement("div");
        const text = document.createElement("p");
        const index = document.createElement("p");
     
        text.textContent = card.scenarioText;
        index.textContent = card.miseryIndex;

        cardArea.append(text, index);
        gameScreen.append(placementButton, cardArea);

    });

    const finalButton = document.createElement("button");
    finalButton.textContent = "Place here";

    finalButton.addEventListener("click", () => {submitPlacement(cards.length)});

    gameScreen.append(finalButton);
}

let submissionPending = false;
let hasSubmitted = false;

function setButtonsDisabled(isDisabled) {
    gameScreen.querySelectorAll("button").forEach(button =>{
        button.disabled = isDisabled
    });
}

function submitPlacement(position) {
    if (submissionPending || !sessionReady || hasSubmitted) {
            return;
        }

    submissionPending = true;
    setButtonsDisabled(true);
    socket.emit("submitPlacement",position, response =>{
        submissionPending = false;

        if (response.success) {
            document.getElementById("statusMessage").textContent = "Answer Submitted";
            hasSubmitted = true;
            gameScreen.hidden = true;
            document.getElementById("submittedScreen").hidden = false;
        }
        else{
            setButtonsDisabled(false);
            document.getElementById("statusMessage").textContent = response.message;
            hasSubmitted = false;
        }
    })
}
socket.on("playerCards", cards =>{
    renderCards(cards);
})
