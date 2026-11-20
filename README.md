# Wishbook

The Crosby Family Christmas wishlists. Self-hosted, phone-first, installable as an app.

- Everyone keeps a list; parents keep lists for kids who don't log in.
- Add a gift by pasting (or sharing) a link from Amazon or any store. Wishbook fills in the name, picture, and price.
- Family members tap **I'll get this** so nobody doubles up. The person whose list it is never sees what's been claimed.
- Prices are re-checked every night at 3am.
- After Christmas, mark gifts received. Open gifts carry over to next year.

## Run it with Docker

1. Copy `docker-compose.yml` and edit the three settings in it:
   - `ORIGIN`: the exact public address, e.g. `https://wishbook.crosby.family`. Form posts from any other address are rejected.
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD`: your account. Only used the first time the app starts with an empty database; change the password later from the **Me** tab.
   - `TZ`: your time zone, so the 3am price check happens at 3am for you.
2. Start it:

   ```bash
   docker compose up -d --build
   ```

3. Open the address, sign in, then go to **Me → People and kids** to add everyone.

Data lives in `./data/wishbook.db` (SQLite). The container listens on port 3000 and has a health check at `/api/health`.

### Behind a reverse proxy

- Serve it over HTTPS. Phones only offer "Add to Home Screen" as an app on HTTPS, and sign-in cookies are marked secure.
- Pass the usual forwarding headers: `X-Forwarded-Proto`, `X-Forwarded-Host`, and `X-Forwarded-For`. The image is already configured to trust one proxy hop for these (`XFF_DEPTH=1`). If you have two proxies in a row, raise `XFF_DEPTH`.
- No websockets or special paths are needed.

### Backups

Copy `data/wishbook.db` while the app is stopped, or take a live copy with:

```bash
docker exec wishbook node -e "require('better-sqlite3')('/data/wishbook.db').backup('/data/backup.db').then(()=>console.log('ok'))"
```

## Importing from Elfster

**Me → Import from Elfster.** Pick the person, paste the address of their Elfster wish list (it contains `wish-lists`), review, and import. The list must be public on Elfster. Who-bought-what on Elfster is not brought over.

## Prices

Amazon sometimes blocks automated checks from home internet connections. When that happens the gift keeps its last known price, and **Me → Prices** shows how many checks were blocked. Some stores (Target, Walmart) give a name and picture but no price; type the price in when adding.

## Development

```bash
npm install
DATABASE_PATH=./data/dev.db npx tsx scripts/seed-demo.ts   # demo family, sign in as josh / wishbook-demo
DATABASE_PATH=./data/dev.db DISABLE_PRICE_REFRESH=1 npm run dev
npm test
npm run check
node scripts/build-icons.mjs   # after changing anything in design/brand/
```

Stack: SvelteKit 2 (Svelte 5, Node adapter), SQLite via Drizzle, Vitest. The rule that keeps claims secret lives in `src/lib/server/visibility.ts`; every page that shows gifts goes through it.
