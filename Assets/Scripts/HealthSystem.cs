using UnityEngine;

public class HealthSystem : MonoBehaviour
{
    public float maxHealth = 100f;
    public bool destroyOnDeath = true;

    private float currentHealth;

    public float CurrentHealth => currentHealth;
    public bool IsAlive => currentHealth > 0f;

    private void Start()
    {
        currentHealth = maxHealth;
    }

    public void TakeDamage(float amount)
    {
        if (!IsAlive)
            return;

        currentHealth = Mathf.Max(0f, currentHealth - amount);

        if (currentHealth <= 0f)
            Die();
    }

    public void Heal(float amount)
    {
        if (!IsAlive)
            return;

        currentHealth = Mathf.Min(maxHealth, currentHealth + amount);
    }

    private void Die()
    {
        if (destroyOnDeath)
            Destroy(gameObject);
    }
}
