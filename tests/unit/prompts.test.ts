import { describe, expect, it } from 'vitest';
import { choosePrompt, type PromptEnv } from '../../src/lib/prompts';

const env = (o: Partial<PromptEnv> = {}): PromptEnv => ({
	standalone: false, ios: false, pushSupported: true, permission: 'default', subscribed: false,
	optedOut: false, installSnoozed: false, notifySnoozed: false, ...o
});

describe('choosePrompt: in a browser tab', () => {
	it('walks iPhone users through Add to Home Screen', () => expect(choosePrompt(env({ ios: true, pushSupported: false }))).toBe('ios-install'));
	it('stays quiet once snoozed', () => expect(choosePrompt(env({ ios: true, installSnoozed: true }))).toBe('none'));
	it('does not nag desktop or Android until the browser offers an install', () => expect(choosePrompt(env())).toBe('none'));
	it('never asks for notifications in a tab', () => expect(choosePrompt(env({ ios: true, installSnoozed: true, permission: 'default' }))).toBe('none'));
});

describe('choosePrompt: installed app', () => {
	it('asks about notifications by default', () => expect(choosePrompt(env({ standalone: true, ios: true }))).toBe('notify'));
	it('does not ask again once subscribed', () => expect(choosePrompt(env({ standalone: true, subscribed: true }))).toBe('none'));
	it('respects a denied permission', () => expect(choosePrompt(env({ standalone: true, permission: 'denied' }))).toBe('none'));
	it('respects someone who turned them off', () => expect(choosePrompt(env({ standalone: true, optedOut: true }))).toBe('none'));
	it('respects “not now”', () => expect(choosePrompt(env({ standalone: true, notifySnoozed: true }))).toBe('none'));
	it('does nothing where push is unsupported', () => expect(choosePrompt(env({ standalone: true, pushSupported: false }))).toBe('none'));
});
