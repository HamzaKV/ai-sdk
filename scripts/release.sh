#!/usr/bin/env bash
#
# Publishes the built `dist/` of each publishable package to npm using npm's
# trusted publishing (OIDC) — no NPM_TOKEN required. Run by the Changesets
# action after a "Version Packages" PR is merged (i.e. when no changesets remain).
#
# Safe to run on any push to main: packages whose current version is already on
# the registry are skipped, so it is a no-op unless a version was just bumped.
#
# Requires (in CI): npm >= 11.5.1, `id-token: write` permission, and a trusted
# publisher configured on npmjs.com for each package (repo HamzaKV/ai-sdk,
# workflow release.yml). See CONTRIBUTING.md.
set -euo pipefail

# Dependency order matters: a package must publish after everything it depends
# on, since rewrite-workspace-deps.mjs resolves internal ranges from the
# sibling packages' *current* package.json version.
PACKAGES=(
    packages/ai
    packages/utils
    packages/state
    packages/file-storage
    packages/evals
    packages/mcp
    packages/signatures
    packages/provider.anthropic
    packages/provider.openai
    packages/ui.core
    packages/ui.react
)

to_publish=()
for dir in "${PACKAGES[@]}"; do
    name=$(node -p "require('./${dir}/package.json').name")
    version=$(node -p "require('./${dir}/package.json').version")
    if npm view "${name}@${version}" version >/dev/null 2>&1; then
        echo "⏭  ${name}@${version} is already published — skipping"
    else
        echo "📦 ${name}@${version} will be published"
        to_publish+=("${dir}")
    fi
done

if [ ${#to_publish[@]} -eq 0 ]; then
    echo "Nothing to publish."
    exit 0
fi

# Build only when there is something to publish.
pnpm -r run build

for dir in "${to_publish[@]}"; do
    name=$(node -p "require('./${dir}/package.json').name")
    version=$(node -p "require('./${dir}/package.json').version")
    node scripts/rewrite-workspace-deps.mjs "./${dir}/dist/package.json"
    echo "Publishing ${name}@${version} from ${dir}/dist ..."
    npm publish "./${dir}/dist" --provenance --access public
done

# Tag the released versions and push the tags.
pnpm exec changeset tag
git push origin --tags
