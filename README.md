# Cashiers Report

A local-first desktop workspace for managing cashier reports, daily financial entries, payments, installments, and in-house accounts.

Built with Electron, React, and TypeScript for branch-based cashier operations.

## What is included

- Branch-aware sign-in form for Goa, Lagonoy, Tigaon, and Tinambac
- Dashboard workspace with summary cards for cashier reports, receipts, income, and expenses
- Cashier reports with Expenses, Income, Payment, and Activity tabs
- Expense entry categories, VAT selection, receipt references, and Philippine peso formatting
- Income and payment tables with reference numbers, providers, dates, remarks, and amounts
- Installment history inspection from report activity
- In-house account workspace with all, active, closed, and blacklisted account groupings
- Responsive sidebar navigation for finance, reports, branches, cashiers, settings, and help
- Light and dark themes persisted locally in the browser
- Local workspace messaging intended for on-device use

> Current status: the main screens and interaction flows are implemented as a frontend prototype. Login validation currently checks required fields and does not yet authenticate against a remote service or database.

## Tech stack

- Electron 43
- React 19
- TypeScript 5.9
- Vite and electron-vite
- Tailwind CSS 4
- Base UI and shadcn/ui components
- TanStack Table
- React Hook Form and Zod
- date-fns
- better-sqlite3 dependency for local persistence work

## Getting started

### Prerequisites

- Node.js 20 or newer
- npm
- Windows, macOS, or Linux for platform-specific packaging

### Install dependencies

```bash
npm install
```

### Start the development app

```bash
npm run dev
```

### Run checks

```bash
npm run lint
npm run typecheck
```

### Build the application

```bash
# Unpack the application directory
npm run build:unpack

# Create a Windows installer
npm run build:win

# Create a macOS package
npm run build:mac

# Create a Linux package
npm run build:linux
```

### Telegram report delivery

An administrator can configure **Send Telegram** from **Settings → Administration**. The bot token is encrypted in Electron's local user-data area, is never shown after saving, and never enters the renderer or installer.

## Project structure

```text
src/
├── main/       Electron main process and database services
├── preload/    Typed bridge between Electron and the renderer
└── renderer/   React application and UI components
resources/      Application assets
docs/           Project and engineering documentation
```

The renderer is kept behind Electron's preload boundary. Privileged operations, persistence, and IPC belong in the main process.

## Development notes

- Preserve branch, cashier, account, report, and financial data boundaries when extending the app.
- Validate user input at the UI and IPC boundaries.
- Use transactions for multi-step financial or reconciliation operations.
- Keep sensitive data, raw database handles, filesystem access, and shell access out of the renderer.
- See the project documentation for [architecture](docs/ARCHITECTURE.md), [business rules](docs/BUSINESS_RULES.md), [security](docs/SECURITY.md), [frontend conventions](docs/FRONTEND.md), and [verification](docs/VERIFICATION.md).

## Recommended editor setup

- [Visual Studio Code](https://code.visualstudio.com/)
- [ESLint extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Prettier extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## License

No license file is currently included.
