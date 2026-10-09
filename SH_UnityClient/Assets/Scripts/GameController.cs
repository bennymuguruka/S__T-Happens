using UnityEngine;
using TMPro;
public class GameController : MonoBehaviour
{
    [SerializeField] private TextMeshProUGUI scenarioText;
    private SessionController sessionController;

    // Start is called once before the first execution of Update after the MonoBehaviour is created
    void Start()
    {
        sessionController = NetworkManager.instance.GetComponent<SessionController>();
        sessionController.RoundChanged += DisplayRound;

        if (sessionController.CurrentRound != null)
        {
            DisplayRound(sessionController.CurrentRound);
        }
    }

    private void OnDestroy()
    {
        if (sessionController != null)
        {
            sessionController.RoundChanged -= DisplayRound;
        }
    }

    private void DisplayRound(RoundSnapshot snapshot)
    {
        scenarioText.text = snapshot.scenarioText;
    }

    // Update is called once per frame
    void Update()
    {
        
    }
}
