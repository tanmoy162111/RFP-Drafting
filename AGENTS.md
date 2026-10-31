# Agent instructions

Read `CLAUDE.md` first, then the design spec at `docs/superpowers/specs/2026-10-31-rfp-drafting-design.md` and the current plan in `docs/superpowers/plans/`. Repository-specific instructions and higher-priority user or platform requirements take precedence over everything else.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
