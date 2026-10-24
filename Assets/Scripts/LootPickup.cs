using UnityEngine;

public class LootPickup : MonoBehaviour
{
    public float healAmount = 25f;

    private void OnTriggerEnter(Collider other)
    {
        if (!other.CompareTag("Player"))
            return;

        Health health = other.GetComponent<Health>();
        if (health != null)
        {
            health.Heal(healAmount);
            Destroy(gameObject);
        }
    }
}
