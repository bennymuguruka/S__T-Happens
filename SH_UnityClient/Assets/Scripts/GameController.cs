using UnityEngine;
using TMPro;
public class GameController : MonoBehaviour
{
    [SerializeField] private TextMeshProUGUI scenarioText;
    [SerializeField] private TextMeshProUGUI miseryText;
    private SessionController sessionController;

    // Start is called once before the first execution of Update after the MonoBehaviour is created
    void Start()
    {
        sessionController = NetworkManager.instance.GetComponent<SessionController>();
        sessionController.RoundChanged += DisplayRound;
        sessionController.RoundRevealChanged += RoundReveal;

        if (sessionController.CurrentRound != null)
        {
            DisplayRound(sessionController.CurrentRound);
        }

        if (sessionController.CurrentReveal != null)
        {
            RoundReveal(sessionController.CurrentReveal);
        }
    }

    private void OnDestroy()
    {
        if (sessionController != null)
        {
            sessionController.RoundChanged -= DisplayRound;
            sessionController.RoundRevealChanged -= RoundReveal;
        }
    }

    private void DisplayRound(RoundSnapshot snapshot)
    {
        miseryText.text = "??";
        scenarioText.text = snapshot.scenarioText;
    }

    private void RoundReveal(RoundRevealSnapshot snapshot)
    {
        miseryText.text = snapshot.miseryIndex.ToString("F1");
    }

    // Update is called once per frame
    void Update()
    {
        
    }
}
