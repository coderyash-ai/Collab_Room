# Collab Room – Product Overview

Collab Room merges code collaboration, communication, and project management into a single real-time workspace. Users connect their preferred IDEs to co-edit, review, and discuss changes with visible cursors, inline threads, and instant sync.

## Key Capabilities
- Real-time co-editing on shared codebases
- Inline review/comments and diffs
- Integrated chat/voice channels
- Private AI assistants per participant
- Secure sync, permissions, and rollbacks

## Architecture Snapshot
- Web frontend over WebSockets for low-latency updates
- Backend microservices for room/session state and file sync
- OAuth 2.0, RBAC, sandboxing, and end-to-end encryption
- Extensible APIs for CI/CD and PM integrations

## Initial Roadmap
1. Define collaboration protocol (OT/CRDT) and transport
2. MVP room service and file sync service
3. Web UI for rooms, cursors, and threaded comments
4. AuthN/AuthZ (OAuth, roles)
5. IDE connectors (VS Code first), then JetBrains
6. Observability and audit logs
