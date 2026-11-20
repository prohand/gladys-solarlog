import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollChangelog } from '../.github/scripts/changelog-release.mjs';

const REPO = 'https://github.com/prohand/gladys-solarlog';

test('the Unreleased section moves under the released version', () => {
  const text = `# Changelog\n\n## [Unreleased]\n\n### Added\n\n- Thing.\n\n[Unreleased]: ${REPO}/commits/main\n`;
  const rolled = rollChangelog(text, '1.0.0', '2026-11-20');
  assert.match(
    rolled,
    /## \[Unreleased\]\n\n## \[1\.0\.0\] - 2026-11-20\n\n### Added\n\n- Thing\./,
  );
  assert.match(rolled, new RegExp(`\\[1\\.0\\.0\\]: ${REPO}/releases/tag/v1\\.0\\.0`));
  assert.match(rolled, new RegExp(`\\[Unreleased\\]: ${REPO}/compare/v1\\.0\\.0\\.\\.\\.HEAD`));
});

test('an empty Unreleased section still names the release', () => {
  const text = `## [Unreleased]\n\n## [1.0.0] - 2026-11-20\n\n- First.\n`;
  assert.match(
    rollChangelog(text, '1.0.1', '2026-11-21'),
    /## \[1\.0\.1\] - 2026-11-21\n\n- Maintenance/,
  );
});
