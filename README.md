# Cashiers Report

Cashiers Report is an Electron desktop application for cashier reports, cash reconciliation, in-house installments, finance accounts, and branch-based user access. Data is stored locally in SQLite on the computer running the app.

## Choose an installation path

| Goal | Use this path |
| --- | --- |
| Run or modify the application source code | [Developer setup](#developer-setup) |
| Install a packaged Windows application | [Windows installer](#windows-installer) |
| Update an existing installation | [Updating](#updating) |

## Requirements

### End users

- Windows 10 or Windows 11
- Permission to install desktop applications on the computer

### Developers

- Git
- A current Node.js LTS release, including npm
- Windows Build Tools only if `better-sqlite3` cannot download or use its prebuilt native binary

Check the installed versions:

```powershell
node --version
npm --version
git --version
```

## Windows installer

Use this path when you have received a release installer named like `cashiers-report-<version>-setup.exe`.

1. Close every running Cashiers Report window.
2. Copy the installer to the target computer.
3. Right-click the installer and select **Run as administrator** only when your organization requires administrator-managed installs. Otherwise, run it normally.
4. Complete the installer prompts. It creates a desktop shortcut by default.
5. Start **cashiers-report** from the Start menu or desktop shortcut.
6. Sign in with a provisioned account and the applicable branch.

The application creates and migrates its local data store automatically on startup. Do not open or edit the database while the application is running.

> **Fresh-production installation:** the current packaged application does not include a first-user or administrator-provisioning screen. Do not deploy a fresh database to production until you have a prepared, authorized database or a supported user-provisioning process. This prevents shipping an installation with undocumented or insecure default production credentials.

## Developer setup

### 1. Clone the repository

```powershell
git clone <repository-url>
Set-Location cashiers-report
```

If you already have the source, open PowerShell in the project directory instead.

### 2. Install dependencies

For a clean checkout, use the lockfile:

```powershell
npm ci
```

Use `npm install` only when intentionally changing dependencies. The install process rebuilds the `better-sqlite3` native module for Electron.

If that rebuild fails after changing Node.js or Electron versions, run:

```powershell
npx electron-rebuild -f -w better-sqlite3
```

### 3. Start the development app

```powershell
npm run dev
```

Electron starts the main process and renderer together. Leave the PowerShell window open while developing; press `Ctrl+C` there to stop the development server.

### 4. Sign in to development data

Development mode seeds sample branches, reports, accounts, and users. Select the matching branch before signing in.

| Account | Password | Branch |
| --- | --- | --- |
| `admin` | `admin` | Any branch |
| `cashier-goa` | `cashier123` | Goa |
| `cashier-lagonoy` | `cashier123` | Lagonoy |
| `cashier-tigaon` | `cashier123` | Tigaon |
| `cashier-tinambac` | `cashier123` | Tinambac |

These credentials exist only for local development. Never use them for production accounts or production data.

## Build a Windows installer

Run this from the project root:

```powershell
npm run build:win
```

The command type-checks the app, builds the Electron bundles, and creates the Windows installer in `dist`. Distribute the generated `*-setup.exe` file, not source files or `node_modules`.

Useful related commands:

```powershell
npm run typecheck       # Check main-process and renderer TypeScript
npm run build           # Build application bundles without packaging
npm run build:unpack    # Create an unpacked local package for inspection
```

## Data, backup, and restore

Cashiers Report uses one SQLite file named `cashiers-report.db`. On Windows, Electron stores it in the application user-data folder, normally:

```text
%APPDATA%\cashiers-report\cashiers-report.db
```

### Back up

1. Close Cashiers Report completely.
2. In File Explorer, paste `%APPDATA%\cashiers-report` into the address bar.
3. Copy `cashiers-report.db` to a protected backup location.
4. Keep the backup encrypted or otherwise access-controlled because it contains operational and financial data.

### Restore

1. Close Cashiers Report completely.
2. Make a copy of the current `cashiers-report.db` before replacing it.
3. Copy the approved backup file into `%APPDATA%\cashiers-report` and name it `cashiers-report.db`.
4. Start the application and sign in.

Only restore a backup from the same trusted application lineage. The application runs versioned database migrations automatically; do not manually edit database tables or schema files.

## Updating

1. Back up the database using the steps above.
2. Close the application on every affected workstation.
3. Install the newer `*-setup.exe` over the existing installation.
4. Start the application once and confirm that it opens normally.

Application updates preserve the existing local database and apply supported migrations on startup. If an update fails, keep the backup and contact the application maintainer before attempting a restore.

## Troubleshooting

### `npm ci` or native-module installation fails

- Confirm that Node.js and npm are installed and available in a new PowerShell window.
- Remove only the local dependency installation if you need a clean retry, then run `npm ci` again.
- If the error names `better-sqlite3`, install the required Windows C++ build tools or run `npx electron-rebuild -f -w better-sqlite3`.

### The application does not start after an update

- Confirm the installer completed and that no older app process remains open.
- Back up the current database before further troubleshooting.
- Start the application from the shortcut again; do not delete the database as a first response.

### Sign-in fails

- Select the branch assigned to the cashier account.
- Re-enter the username and password exactly.
- For development only, use one of the sample accounts listed above.
- For production, contact the account administrator; do not create accounts by editing the database.

## Project layout

```text
src/main/       Electron main process, SQLite access, migrations, and IPC handlers
src/preload/    Typed, restricted API exposed to the renderer
src/renderer/   React user interface
src/shared/     Shared IPC contracts and domain types
docs/           Architecture, security, data, design, and workflow documentation
```

## Recommended editor setup

[Visual Studio Code](https://code.visualstudio.com/) with the ESLint and Prettier extensions is recommended for contributors.

## Safety notes

- Do not share production database backups through unsecured channels.
- Do not expose the local database file to the renderer or edit it directly.
- Keep production users, passwords, and backups under your organization’s access-control policy.
