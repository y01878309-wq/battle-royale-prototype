using UnityEngine;

public class WeaponPickup : MonoBehaviour
{
    [Header("Pickup Settings")]
    public string weaponName = "Shotgun";
    public float damage = 18f;
    public float range = 35f;
    public float fireRate = 2.1f;
    public int magazineSize = 8;
    public int reserveAmmo = 32;
    public int pellets = 6;
    public float spread = 0.08f;
    public bool isAutomatic = false;

    void OnTriggerEnter(Collider other)
    {
        if (other == null)
        {
            return;
        }

        WeaponController weaponController = other.GetComponentInChildren<WeaponController>();
        if (weaponController == null)
        {
            weaponController = other.GetComponent<WeaponController>();
        }

        if (weaponController != null)
        {
            weaponController.AddWeapon(weaponName, damage, range, fireRate, magazineSize, reserveAmmo, pellets, spread, isAutomatic);
            Destroy(gameObject);
        }
    }
}
