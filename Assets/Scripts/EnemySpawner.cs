using UnityEngine;

public class EnemySpawner : MonoBehaviour
{
    public GameObject enemyPrefab;
    public int enemyCount = 8;
    public Vector3 spawnAreaSize = new Vector3(30, 0, 30);

    private void Start()
    {
        SpawnEnemies();
    }

    public void SpawnEnemies()
    {
        if (enemyPrefab == null)
            return;

        for (int i = 0; i < enemyCount; i++)
        {
            Vector3 randomPos = new Vector3(
                Random.Range(-spawnAreaSize.x, spawnAreaSize.x),
                1f,
                Random.Range(-spawnAreaSize.z, spawnAreaSize.z)
            );

            GameObject enemy = Instantiate(enemyPrefab, randomPos, Quaternion.identity);
            enemy.tag = "Enemy";
            enemy.name = "Enemy_" + i;

            if (enemy.GetComponent<NavMeshAgent>() == null)
                enemy.AddComponent<NavMeshAgent>();

            if (enemy.GetComponent<EnemyAI>() == null)
                enemy.AddComponent<EnemyAI>();

            if (enemy.GetComponent<Health>() == null)
                enemy.AddComponent<Health>();
        }
    }
}
