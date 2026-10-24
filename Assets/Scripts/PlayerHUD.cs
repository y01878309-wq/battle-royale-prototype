using UnityEngine;
using UnityEngine.UI;

public class PlayerHUD : MonoBehaviour
{
    public Health playerHealth;
    public Text healthText;
    public Text enemiesLeftText;

    void Update()
    {
        if (playerHealth == null) return;

        healthText.text = "Health: " + Mathf.Ceil(playerHealth.CurrentHealth);
        enemiesLeftText.text = "Enemies Left: " + CountAliveEnemies();
    }

    int CountAliveEnemies()
    {
        int count = 0;
        Health[] allHealth = FindObjectsOfType<Health>();

        foreach (Health h in allHealth)
        {
            if (h != null && h.gameObject.CompareTag("Enemy") && h.IsAlive)
            {
                count++;
            }
        }

        return count;
    }
}
