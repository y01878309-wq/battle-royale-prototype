# Battle Royale Prototype

This project is now a complete, playable battle royale prototype built for Unity.

Features:
- Player movement and sprinting
- Mouse-look camera
- Full weapon system with Rifle, Shotgun, and Sniper
- Ammo, reload, and weapon switching
- Enemy AI chase + attack behavior
- Enemy spawning system
- Shrinking safe zone
- Healing loot pickups
- HUD with health, weapon, ammo, enemies left, and kills
- Win/lose conditions and restart flow
- Pause menu and main menu support

Controls:
- W/A/S/D: Move
- Left Shift: Sprint
- Space: Jump
- Mouse: Look around
- Left Click: Shoot
- 1 / 2 / 3: Switch weapons
- R: Reload
- Esc: Pause

Unity setup:
1. Create a new 3D Unity project.
2. Add a Ground plane.
3. Create a Player capsule.
4. Tag the Player object as `Player`.
5. Add `CharacterController`, `PlayerMovement`, `Health`, and `WeaponController` to the Player.
6. Add a Camera as a child of the Player and attach `CameraController`.
7. Create Enemy prefab with `Capsule`, `NavMeshAgent`, `EnemyAI`, and `Health`.
8. Add an `EnemySpawner` object and assign the Enemy prefab.
9. Create a `SafeZone` object with a trigger collider and attach `SafeZone`.
10. Create a `Canvas` and attach `PlayerHUD`.
11. Create `GameManager` object and attach `GameManager`.
12. Bake the NavMesh: `Window > AI > Navigation > Bake`.
13. Press Play.

Notes:
- For a complete playable build, you need to assign the `PlayerHUD` references in the Inspector.
- You can also create a `MainMenu` scene with a button that calls `MainMenuManager.StartGame()`.
- You can also create `Win` and `Lose` UI panels and assign them to the `GameManager` component.

This package is meant to be quick to set up and immediately playable in Unity.
