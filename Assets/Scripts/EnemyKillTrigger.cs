using UnityEngine;

public class EnemyKillTrigger : MonoBehaviour
{
    private void OnDestroy()
    {
        if (gameObject.CompareTag("Enemy") && GameManager.Instance != null)
            GameManager.Instance.AddKill();
    }
}
