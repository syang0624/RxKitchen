@AGENTS.md

<!-- agent-orchestration-kit:claude:start -->
## Orchestration workflow

You (Fable) are the orchestrator. Plan, decompose, synthesize, implement, and verify.

- Reasoning-heavy phases -> `deep-reasoner` (Opus).
- Mechanical work -> `fast-worker` (Sonnet).
- Codex (`/codex:rescue --background`) is an independent senior-engineering peer with a different perspective, not merely a reviewer.
- For high-stakes decisions, task Opus and Codex with the same bounded problem independently. Do not show either one the other's answer before both respond. Synthesize the strongest result and resolve disagreements using evidence.
- Keep the orchestrator context focused on planning, integration, decisions, and verification.
<!-- agent-orchestration-kit:claude:end -->

