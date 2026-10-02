
//----------------------LOBBY PAGE---------------------------------------------
const form = document.querySelector('form');
form.addEventListener('submit',()=> {

    event.preventDefault();

    const roomCode = document.getElementById('roomCode').value;
    const username = document.getElementById('username').value;

    socket.emit('join room', roomCode, username);

});

socket.on('playerAdded', ()=>{
    {window.open('wait.html', '_self');}
});

socket.on('stateChanged', (state)=>
{
    if(state === "playing"){
        window.open('game.html', '_self');
    }
}
)