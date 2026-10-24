# Unity Play Setup Checklist

This document explains exactly what is already implemented in the repo and what must still be configured in the Unity Scene for the game to work correctly.

## 1) What is already in the repository
The project already contains playable prototype logic for:
- Player movement and sprint
- Camera follow and mouse look
- Weapon system: Rifle, Shotgun, Sniper
- Ammo and reload
- Weapon switching with Key 1/2/3 and mouse wheel
- Enemy chase and attack AI
- Enemy spawner
- Safe zone shrink
- Loot pickup healing
- HUD with health, enemies, weapon, ammo, kills
- Pause menu and main menu logic
- Win/lose flow and restart

## 2) What is still required in Unity Scene
The code alone is not enough. The scene must be assembled manually in Unity.

### Create Ground
- Add a Plane or Cube named Ground
- Scale it to fit the arena
- Position it at (0, 0, 0)

### Create Player
- Create a Capsule
- Name it Player
- Set tag to Player
- Add components:
  - CharacterController
  - PlayerMovement
  - Health
  - WeaponController
- Position it above ground

### Create Camera
- Create a Camera and make it a child of Player
- Set camera position to something like (0, 0.7, 0)
- Add CameraController
- In CameraController, assign playerBody = Player

### Create Enemy Prefab
- Create a Capsule
- Name it EnemyPrefab
- Set tag to Enemy
- Add components:
  - NavMeshAgent
  - EnemyAI
  - Health
- Save it as a prefab in Assets/Prefabs

### Create EnemySpawner object
- Create empty GameObject
- Name it EnemySpawner
- Add EnemySpawner script
- Assign the Enemy prefab in the Inspector
- Set enemyCount to a value like 6 or 8
- Set spawn area size to (30, 0, 30)

### Create SafeZone object
- Create empty GameObject
- Name it SafeZone
- Add BoxCollider
- Enable Is Trigger
- Add SafeZone script
- Set startSize to 30, shrinkRate to 0.8, minSize to 5

### Create Loot Pickup
- Create a Sphere or Cube
- Add BoxCollider or SphereCollider
- Enable Is Trigger
- Add LootPickup script
- Set healAmount to 25

### Create Canvas and HUD
- Create UI > Canvas
- Add Text objects for:
  - healthText
  - enemiesText
  - weaponText
  - ammoText
  - killsText
- Create empty GameObject and attach PlayerHUD
- Assign references in the Inspector:
  - playerHealth = Player's Health component
  - healthText = text UI
  - enemiesText = text UI
  - weaponText = text UI
  - ammoText = text UI
  - killsText = text UI

### Create GameManager object
- Create empty GameObject
- Name it GameManager
- Add GameManager script
- Assign:
  - player = Player object
  - winPanel = Win panel object
  - losePanel = Lose panel object
  - pausePanel = Pause panel object

### Create Pause Menu and Win/Lose UI
- Create UI panels for:
  - Pause Panel
  - Win Panel
  - Lose Panel
- Add buttons for Resume, Restart, Back To Menu if needed
- Link these to GameManager methods

### Create MainMenu scene
- Add a new scene named MainMenu
- Create UI button: Start Game
- Add MainMenuManager script
- Set gameSceneName = "Game"
- Add Quit button if desired

## 3) Required tags
Use these exact tags in Unity:
- Player
- Enemy

## 4) Required reference assignments
These are the critical assignments that must be done in Inspector.

### PlayerMovement
- playerCamera = Main Camera
- weaponController = Player's WeaponController

### WeaponController
- playerCamera = Main Camera
- muzzleFlash = optional particle system
- hitEffect = optional hit effect

### CameraController
- playerBody = Player object

### PlayerHUD
- playerHealth = Player's Health component
- healthText = HUD health text
- enemiesText = HUD enemies left text
- weaponText = HUD weapon text
- ammoText = HUD ammo text
- killsText = HUD kills text

### GameManager
- player = Player object
- winPanel = Win UI panel
- losePanel = Lose UI panel
- pausePanel = Pause UI panel

## 5) NavMesh Bake
Important: AI will not work without navigation.

Steps:
- Open Window > AI > Navigation
- Select the Ground object
- Mark it as Navigation Static
- Click Bake

## 6) Play controls
- W/A/S/D = Move
- Left Shift = Sprint
- Space = Jump
- Mouse = Look around
- Left Click = Shoot
- 1 / 2 / 3 = Weapon switch
- R = Reload
- Esc = Pause

## 7) Final check before pressing Play
Make sure all of the following are true:
- Player has CharacterController, PlayerMovement, Health, WeaponController
- Enemy prefab exists and has NavMeshAgent, EnemyAI, Health
- The Player and Enemy tags are correct
- Main Camera is assigned to WeaponController and PlayerMovement
- CameraController.playerBody points to Player
- Canvas references are assigned correctly
- GameManager references are assigned correctly
- NavMesh is baked
- Scene has at least one enemy spawned

## 8) Reality check
The repo contains the game logic and the core gameplay systems, but the Unity Scene still needs to be assembled manually. That means the project is playable as a Unity prototype once the scene is configured correctly.

This is not a full complete packaged game file with final art, sound, maps, and menus baked in, but it is a working gameplay prototype ready for Unity playtesting.

## 9) Recommended next improvement
If you want a more polished version, the next steps are:
- Create real art and textures
- Add sound effects and music
- Build a bigger world map
- Add health packs and better loot
- Add a start menu scene and final menu scene
- Add multiple enemy types and boss enemies
- Add save/load and progression

This repo already contains the foundation for a real playable battle royale prototype.
