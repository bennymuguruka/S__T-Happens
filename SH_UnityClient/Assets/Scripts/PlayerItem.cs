using UnityEngine;
using TMPro;
using UnityEngine.UI;

public class PlayerItem : MonoBehaviour
{
    [SerializeField] private TextMeshProUGUI initialText;
    [SerializeField] private TextMeshProUGUI usernameText;
    [SerializeField] private Image circleImage;


    public void Setup(string username)
    {
        if (string.IsNullOrWhiteSpace(username))
        {
            Debug.LogWarning("Cannot display a player with an empty username.");
            return;
        }
        usernameText.text = username;
        initialText.text = username[0].ToString().ToUpper();

        circleImage.color = Random.ColorHSV(
            0f, 1f,
            0.6f, 1f,
            0.7f, 1f
        );
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
