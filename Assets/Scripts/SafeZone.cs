using UnityEngine;

public class SafeZone : MonoBehaviour
{
    public float startSize = 30f;
    public float shrinkRate = 0.8f;
    public float minSize = 5f;
    public float damagePerSecond = 10f;

    private float currentSize;

    void Start()
    {
        currentSize = startSize;
        transform.localScale = Vector3.one * currentSize;
    }

    void Update()
    {
        currentSize = Mathf.Max(minSize, currentSize - shrinkRate * Time.deltaTime);
        transform.localScale = Vector3.one * currentSize;
    }

    void OnTriggerStay(Collider other)
    {
        Health health = other.GetComponent<Health>();
        if (health != null && other.CompareTag("Player"))
        {
            health.TakeDamage(damagePerSecond * Time.deltaTime);
        }
    }
}
