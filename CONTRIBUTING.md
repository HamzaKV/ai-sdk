# Contributing

## Setup

This is a pnpm workspace. Node version is pinned in [`.nvmrc`](./.nvmrc).

```bash
pnpm install
```

## Scripts

Run from the repo root, fanning out across all packages:

| Script | What it does |
|---|---|
| `pnpm run build` | Build every package (`tsc` + copy README/package.json/LICENSE into `dist/`) |
| `pnpm run test` | Run unit tests (excludes live-API contract tests) |
| `pnpm run test:contract` | Run the Anthropic/OpenAI contract tests - requires `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` |
| `pnpm run typecheck` | `tsc --noEmit` across every package |
| `pnpm run lint` / `pnpm run lint:fix` | Biome check / check with autofix |
| `pnpm run coverage` | Vitest coverage report per package (visibility only, no gate) |

Or scope any of these to a single package with `pnpm --filter <name> run <script>`.

A pre-commit hook (via husky) runs `lint` + `typecheck` before every commit. CI (`.github/workflows/ci.yml`) runs lint, typecheck, test, and build on every push and PR to `main`.

## Contract tests

`packages/provider.anthropic` and `packages/provider.openai` each have an `index.contract.test.ts` that hits the real API to catch upstream drift. They're skipped automatically unless the relevant API key is set in your environment - set `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` locally to run them via `pnpm run test:contract`.

## Commit convention

Small, independently-committable changes - one logical change per commit rather than one large commit per feature.

## Releasing

Each package publishes independently via its own `patch`/`minor`/`major` and `roll`/`roll:patch`/`roll:minor`/`roll:major` scripts (`pnpm --filter <name> run roll:patch`, etc.). These check out `main`, bump the version with `npm version`, push the tag, build, and `npm publish` from `dist/`.
