import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

test('native confidence gate rejects unverified probe scores and malformed results', () => {
  const directory = mkdtempSync(join(tmpdir(), 'joy-policy-'))
  try {
    const source = join(directory, 'test.c')
    const binary = join(directory, 'test')
    const include = fileURLToPath(new URL('../../host/modules/local-voice/', import.meta.url))
    writeFileSync(
      source,
      `#include <assert.h>
#include "joy-command-policy.h"
int main(void) {
    for (int id = 1; id <= 4; id++) {
        assert(!joy_command_accepted(id, 0.605f));
        assert(joy_command_accepted(id, 0.9f));
    }
    assert(!joy_command_accepted(3, 0.484f));
    for (int id = 1; id <= 5; id++) {
        assert(!joy_command_accepted(id, NAN));
        assert(!joy_command_accepted(id, INFINITY));
        assert(!joy_command_accepted(id, -0.1f));
        assert(!joy_command_accepted(id, 1.1f));
        for (int step = 0; step < 100; step++) {
            float score = step / 100.0f;
            if (joy_command_accepted(id, score)) assert(joy_command_accepted(id, score + 0.01f));
        }
    }
    assert(!joy_command_accepted(0, 1.0f));
    assert(!joy_command_accepted(6, 1.0f));
    return 0;
}
`,
    )
    execFileSync('cc', ['-std=c11', '-Wall', '-Werror', '-I', include, source, '-o', binary])
    assert.equal(execFileSync(binary).length, 0)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
