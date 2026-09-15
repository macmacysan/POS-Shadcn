# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Cashiers are the primary users. At the end of each business day, they prepare and submit their daily reports. They may also submit reports for past business dates and provide report summaries when those are requested. Administrators support and oversee branch-based operations.

## Product Purpose

Cashiers Report is a local-first desktop workspace for recording, reconciling, and submitting daily cashier reports, while tracking expenses, payments, installments, and in-house accounts. It helps cashiers complete accurate daily financial reporting and gives authorized users access to the associated operational records and summaries.

## Positioning

The product is an operational cashier workspace rather than a general accounting or point-of-sale system: its core workflow centers on branch-aware cashier reports, end-of-day reconciliation, and related expense and installment tracking for non-administrative staff.

## Operating Context

The application is used in branch-based cashier operations. Cashiers work through end-of-day reporting and may reopen past reporting dates when needed. Reports are identified by branch, cashier, and business date; financial records include receipts, income, expenses, payments, deductions, cash denominations, remittance, and variance. Administrators may manage and review broader operational data.

## Capabilities and Constraints

- Electron desktop application built with React and TypeScript, using a local SQLite database.
- Supports cashier reports, reconciliation, payments, expenses, installments, in-house accounts, branches, users, and report summaries.
- Administrator and cashier permissions, branch boundaries, and ownership constraints are enforced in the privileged application layers.
- Financial amounts are stored as integer centavos; existing authoritative calculation, persistence, authorization, IPC, and data-contract logic must be preserved.
- Posted financial records are voided rather than physically deleted.
- The existing product behavior and financial logic are confirmed working. Future work may improve the design, but must not change business behavior unless explicitly requested.

## Brand Commitments

The product name is Cashiers Report. It is a compact financial workstation for operational users, not a generic accounting dashboard. The incumbent visual system is documented separately in `docs/DESIGN.md`.

## Evidence on Hand

- [README.md](README.md) describes the local-first desktop workspace and its branch-based cashier operations.
- `docs/ARCHITECTURE.md`, `docs/BUSINESS_RULES.md`, and `docs/SECURITY.md` define the existing technical, financial, and authorization constraints.
- `docs/DESIGN.md` records the existing product design contract.
- The repository contains implemented cashier-report, expense, payment, finance-account, and installment workflows. No external testimonials, customer claims, benchmarks, or proof assets are confirmed for future use.

## Product Principles

1. Make daily cashier reporting accurate, efficient, and practical at the end of a business day.
2. Preserve financial correctness, report identity, and branch-specific access as non-negotiable product behavior.
3. Keep operational workflows accessible to cashiers while maintaining appropriate administrative oversight.
4. Improve the interface without destabilizing trusted accounting, reconciliation, installment, or expense logic.

## Accessibility & Inclusion

Preserve keyboard navigation, visible focus states, labels, and accessible names in operational workflows. No additional product-specific accessibility standard has been confirmed.
