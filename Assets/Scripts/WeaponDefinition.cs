using System;
using UnityEngine;

[Serializable]
public class WeaponDefinition
{
    public string weaponName = "Rifle";
    public float damage = 25f;
    public float range = 100f;
    public float fireRate = 6f;
    public float reloadTime = 1.2f;
    public int magazineSize = 30;
    public int currentAmmo = 30;
    public int reserveAmmo = 90;
    public int pellets = 1;
    public float spread = 0.02f;
    public bool automatic = true;
    public bool isUnlocked = true;
    public KeyCode hotkey = KeyCode.Alpha1;

    public WeaponDefinition() { }

    public WeaponDefinition(string name, float damageValue, float rangeValue, float fireRateValue,
        int magazineValue, int reserveValue, int pelletCount, float spreadValue, bool autoFire)
    {
        weaponName = name;
        damage = damageValue;
        range = rangeValue;
        fireRate = fireRateValue;
        reloadTime = Mathf.Clamp(1.5f / fireRateValue, 0.5f, 2.5f);
        magazineSize = magazineValue;
        currentAmmo = magazineValue;
        reserveAmmo = reserveValue;
        pellets = pelletCount;
        spread = spreadValue;
        automatic = autoFire;
        isUnlocked = true;

        if (name == "Rifle") hotkey = KeyCode.Alpha1;
        else if (name == "Shotgun") hotkey = KeyCode.Alpha2;
        else if (name == "Sniper") hotkey = KeyCode.Alpha3;
    }
}
