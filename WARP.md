# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project status
- This repo currently contains planning docs only (`README.md`, `docs/overview.md`). No application code or toolchain (e.g., no `package.json`, `pyproject.toml`, or build config) exists yet.
- Commands for building, linting, and tests are not configured because stacks are not chosen. See "Next steps" in `README.md`.

## Commands
- Not configured yet. Once stacks are selected and the repo is initialized, add the concrete commands here for:
  - Install dependencies at repo root and per app.
  - Build all apps/packages and individual targets.
  - Run dev servers (frontend/backend) and watch modes.
  - Lint/format (include fix modes) and type-check.
  - Test suites (all, watch, and single test by pattern/path).

## High-level architecture (from docs)
- Purpose: real-time collaborative workspace connecting developers’ IDEs to co-edit, review, and communicate.
- Frontend: Web UI over WebSockets for low-latency updates (cursors, diffs, threaded comments).
- Backend: microservices for room/session state and file synchronization.
- Security: OAuth 2.0, RBAC, sandboxing, and end-to-end encryption.
- Extensibility: APIs for CI/CD and project management integrations.
- Key product capabilities: real-time co-editing, inline review/comments, integrated chat/voice, per-user private AI assistants, secure sync, permissions, rollbacks.
- Early roadmap highlights (docs/overview.md):
  1) Choose collaboration protocol (OT/CRDT) and transport
  2) MVP room service and file sync service
  3) Web UI for rooms, cursors, threaded comments
  4) AuthN/AuthZ (OAuth, roles)
  5) IDE connectors (VS Code first), then JetBrains
  6) Observability and audit logs

## Repository layout (planned; see README.md)
- `apps/frontend` — Web UI
- `apps/backend` — APIs and collaboration services
- `packages/shared` — Shared libraries and types
- `docs/` — Product/architecture docs
- `infra/` — Deployment and environment configuration

## What to add here after initialization
- Top-level dev workflow for the chosen monorepo tool (e.g., how to run all vs. a single app).
- Exact commands for:
  - Build: all targets and per-app
  - Lint/format/type-check
  - Tests: run all, watch, single test (by file and by name/pattern)
  - Local development: starting backend services and the frontend together
- Any service-specific env setup (reference locations only; do not include secrets).

## Important references
- `README.md`: mission, target users, high-level flow, technical framework, and next steps.
- `docs/overview.md`: capabilities, architecture snapshot, and initial roadmap.
