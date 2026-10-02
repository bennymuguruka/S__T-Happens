const socket = io("http://localhost:8000");

//-----------------------MAIN PAGE---------------------------------------------
const joinGame = document.querySelector('#joinGame');
joinGame.addEventListener( "click", 
    ()=>{
        window.open('join.html', '_self');});
