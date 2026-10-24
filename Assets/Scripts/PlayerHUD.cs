using UnityEngine;
using UnityEngine.UI;

public class PlayerHUD : MonoBehaviour
{
    public Health playerHealth;
    public Text healthText;
    public Text enemiesText;
    public Text weaponText;
    public Text ammoText;
    public Text killsText;

    private WeaponController weaponController;

    private void Start()
    {
        weaponController = FindObjectOfType<WeaponController>();
    }

    private void Update()
    {
        if (playerHealth != null && healthText != null)
            healthText.text = "Health: " + Mathf.Ceil(playerHealth.CurrentHealth);

        if (enemiesText != null)
            enemiesText.text = "Enemies Left: " + CountAliveEnemies();

        if (weaponController == null)
            weaponController = FindObjectOfType<WeaponController>();

        if (weaponController != null)
        {
            WeaponDefinition currentWeapon = weaponController.GetCurrentWeapon();
            if (currentWeapon != null)
            {
                if (weaponText != null)
                    weaponText.text = currentWeapon.weaponName;

                if (ammoText != null)
                    ammoText.text = currentWeapon.currentAmmo + " / " + currentWeapon.reserveAmmo;
            }
        }

        if (killsText != null)
            killsText.text = "Kills: " + GameManager.Instance.totalKills;
    }

    private int CountAliveEnemies()
    {
        int count = 0;
        GameObject[] allObjects = FindObjectsOfType<GameObject>();

        foreach (GameObject obj in allObjects)
        {
            if (obj.CompareTag("Enemy"))
            {
                Health health = obj.GetComponent<Health>();
                if (health != null && health.IsAlive)
                    count++;
            }
        }

        return count;
    }
}
