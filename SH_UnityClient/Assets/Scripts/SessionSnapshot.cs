using UnityEngine;

public class SessionSnapshot
{
    public string roomCode { get; set;  }
    public string role { get; set; }
    public string state { get; set; }
    public PlayerSnapshot[] players { get; set; }
}
