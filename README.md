# Battle Royale Prototype

This project is a lightweight, playable battle royale prototype inspired by PUBG. It is designed as a learning starter and a foundation you can expand into a larger game.

## Features
- Third-person or FPS-style movement using CharacterController
- Mouse-look camera
- Shooting with raycast hit detection
- Enemy AI that chases and attacks the player
- Safe zone shrinking over time
- Heal pickups / loot pickups
- Health system with win/lose conditions
- HUD with health and enemy count

## Controls
- W/A/S/D: Move
- Left Shift: Sprint
- Space: Jump
- Mouse: Look around
- Left Click: Shoot

## Unity setup
1. Create a new 3D project in Unity.
2. Copy the scripts from `Assets/Scripts` into your Unity project.
3. Create a Ground cube and a Player capsule.
4. Add `CharacterController`, `PlayerMovement`, `Health`, and `WeaponController` to the Player.
5. Add a Camera as a child of the Player and attach `CameraController`.
6. Create an enemy capsule and attach `Health`, `EnemyAI`, and `NavMeshAgent`.
7. Create a SafeZone object with `SafeZone` attached and a trigger collider.
8. Create loot pickups and attach `LootPickup`.
9. Use `Window > AI > Navigation` to bake a NavMesh.
10. Press Play.

## Notes
This is not a full PUBG clone; it is a functional prototype inspired by the gameplay loop of PUBG. It is intentionally compact so it is easy to extend.
