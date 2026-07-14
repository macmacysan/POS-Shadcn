## Authentication and Users

### User

| Field          | Type           | Constraints                                     | Description                                        |
| -------------- | -------------- | ----------------------------------------------- | -------------------------------------------------- |
| `id`           | UUID or String | Primary key                                     | Stable user identifier                             |
| `username`     | String         | Required, unique, normalized                    | Username used to sign in                           |
| `passwordHash` | String         | Required                                        | Secure password hash; never store the raw password |
| `role`         | Enum           | Required                                        | `ADMIN` or `CASHIER`                               |
| `branchId`     | UUID or String | Foreign key, nullable for system administrators | User's assigned branch                             |
| `firstName`    | String         | Required                                        | User's first name                                  |
| `lastName`     | String         | Required                                        | User's last name                                   |
| `isActive`     | Boolean        | Required, default `true`                        | Controls whether the user can sign in              |
| `createdAt`    | DateTime       | Required                                        | Account creation timestamp                         |
| `updatedAt`    | DateTime       | Required                                        | Last account update timestamp                      |
| `lastLoginAt`  | DateTime       | Optional                                        | Most recent successful login                       |

### Role

Allowed values:

* `ADMIN`
* `CASHIER`

Do not store arbitrary role strings.

### Branch

| Field      | Type           | Constraints              | Description                    |
| ---------- | -------------- | ------------------------ | ------------------------------ |
| `id`       | UUID or String | Primary key              | Stable branch identifier       |
| `code`     | String         | Required, unique         | Human-readable branch code     |
| `name`     | String         | Required                 | Branch name                    |
| `isActive` | Boolean        | Required, default `true` | Whether the branch can be used |

### Authentication Rules

* Store only a secure password hash, never a plaintext password.
* Normalize usernames before checking uniqueness.
* Reject login for inactive users or inactive branches.
* Cashiers may access only their assigned branch.
* Administrator permissions must be enforced in backend or IPC handlers, not only by hiding UI elements.
* Record failed login attempts without logging passwords.
* Use a generic login error so the application does not reveal whether a username exists.
* Password changes must replace `passwordHash` and update `updatedAt`.
