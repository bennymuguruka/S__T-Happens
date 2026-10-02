using UnityEngine;
using UnityEngine.UI;
using TMPro;
using ZXing;
using ZXing.QrCode;
using System.Collections.Generic;
using System.Linq;

public class LobbyController : MonoBehaviour
{
    [SerializeField] private TextMeshProUGUI roomCodeText;
    [SerializeField] private RawImage QrCodeImage;
    [SerializeField] private RectTransform playerArea;
    [SerializeField] private GameObject playerItemPrefab;

    private SessionController sessionController;

    private Dictionary<string, GameObject> players = new();

    void Start()
    {
        var network = NetworkManager.instance;

        network.RegisterLobbyController(this);

        sessionController = network.GetComponent<SessionController>();
        sessionController.SessionChanged += RefreshLobby;

        if(sessionController.CurrentSession != null)
        {
            RefreshLobby(sessionController.CurrentSession);
        }
    }

    public void SetRoomCode(string roomCode)
    {
        Debug.Log("SetRoomCode to" + roomCode);
        roomCodeText.text = $"Room Code: \n{roomCode}";
        Debug.Log("Text component now contains: " + roomCodeText.text);
        string joinUrl = $"http://192.168.0.116:5500/SH_UserClient/client-game.html?roomCode={roomCode}";

        GenerateQRCode(joinUrl);
    }

    public void GenerateQRCode(string text)
    {
        var writer = new BarcodeWriter
        {
            Format = BarcodeFormat.QR_CODE,
            Options = new ZXing.QrCode.QrCodeEncodingOptions
            {
                Width = 256,
                Height = 256
            }
        };

        Color32[] pixels = writer.Write(text);

        Texture2D texture = new Texture2D(256, 256);
        texture.SetPixels32(pixels);
        texture.Apply();

        QrCodeImage.texture = texture;
    }


    public void AddPlayer(string username)
    {
        
        if (players.ContainsKey(username))
            return;


        GameObject player = Instantiate(playerItemPrefab, playerArea);
        player.GetComponent<PlayerItem>().Setup(username);
        players.Add(username, player);
    }

    public void RemovePlayer(string username)
    {
        if (!players.ContainsKey(username))
            return;

        Destroy(players[username]);
        players.Remove(username);
    }

    public void OnStartClick()
    {
        NetworkManager.instance.StartGame();
    }

    public void OnBackClick()
    {
        NetworkManager.instance.StopGame();
    }

    private void RefreshLobby(SessionSnapshot snapshot)
    {
        if(snapshot.state != "lobby")
        {
            return;
        }

        SetRoomCode(snapshot.roomCode);

        foreach (var playerObject in players.Values) 
        {
            Destroy(playerObject);
        }

        players.Clear();

        if(snapshot.players == null)
        {
            return;
        }

        foreach(var player in snapshot.players)
        {
            AddPlayer(player.username);
        }
    }

    private void OnDestroy()
    {
        if (sessionController != null)
        {
            sessionController.SessionChanged -= RefreshLobby;
        }
    }

}

    

