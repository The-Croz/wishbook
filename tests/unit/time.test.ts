import { expect, it } from 'vitest';
import { timeAgo } from '../../src/lib/time';
const now = 1_800_000_000_000;
it('says just now under a minute', () => expect(timeAgo(now - 30_000, now)).toBe('just now'));
it('uses singular', () => expect(timeAgo(now - 3_600_000, now)).toBe('1 hour ago'));
it('uses days', () => expect(timeAgo(now - 3 * 86_400_000, now)).toBe('3 days ago'));
