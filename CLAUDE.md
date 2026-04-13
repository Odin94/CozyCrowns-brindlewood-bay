@AGENTS.md

## Claude-Specific Notes
- Prefer loading the deep docs only when the task needs them:
  - `docs/architecture.md` for runtime boundaries and request/data flow
  - `docs/change-map.md` for task-oriented edit scopes and verification
- Keep edits surgical. Preserve the existing visual style unless the task explicitly asks for a redesign.
- When verification needs auth, note the manual steps instead of guessing at WorkOS behavior without configured credentials.
