using UnityEngine;

[RequireComponent(typeof(CharacterController))]
public class PlayerMovement : MonoBehaviour
{
    [Header("Movement")]
    public float moveSpeed = 6f;
    public float sprintSpeed = 10f;
    public float jumpForce = 5f;
    public float gravity = -20f;

    [Header("References")]
    public Camera playerCamera;
    public WeaponController weaponController;

    private CharacterController controller;
    private Vector3 velocity;
    private bool isGrounded;

    private void Start()
    {
        controller = GetComponent<CharacterController>();

        if (playerCamera == null)
            playerCamera = Camera.main;

        if (weaponController == null)
            weaponController = GetComponent<WeaponController>();
    }

    private void Update()
    {
        if (controller == null)
            return;

        isGrounded = controller.isGrounded;

        if (isGrounded && velocity.y < 0f)
            velocity.y = -2f;

        float horizontal = Input.GetAxis("Horizontal");
        float vertical = Input.GetAxis("Vertical");

        Vector3 move = transform.right * horizontal + transform.forward * vertical;
        move = Vector3.ClampMagnitude(move, 1f);

        float speed = Input.GetKey(KeyCode.LeftShift) ? sprintSpeed : moveSpeed;
        controller.Move(move * speed * Time.deltaTime);

        if (Input.GetButtonDown("Jump") && isGrounded)
            velocity.y = jumpForce;

        velocity.y += gravity * Time.deltaTime;
        controller.Move(velocity * Time.deltaTime);

        if (weaponController != null)
            weaponController.HandleInput();
    }
}
