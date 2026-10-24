using UnityEngine;
using UnityEngine.UI;

public class PlayerHUD : MonoBehaviour
{
    public Health playerHealth;
    public Text healthText;
    public Text enemiesLeftText;
    public Text weaponText;
    public Text ammoText;

    void Update()
    {
        if (playerHealth != null)
        {
            if (healthText != null)
            {
                healthText.text = "Health: " + Mathf.Ceil(playerHealth.CurrentHealth);
            }
        }

        if (enemiesLeftText != null)
        {
            enemiesLeftText.text = "Enemies Left: " + CountAliveEnemies();
        }

        if (weaponText != null || ammoText != null)
        {
            WeaponController weaponController = FindObjectOfType<WeaponController>();
            if (weaponController != null)
            {
                WeaponDefinition currentWeapon = weaponController.GetCurrentWeapon();
                if (currentWeapon != null)
                {
                    if (weaponText != null)
                    {
                        weaponText.text = currentWeapon.weaponName;
                    }

                    if (ammoText != null)
                    {
                        ammoText.text = currentWeapon.currentAmmo + " / " + currentWeapon.reserveAmmo;
                    }
                }
            }
        }
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
