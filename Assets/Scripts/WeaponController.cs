using UnityEngine;

public class WeaponController : MonoBehaviour
{
    [Header("Weapon Setup")]
    public Camera playerCamera;
    public ParticleSystem muzzleFlash;
    public GameObject hitEffect;

    [Header("Stats")]
    public float damage = 25f;
    public float range = 100f;
    public float fireRate = 6f;

    private float nextFireTime = 0f;

    void Update()
    {
        if (Input.GetButton("Fire1") && Time.time >= nextFireTime)
        {
            nextFireTime = Time.time + 1f / fireRate;
            Shoot();
        }
    }

    void Shoot()
    {
        if (playerCamera == null)
        {
            Debug.LogWarning("WeaponController: No camera assigned.");
            return;
        }

        RaycastHit hit;

        if (Physics.Raycast(playerCamera.transform.position, playerCamera.transform.forward, out hit, range))
        {
            Health targetHealth = hit.collider.GetComponentInParent<Health>();
            if (targetHealth != null)
            {
                targetHealth.TakeDamage(damage);
            }

            if (hitEffect != null)
            {
                GameObject effect = Instantiate(hitEffect, hit.point, Quaternion.LookRotation(hit.normal));
                Destroy(effect, 0.2f);
            }
        }

        if (muzzleFlash != null)
        {
            muzzleFlash.Play();
        }
    }
}
