#!/usr/bin/env node
// `npm publish` (unlike `pnpm publish`) does not rewrite `workspace:*` ranges,
// so plain `npm publish` from a copied dist/package.json would ship a broken
// dependency spec. Rewrite those ranges to the sibling package's current
// version before publishing.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [, , distPackageJsonPath] = process.argv;
if (!distPackageJsonPath) {
    console.error(
        'Usage: rewrite-workspace-deps.mjs <path/to/dist/package.json>',
    );
    process.exit(1);
}

const packagesDir = join(import.meta.dirname, '..', 'packages');
const versionByName = {};
for (const dir of readdirSync(packagesDir)) {
    const pkg = JSON.parse(
        readFileSync(join(packagesDir, dir, 'package.json'), 'utf8'),
    );
    versionByName[pkg.name] = pkg.version;
}

const pkg = JSON.parse(readFileSync(distPackageJsonPath, 'utf8'));
for (const field of ['dependencies', 'peerDependencies', 'devDependencies']) {
    const deps = pkg[field];
    if (!deps) continue;
    for (const [name, range] of Object.entries(deps)) {
        if (typeof range === 'string' && range.startsWith('workspace:')) {
            const version = versionByName[name];
            if (!version) {
                throw new Error(
                    `Cannot resolve workspace version for "${name}" (referenced in ${field} of ${pkg.name})`,
                );
            }
            deps[name] = `^${version}`;
        }
    }
}

writeFileSync(distPackageJsonPath, `${JSON.stringify(pkg, null, 4)}\n`);
