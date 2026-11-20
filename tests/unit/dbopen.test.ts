import { chmodSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { openDatabase } from '../../src/lib/server/db';

let dir = '';
afterEach(() => { if (dir) chmodSync(dir, 0o700); });

it('explains an unwritable data folder', () => {
	dir = mkdtempSync(join(tmpdir(), 'wb-'));
	chmodSync(dir, 0o500);
	expect(() => openDatabase(join(dir, 'wishbook.db'))).toThrow(/can’t write to .* Give the container’s user ownership/);
});
