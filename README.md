# Battle Royale Prototype

This project is now a complete playable mini battle royale prototype with:

- player movement and sprinting
- mouse-look camera
- weapon system with rifle, shotgun, and sniper
- ammo, reloads, and weapon switching
- enemy AI with chase and attack behavior
- health system and healing pickups
- shrinking safe zone
- win/lose conditions and HUD
- collectible weapon pickups

## Controls
- W/A/S/D: Move
- Left Shift: Sprint
- Space: Jump
- Mouse: Look around
- Left Click: Shoot
- 1 / 2 / 3: Switch weapons
- R: Reload

## Setup in Unity
1. Create a new 3D Unity project.
2. Copy the scripts from `Assets/Scripts` into your project.
3. Create a Ground object, a Player capsule, and an Enemy capsule.
4. Add `CharacterController`, `PlayerMovement`, `Health`, and `WeaponController` to the Player.
5. Add a Camera as a child of the Player and attach `CameraController`.
6. Add a `NavMeshAgent` and `EnemyAI` to the enemy.
7. Create a safe-zone object with `SafeZone` attached.
8. Create loot or weapon pickups with `WeaponPickup`.
9. Bake navigation and press Play.

This is a compact but complete prototype that keeps the full gameplay loop alive without leaving the weapon system incomplete.
