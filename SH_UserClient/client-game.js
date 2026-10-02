const socket = io(`http://${window.location.hostname}:8000`);

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
});

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

    socket.on('playerAdded', ()=> {
        console.log(`Player has been added`);
    });