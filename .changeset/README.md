# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets). It tracks
intended version bumps for the 11 publishable packages in this monorepo.

## Adding a changeset

When you make a change that should be released, run:

```bash
pnpm changeset
```

Pick the affected package(s), choose the bump type (`patch` / `minor` / `major`), and write a
short summary. This creates a markdown file in this folder — commit it alongside your change.

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full release flow.
