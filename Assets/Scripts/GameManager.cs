using UnityEngine;
using UnityEngine.SceneManagement;

public class GameManager : MonoBehaviour
{
    public static GameManager Instance;

    public GameObject player;
    public GameObject winPanel;
    public GameObject losePanel;
    public GameObject pausePanel;

    public int totalKills = 0;

    private bool gameOver = false;
    private bool isPaused = false;

    private void Awake()
    {
        if (Instance == null)
            Instance = this;
        else
            Destroy(gameObject);
    }

    private void Start()
    {
        Time.timeScale = 1f;
        if (player == null)
            player = GameObject.FindGameObjectWithTag("Player");
    }

    private void Update()
    {
        if (gameOver)
            return;

        if (Input.GetKeyDown(KeyCode.Escape))
            TogglePause();

        if (player == null)
            player = GameObject.FindGameObjectWithTag("Player");

        bool playerAlive = player != null && player.GetComponent<Health>() != null && player.GetComponent<Health>().IsAlive;

        if (!playerAlive)
        {
            EndGame(false);
            return;
        }

        int aliveEnemies = 0;
        GameObject[] allObjects = FindObjectsOfType<GameObject>();

        foreach (GameObject obj in allObjects)
        {
            if (obj.CompareTag("Enemy"))
            {
                Health health = obj.GetComponent<Health>();
                if (health != null && health.IsAlive)
                    aliveEnemies++;
            }
        }

        if (aliveEnemies <= 0)
            EndGame(true);
    }

    public void AddKill()
    {
        totalKills++;
    }

    public void TogglePause()
    {
        isPaused = !isPaused;
        Time.timeScale = isPaused ? 0f : 1f;

        if (pausePanel != null)
            pausePanel.SetActive(isPaused);

        Cursor.lockState = isPaused ? CursorLockMode.None : CursorLockMode.Locked;
        Cursor.visible = isPaused;
    }

    public void ResumeGame()
    {
        isPaused = false;
        Time.timeScale = 1f;

        if (pausePanel != null)
            pausePanel.SetActive(false);

        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;
    }

    public void EndGame(bool playerWon)
    {
        gameOver = true;
        Time.timeScale = 0f;

        if (winPanel != null)
            winPanel.SetActive(playerWon);

        if (losePanel != null)
            losePanel.SetActive(!playerWon);

        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;
    }

    public void RestartGame()
    {
        Time.timeScale = 1f;
        SceneManager.LoadScene(SceneManager.GetActiveScene().buildIndex);
    }

    public void BackToMenu()
    {
        Time.timeScale = 1f;
        SceneManager.LoadScene("MainMenu");
    }
}
