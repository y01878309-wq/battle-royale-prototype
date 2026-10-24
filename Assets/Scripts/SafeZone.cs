using UnityEngine;

public class SafeZone : MonoBehaviour
{
    public float startSize = 30f;
    public float shrinkRate = 0.8f;
    public float minSize = 5f;
    public float damagePerSecond = 10f;

    private float currentSize;

    private void Start()
    {
        currentSize = startSize;
        transform.localScale = Vector3.one * currentSize;
    }

    private void Update()
    {
        currentSize = Mathf.Max(minSize, currentSize - shrinkRate * Time.deltaTime);
        transform.localScale = Vector3.one * currentSize;
    }

    private void OnTriggerStay(Collider other)
    {
        if (other.CompareTag("Player"))
        {
            Health health = other.GetComponent<Health>();
            if (health != null)
                health.TakeDamage(damagePerSecond * Time.deltaTime);
        }
    }
}
