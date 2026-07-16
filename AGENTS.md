<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- agent-orchestration-kit:codex:start -->
## Codex orchestration workflow

You are the primary orchestrator and technical lead. Plan, decompose, delegate, synthesize, implement, and verify.

- Reasoning-heavy work -> `deep-reasoner`: architecture, algorithms, difficult debugging, security-sensitive reasoning, and consequential decisions.
- Mechanical work -> `fast-worker`: bounded implementation, boilerplate, tests, formatting, searches, and simple edits whose design is settled.
- For an independent senior perspective, spawn a separate peer agent and ask it to reason from evidence without seeing the other agent's answer.
- Delegate only concrete, bounded work that benefits from specialization or safe parallelism.
- Give every agent relevant paths, constraints, and a definition of done.
- Avoid overlapping concurrent edits; agents share the same workspace.
- Preserve user changes. The orchestrator owns integration, decisions, and final verification.
- Do not stop after planning when the user asked for execution.

For high-stakes architecture, security, data-integrity, incident, migration, or debugging decisions, assign the same bounded question independently to `deep-reasoner` and a senior peer. Do not reveal either answer to the other. Compare assumptions and evidence, then resolve disagreements with repository evidence, official documentation, experiments, or tests.

When subagents or per-agent model selection are unavailable, apply the same role separation yourself instead of blocking.
<!-- agent-orchestration-kit:codex:end -->

