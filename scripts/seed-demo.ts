/** Dev only: fills DATABASE_PATH with a demo family. Run: DATABASE_PATH=./data/dev.db npx vite-node scripts/seed-demo.ts */
import { getDb } from '../src/lib/server/db';
import { users, managers, claims } from '../src/lib/server/db/schema';
import { hashPassword } from '../src/lib/server/auth';
import { createItem } from '../src/lib/server/lists';
import { currentSeason } from '../src/lib/season';

const db = getDb();
if (db.select().from(users).all().length) { console.log('already seeded'); process.exit(0); }
const pw = await hashPassword('wishbook-demo');
const mk = (username: string, displayName: string, avatarColor: string, extra = {}) =>
	db.insert(users).values({ username, displayName, avatarColor, passwordHash: pw, ...extra }).returning().all()[0];
const josh = mk('josh', 'Josh', '#F2B705', { isAdmin: true });
const kate = mk('kate', 'Kate', '#F4A6B4');
const june = mk('june', 'Grandma June', '#A9D3BE');
const rob = mk('rob', 'Rob', '#BFD0EE');
const milo = mk('milo', 'Milo', '#A9D3BE', { isManaged: true, passwordHash: null });
db.insert(managers).values([{ kidId: milo.id, managerId: josh.id }, { kidId: milo.id, managerId: kate.id }]).run();
const s = currentSeason(new Date());
const add = (who: typeof josh, owner: typeof josh, t: string, store: string, cents: number, extra = {}) =>
	createItem(who, owner.id, { title: t, store, priceCents: cents, scrapeStatus: 'ok', url: 'https://example.com', ...extra }, s);
const a = add(june, june, 'Lodge 6-qt enameled Dutch oven, Island Spice Red', 'Lodge', 7990);
add(june, june, 'Kindle Paperwhite Signature Edition', 'Amazon', 14999, { listPriceCents: 18999, priority: 'most', notes: 'Metallic Jade, please' });
add(june, june, 'Merino wool slipper socks, size M', 'Etsy', 2400);
const d = add(june, june, 'Grandkids photo book 2026', 'Shutterfly', 4500);
db.insert(claims).values([{ itemId: a.id, claimerId: josh.id }, { itemId: d.id, claimerId: kate.id }]).run();
const h = add(josh, josh, 'Sony WH-1000XM6 headphones', 'Amazon', 39800, { priority: 'most' });
add(josh, josh, 'LEGO Botanical Bonsai set', 'LEGO', 4999);
add(josh, josh, 'Fellow Stagg EKG kettle, matte black', 'Fellow', 16500);
db.insert(claims).values({ itemId: h.id, claimerId: kate.id }).run();
add(josh, milo, 'Co-op REV 20" kids bike', 'REI', 32900, { priority: 'most' });
const f = add(josh, milo, 'LEGO City Fire Station', 'LEGO', 9999);
db.insert(claims).values({ itemId: f.id, claimerId: june.id }).run();
add(kate, kate, 'Le Creuset mug set', 'Le Creuset', 6000);
console.log('seeded: log in as josh / wishbook-demo');
