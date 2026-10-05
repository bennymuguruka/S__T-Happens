using UnityEngine;
using System;
using UnityEngine.SceneManagement;
using System.Linq;

public class SessionController : MonoBehaviour
{
    [SerializeField] private NetworkManager networkManager;
    public SessionSnapshot CurrentSession {  get; private set; }
    public event Action<SessionSnapshot> SessionChanged;

    private void OnEnable()
    {
        networkManager.SessionRestored += HandleSessionRestored;
        networkManager.SessionReset += HandleSessionReset;
        networkManager.RoomCreated += HandleRoomCreated;
        networkManager.PlayerJoined += HandlePlayerJoined;
        networkManager.PlayerLeft += HandlePlayerLeft;
        networkManager.StateChanged += HandleStateChanged;
    }

    private void OnDisable()
    {
        networkManager.SessionRestored -= HandleSessionRestored;
        networkManager.SessionReset -= HandleSessionReset;
        networkManager.RoomCreated -= HandleRoomCreated;
        networkManager.PlayerJoined -= HandlePlayerJoined;
        networkManager.PlayerLeft -= HandlePlayerLeft;
        networkManager.StateChanged -= HandleStateChanged;
    }

    private void HandleSessionReset()
    {
        CurrentSession = null;

        if(SceneManager.GetActiveScene().name != "Menu")
        {
            SceneManager.LoadScene("Menu");
        }
    }

    private void HandleRoomCreated(string roomCode)
    {
        CurrentSession = new SessionSnapshot
        {
            roomCode = roomCode,
            role = "host",
            state = "lobby",
            players = Array.Empty<PlayerSnapshot>()
        };

        ApplySessionState();
       
    }

    private void HandlePlayerJoined(string username)
    {
        if (CurrentSession == null)
        {
            return;
        }

        var players = CurrentSession.players ?? Array.Empty<PlayerSnapshot>();

        if (players.Any(players => players.username == username))
        {
            return;
        }

        CurrentSession.players = players.Append(new PlayerSnapshot
        {
            username = username,
            score = 0
        }).ToArray();

        SessionChanged?.Invoke(CurrentSession);
    }

    private void HandlePlayerLeft(string username)
    {
        if (CurrentSession == null)
        {
            return;
        }

        var players = CurrentSession.players ?? Array.Empty<PlayerSnapshot>();

        CurrentSession.players = players.Where(players =>  players.username != username).ToArray();

        SessionChanged?.Invoke(CurrentSession);
    }

    private void HandleSessionRestored(SessionSnapshot snapshot)
    {
        CurrentSession = snapshot;
        ApplySessionState();
    }

    private void HandleStateChanged(string state)
    {
        if (CurrentSession == null)
        {
            return;
        }

        CurrentSession.state = state;
    }

    private void ApplySessionState()
    {
        if (CurrentSession == null)
        {
            return;
        }

        string targetScene;

        switch (CurrentSession.state)
        {
            case "lobby":
                targetScene = "lobby";
                break;
            case "playing":
                targetScene = "Game Scene";
                break;
            default:
                Debug.LogWarning($"Unknown session state: {CurrentSession.state}");
                return;
        }

        if (SceneManager.GetActiveScene().name != targetScene)
        {
            SceneManager.LoadScene(targetScene);
        }
        else
        {
            SessionChanged?.Invoke(CurrentSession);
        }
    }


    // Start is called once before the first execution of Update after the MonoBehaviour is created
    void Start()
    {
        
    }

    // Update is called once per frame
    void Update()
    {
        
    }
}
