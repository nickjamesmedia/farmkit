// Prebuild: derive the app version from git and write build-info.json.
//
// Scheme: version = <major>.<minor>.<tagPatch + commits since latest v* tag>,
// so every commit past the v0.1.0 beta tag auto-increments the patch number.
// When git isn't available (e.g. a source upload without .git), the committed
// build-info.json from the machine that ran the last build is kept as-is.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const outPath = fileURLToPath(new URL('../build-info.json', import.meta.url));

function git(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
}

try {
  // only strict semver tags (vX.Y.Z) count as version baselines
  const tag = git('git describe --tags --match "v[0-9]*.[0-9]*.[0-9]*" --abbrev=0');
  const count = Number(git(`git rev-list ${tag}..HEAD --count`));
  const sha = git('git rev-parse --short HEAD');
  const parts = tag.replace(/^v/, '').split('.').map((p) => Number.parseInt(p, 10));
  if (parts.some(Number.isNaN)) throw new Error(`unparseable tag ${tag}`);
  const [major, minor, patch] = parts;
  const version = `${major}.${minor}.${(patch || 0) + count}`;
  const info = {
    version,
    sha,
    builtAt: new Date().toISOString().slice(0, 16) + 'Z',
  };
  writeFileSync(outPath, JSON.stringify(info, null, 2) + '\n');
  console.log(`build-info: v${version} (${sha})`);
} catch {
  console.log('build-info: git unavailable — keeping committed build-info.json');
}
