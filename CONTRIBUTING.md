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

## Releasing (Changesets + npm trusted publishing)

Versioning and changelogs are managed by [Changesets](https://github.com/changesets/changesets).
The pipeline is gated: the `Release` workflow runs only **after the `CI` workflow succeeds on
`main`** (via `workflow_run`), so a release can't happen unless lint, typecheck, unit tests, and
builds have all passed.

1. **With your change**, add a changeset describing the user-facing impact:

   ```bash
   pnpm changeset
   ```

   Select the affected package(s), choose `patch` / `minor` / `major`, and write a summary.
   Commit the generated file in `.changeset/` along with your code.

2. **On merge to `main`** (after CI passes), the `Release` workflow runs the Changesets action,
   which opens (or updates) a **"Version Packages"** PR. That PR bumps versions and writes each
   package's `CHANGELOG.md`.

3. **Merging the "Version Packages" PR** triggers publishing (`scripts/release.sh`): for each
   publishable package whose new version isn't on the registry yet, it builds, rewrites any
   internal `workspace:*` dependency range to the sibling package's current version (`npm
   publish`, unlike `pnpm publish`, doesn't do this for you), runs `npm publish ./dist
   --provenance`, then tags the released versions (e.g. `@varlabs/ai.utils@1.0.3`) and pushes the
   tags. All 11 packages compile to `dist/` and are published from there, in dependency order.

### Authentication: npm trusted publishing (OIDC)

Publishing uses [npm trusted publishing](https://docs.npmjs.com/trusted-publishers) — **no
`NPM_TOKEN` secret is needed**. The workflow requests an OIDC token (`id-token: write`) and npm
authenticates the GitHub Actions run directly.

One-time setup on npmjs.com, **for each of the 11 packages**:

1. Go to the package page → **Settings** → **Trusted Publisher**.
2. Add a **GitHub Actions** publisher with:
   - **Repository owner:** `HamzaKV`
   - **Repository:** `ai-sdk`
   - **Workflow filename:** `release.yml`
3. Save.

Notes:
- Trusted publishing only works for **already-published** packages. A brand-new package name must
  be published once the traditional way (see below) before a trusted publisher can be added.
- The workflow pins npm to the `11.x` line (not `@latest`) for trusted publishing; see the comment
  in `release.yml` for why.
- `--provenance` requires the repository to be **public**.

### Local / manual publish (fallback, and required for a package's first-ever publish)

Trusted publishing only works inside CI, and npm has no way to OIDC-publish a package that has
never existed on the registry. To publish manually, log in with `npm login`, build, and publish
from `dist/`:

```bash
pnpm --filter <name> run build
node scripts/rewrite-workspace-deps.mjs packages/<dir>/dist/package.json
npm publish packages/<dir>/dist --access public
```
