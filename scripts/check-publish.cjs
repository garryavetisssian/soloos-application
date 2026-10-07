// Local publication check: never prints matched credential values.
const { execFileSync } = require('node:child_process');
const { readFileSync, statSync } = require('node:fs');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const files = git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean);
const secretPattern = /(?:AIza[0-9A-Za-z_-]{35}|gh[pousr]_[0-9A-Za-z]{30,}|github_pat_[0-9A-Za-z_]{40,}|sk-(?:live-|proj-)?[0-9A-Za-z_-]{32,}|sb_secret_[0-9A-Za-z_-]{20,}|figd_[0-9A-Za-z_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|eyJ[0-9A-Za-z_-]{15,}\.eyJ[0-9A-Za-z_-]{15,}\.[0-9A-Za-z_-]{15,})/;
const problems = new Set();
for (const file of files) {
  if (/(^|\/)\.env(?:\.|$)/.test(file) && file !== '.env.example') problems.add(`Environment file included: ${file}`);
  if (/\.(pem|key)$/.test(file)) problems.add(`Private-key file included: ${file}`);
  const stats = statSync(file);
  if (!stats.isFile()) continue;
  if (stats.size >= 100 * 1024 * 1024) problems.add(`File exceeds GitHub's 100 MiB limit: ${file}`);
  if (stats.size < 2 * 1024 * 1024 && secretPattern.test(readFileSync(file, 'utf8'))) problems.add(`Possible credential in: ${file}`);
}
// Scan reachable history too: .gitignore cannot remove already-committed secrets.
const pattern = 'AIza[0-9A-Za-z_-]{35}|gh[pousr]_[0-9A-Za-z]{30,}|github_pat_[0-9A-Za-z_]{40,}|sb_secret_[0-9A-Za-z_-]{20,}|figd_[0-9A-Za-z_-]{20,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|eyJ[0-9A-Za-z_-]{15,}\\.eyJ[0-9A-Za-z_-]{15,}\\.[0-9A-Za-z_-]{15,}';
for (const revision of git('rev-list', '--all').trim().split('\n').filter(Boolean)) {
  try {
    const matches = git('grep', '-I', '-l', '-E', pattern, revision, '--', '.', ':!scripts/check-publish.cjs');
    for (const match of matches.trim().split('\n').filter(Boolean)) problems.add(`Possible credential in history: ${match}`);
  } catch (error) { if (error.status !== 1) throw error; }
}
if (problems.size) {
  for (const problem of problems) console.error(problem);
  process.exitCode = 1;
} else console.log('Publication check passed: no detected credential patterns, tracked private environment files or oversized working-tree files. This is a targeted check, not a guarantee.');
