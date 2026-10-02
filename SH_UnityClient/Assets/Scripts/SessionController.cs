using UnityEngine;
using System;
using UnityEngine.SceneManagement;

public class SessionController : MonoBehaviour
{
    [SerializeField] private NetworkManager networkManager;
    public SessionSnapshot CurrentSession {  get; private set; }
    public event Action<SessionSnapshot> SessionChanged;

    private void OnEnable()
    {
        networkManager.SessionRestored += HandleSessionRestored;
    }

    private void OnDisable()
    {
        networkManager.SessionRestored -= HandleSessionRestored;
    }

    private void HandleSessionRestored(SessionSnapshot snapshot)
    {
        CurrentSession = snapshot;

        string targetScene;

        switch (snapshot.state)
        {
            case "lobby":
                targetScene = "Lobby";
                break;
            case "playing":
                targetScene = "Game Scene";
                break;
            default:
                Debug.LogWarning($"Unknown session state: {snapshot.state}");

                return;
        }

        if (SceneManager.GetActiveScene().name != targetScene)
        {
            SceneManager.LoadScene(targetScene);
        }
        else
        {
            SessionChanged?.Invoke(snapshot);
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
