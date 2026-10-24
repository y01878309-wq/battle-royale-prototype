using System.Collections.Generic;
using UnityEngine;

public class WeaponController : MonoBehaviour
{
    [Header("Weapon Setup")]
    public Camera playerCamera;
    public ParticleSystem muzzleFlash;
    public GameObject hitEffect;
    public List<WeaponDefinition> weapons = new List<WeaponDefinition>();
    public int currentWeaponIndex = 0;

    [Header("Audio")]
    public AudioSource shootAudioSource;

    private float nextFireTime = 0f;
    private bool isReloading = false;
    private float reloadTimer = 0f;

    void Start()
    {
        if (playerCamera == null)
        {
            playerCamera = Camera.main;
        }

        if (weapons.Count == 0)
        {
            AddWeapon("Rifle", 25f, 100f, 6f, 30, 90, 1, 0.02f, true);
            AddWeapon("Shotgun", 18f, 35f, 2.1f, 8, 32, 6, 0.08f, false);
            AddWeapon("Sniper", 65f, 180f, 1.2f, 5, 20, 1, 0.01f, false);
        }

        for (int i = 0; i < weapons.Count; i++)
        {
            weapons[i].currentAmmo = Mathf.Min(weapons[i].currentAmmo, weapons[i].magazineSize);
            if (weapons[i].currentAmmo <= 0 && weapons[i].reserveAmmo > 0)
            {
                ReloadCurrentWeapon();
            }
        }

        if (weapons.Count > 0)
        {
            weapons[0].isUnlocked = true;
        }
    }

    void Update()
    {
        if (isReloading)
        {
            reloadTimer -= Time.deltaTime;
            if (reloadTimer <= 0f)
            {
                FinishReload();
            }
        }

        if (Input.GetKeyDown(KeyCode.R) && !isReloading)
        {
            ReloadCurrentWeapon();
        }

        for (int i = 0; i < weapons.Count; i++)
        {
            if (Input.GetKeyDown(weapons[i].hotkey))
            {
                SwitchWeapon(i);
            }
        }

        if (Input.GetAxis("Mouse ScrollWheel") > 0f)
        {
            SwitchWeapon((currentWeaponIndex + 1) % weapons.Count);
        }
        else if (Input.GetAxis("Mouse ScrollWheel") < 0f)
        {
            SwitchWeapon((currentWeaponIndex - 1 + weapons.Count) % weapons.Count);
        }

        if (weapons.Count == 0 || isReloading)
        {
            return;
        }

        WeaponDefinition activeWeapon = weapons[currentWeaponIndex];
        if (activeWeapon.automatic)
        {
            if (Input.GetButton("Fire1") && Time.time >= nextFireTime)
            {
                nextFireTime = Time.time + 1f / activeWeapon.fireRate;
                TryShoot();
            }
        }
        else
        {
            if (Input.GetButtonDown("Fire1") && Time.time >= nextFireTime)
            {
                nextFireTime = Time.time + 1f / activeWeapon.fireRate;
                TryShoot();
            }
        }
    }

    public void AddWeapon(string name, float damage, float range, float fireRate, int magazineSize, int reserveAmmo, int pellets, float spread, bool automatic)
    {
        for (int i = 0; i < weapons.Count; i++)
        {
            if (weapons[i].weaponName == name)
            {
                weapons[i].reserveAmmo += reserveAmmo;
                weapons[i].isUnlocked = true;
                SwitchWeapon(i);
                return;
            }
        }

        WeaponDefinition newWeapon = new WeaponDefinition(name, damage, range, fireRate, magazineSize, reserveAmmo, pellets, spread, automatic);
        newWeapon.isUnlocked = true;
        weapons.Add(newWeapon);
        currentWeaponIndex = weapons.Count - 1;
    }

    public void SwitchWeapon(int index)
    {
        if (weapons.Count == 0)
        {
            return;
        }

        currentWeaponIndex = Mathf.Clamp(index, 0, weapons.Count - 1);
        if (!weapons[currentWeaponIndex].isUnlocked)
        {
            currentWeaponIndex = 0;
        }
    }

    public void TryShoot()
    {
        if (weapons.Count == 0)
        {
            return;
        }

        WeaponDefinition weapon = weapons[currentWeaponIndex];

        if (weapon.currentAmmo <= 0)
        {
            ReloadCurrentWeapon();
            return;
        }

        if (playerCamera == null)
        {
            Debug.LogWarning("WeaponController: No camera assigned.");
            return;
        }

        weapon.currentAmmo--;

        for (int i = 0; i < weapon.pellets; i++)
        {
            Vector3 direction = playerCamera.transform.forward;
            direction.x += Random.Range(-weapon.spread, weapon.spread);
            direction.y += Random.Range(-weapon.spread, weapon.spread);
            direction.z += Random.Range(-weapon.spread, weapon.spread);
            direction = direction.normalized;

            RaycastHit hit;
            if (Physics.Raycast(playerCamera.transform.position, direction, out hit, weapon.range))
            {
                Health targetHealth = hit.collider.GetComponentInParent<Health>();
                if (targetHealth != null)
                {
                    targetHealth.TakeDamage(weapon.damage);
                }

                if (hitEffect != null)
                {
                    GameObject effect = Instantiate(hitEffect, hit.point, Quaternion.LookRotation(hit.normal));
                    Destroy(effect, 0.2f);
                }
            }
        }

        if (muzzleFlash != null)
        {
            muzzleFlash.Play();
        }

        if (shootAudioSource != null)
        {
            if (!shootAudioSource.isPlaying)
            {
                shootAudioSource.Play();
            }
        }

        if (weapon.currentAmmo <= 0 && weapon.reserveAmmo > 0)
        {
            ReloadCurrentWeapon();
        }
    }

    public void ReloadCurrentWeapon()
    {
        if (weapons.Count == 0 || isReloading)
        {
            return;
        }

        WeaponDefinition weapon = weapons[currentWeaponIndex];
        if (weapon.currentAmmo >= weapon.magazineSize || weapon.reserveAmmo <= 0)
        {
            return;
        }

        isReloading = true;
        reloadTimer = weapon.reloadTime;
    }

    private void FinishReload()
    {
        WeaponDefinition weapon = weapons[currentWeaponIndex];
        int ammoNeeded = weapon.magazineSize - weapon.currentAmmo;
        int ammoToLoad = Mathf.Min(ammoNeeded, weapon.reserveAmmo);

        weapon.currentAmmo += ammoToLoad;
        weapon.reserveAmmo -= ammoToLoad;
        isReloading = false;
        reloadTimer = 0f;
    }

    public WeaponDefinition GetCurrentWeapon()
    {
        if (weapons.Count == 0)
        {
            return null;
        }

        return weapons[currentWeaponIndex];
    }
}
