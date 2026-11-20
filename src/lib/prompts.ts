export type Prompt = 'none' | 'ios-install' | 'notify';

export type PromptEnv = {
	standalone: boolean;
	ios: boolean;
	pushSupported: boolean;
	permission: NotificationPermission;
	subscribed: boolean;
	optedOut: boolean;
	installSnoozed: boolean;
	notifySnoozed: boolean;
};

/** What to offer right now. (Android's install button comes from the browser's own event, not from here.) */
export function choosePrompt(e: PromptEnv): Prompt {
	if (!e.standalone) return e.ios && !e.installSnoozed ? 'ios-install' : 'none';
	if (!e.pushSupported || e.permission === 'denied' || e.optedOut || e.notifySnoozed || e.subscribed) return 'none';
	return 'notify';
}
