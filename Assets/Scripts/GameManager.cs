using UnityEngine;
using UnityEngine.SceneManagement;

public class GameManager : MonoBehaviour
{
    public static GameManager Instance;

    public GameObject winPanel;
    public GameObject losePanel;

    private bool gameOver = false;

    void Awake()
    {
        if (Instance == null)
        {
            Instance = this;
        }
        else
        {
            Destroy(gameObject);
        }
    }

    void Update()
    {
        if (gameOver)
        {
            return;
        }

        bool playerAlive = false;
        bool enemyAlive = false;

        Health[] allHealth = FindObjectsOfType<Health>();
        foreach (Health h in allHealth)
        {
            if (h == null)
            {
                continue;
            }

            if (h.gameObject.CompareTag("Player") && h.IsAlive)
            {
                playerAlive = true;
            }

            if (h.gameObject.CompareTag("Enemy") && h.IsAlive)
            {
                enemyAlive = true;
            }
        }

        if (!playerAlive)
        {
            EndGame(false);
        }
        else if (!enemyAlive)
        {
            EndGame(true);
        }
    }

    void EndGame(bool playerWon)
    {
        gameOver = true;

        if (winPanel != null)
        {
            winPanel.SetActive(playerWon);
        }

        if (losePanel != null)
        {
            losePanel.SetActive(!playerWon);
        }

        Time.timeScale = 0f;
    }

    public void RestartGame()
    {
        Time.timeScale = 1f;
        SceneManager.LoadScene(SceneManager.GetActiveScene().buildIndex);
    }
}
