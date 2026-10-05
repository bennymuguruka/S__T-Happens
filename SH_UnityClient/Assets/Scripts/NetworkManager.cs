using TMPro;
using System;
using System.Collections.Generic;
using System.Collections;
using UnityEngine;
using SocketIOClient;
using SocketIOClient.Transport;
using UnityEngine.SceneManagement;

public class NetworkManager : MonoBehaviour
{
    private SocketIOUnity socket;
    private LobbyController lobbyController;
    private string roomCode;
    public static NetworkManager instance;
    public string stateMessage;
    private string sessionToken = "";
    public event Action<SessionSnapshot> SessionRestored;
    public event Action SessionReset;

    // Start is called once before the first execution of Update after the MonoBehaviour is created
    void Start()
    {
        ConnectToServer();
        Events();
        socket.Connect();
    }

    void ConnectToServer()
    {
        Debug.Log("NetworkManager Started");
        Debug.Log("Connection starting");
        var uri = new Uri("http://localhost:8000");
        socket = new SocketIOUnity(uri, new SocketIOOptions
        {

            Query = new Dictionary<string, string>
            {
                {"token", "Unity" }
            },
            Transport = SocketIOClient.Transport.TransportProtocol.WebSocket
        });

        Debug.Log("Socket Created");

        socket.OnConnected += (sender, e) =>
        {
            Debug.Log("Connected");
            socket.Emit("registerSession", sessionToken);
        };
    }

    void Events()
    {
        socket.OnUnityThread("roomCreated", (response) => {
            roomCode = response.GetValue<string>();
            Debug.Log("Room created: " + roomCode);

            SceneManager.LoadScene("Lobby");

            if (lobbyController != null)
            {
                lobbyController.SetRoomCode(roomCode);
            }
        });

        socket.OnUnityThread("playerJoined", (response) =>
        {
            Debug.Log("player list recevied");
            string player = response.GetValue<string>();
            lobbyController.AddPlayer(player);
        });

        socket.OnUnityThread("playerLeft", (response) =>
        {
            string player = response.GetValue<string>();
            Debug.Log($"player: {player} will be removed");
            lobbyController.RemovePlayer(player);
        });

        socket.OnUnityThread("roomClosed", (response) =>
        {
            Debug.Log("Room closed");
        });

        socket.OnUnityThread("stateChanged", (response) =>
        {
            string state = response.GetValue<string>();

            if (state == "playing")
            {
                SceneManager.LoadScene("Game Scene");
                Debug.Log("On to Game Screen");
            }
            else
            {
                stateMessage = state;
                Debug.Log(stateMessage);
            }
        });

        socket.OnUnityThread("sessionReady", response =>
        {
            sessionToken = response.GetValue<string>();
            Debug.Log("Session Ready");
        });

        socket.OnUnityThread("sessionRestored", response =>
        {
            var snapshot = response.GetValue<SessionSnapshot>();
            SessionRestored?.Invoke(snapshot);
        });

        socket.OnUnityThread("sessionReset", (response) =>
        {
            roomCode = "";
            SessionReset?.Invoke();
        });

    }

    public void CreateRoom() {
        socket.Emit("createRoom");
    }

    public void StartGame()
    {
        socket.Emit("startGame");
    }

    public void StopGame()
    {
        socket.Emit("leaveRoom");
    }

    void Awake()
    {
        if (instance != null && instance != this)
        {
            Destroy(gameObject);
            return;
        }
        instance = this;
        DontDestroyOnLoad(gameObject);
    }

    public void RegisterLobbyController(LobbyController ui)
    {
        Debug.Log("Lobby registered");
        lobbyController = ui;

        if (!string.IsNullOrEmpty(roomCode))
        {
            Debug.Log("Updating Ui with code: "+roomCode);
            lobbyController.SetRoomCode(roomCode);
        }

    }


    // Update is called once per frame
    void Update()
    {

    }


}
