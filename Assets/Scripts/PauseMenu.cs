using UnityEngine;

public class PauseMenu : MonoBehaviour
{
    public void Resume()
    {
        GameManager.Instance.ResumeGame();
    }

    public void Restart()
    {
        GameManager.Instance.RestartGame();
    }

    public void MainMenu()
    {
        GameManager.Instance.BackToMenu();
    }
}
