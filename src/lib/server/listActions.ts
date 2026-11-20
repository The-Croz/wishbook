import { fail } from '@sveltejs/kit';
import type { User } from './db/schema';
import { reorderList, resetListOrder } from './lists';

/** Form actions shared by "My list" and a managed person's list. */
export function listOrderActions(ownerOf: (me: User, url: URL, params: Record<string, string>) => number) {
	return {
		reorder: async ({ locals, request, url, params }: { locals: App.Locals; request: Request; url: URL; params: Record<string, string> }) => {
			const me = locals.user!;
			const ids = String((await request.formData()).get('ids') ?? '').split(',').map(Number).filter(Number.isInteger);
			if (!ids.length) return fail(400, { message: 'Nothing to arrange' });
			reorderList(me, ownerOf(me, url, params), ids);
			return { arranged: true };
		},
		resetOrder: ({ locals, url, params }: { locals: App.Locals; url: URL; params: Record<string, string> }) => {
			const me = locals.user!;
			resetListOrder(me, ownerOf(me, url, params));
			return { arranged: false };
		}
	};
}
