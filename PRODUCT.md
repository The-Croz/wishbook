# Product

<!-- impeccable:product-schema 1 -->

## Platform

web (installable PWA, phone-first)

## Stack

delegated: SvelteKit (Node adapter) + SQLite (via Drizzle) in a single Docker container with a mounted data volume. Built-in username/password accounts with session cookies. Served behind the owner's existing reverse proxy (TLS terminates there). Chosen for one-container simplicity and small footprint on a home server.

## Users

One extended family sharing Christmas wishlists, mostly on phones.
- **Adults**: log in, keep their own list, shop for others.
- **Managed kids**: have lists but don't log in; one or more parents manage them.
- **Admin** (the host): creates accounts, runs the one-time Elfster import.

## Product Purpose

Replace Elfster with a private, self-hosted family wishlist. Success = everyone can add a gift in seconds by pasting a link, and no one ever buys a duplicate or spoils a surprise.

## Positioning

Private and family-owned: no ads, no third-party account, data lives on the family's own server.

## Capabilities and Constraints

- **Lists**: one per person per Christmas year; roll over yearly, received items archive.
- **Add by link**: paste a URL (Amazon first-class, any site via Open Graph/JSON-LD/meta) → auto-fill title, image, price, description. Manual entry always available.
- **Price freshness**: scrape on add, nightly server refresh, show "price checked <time>". Amazon may block; degrade to last known price, never error out.
- **Claiming**: other members mark "purchased"; givers see who claimed it ("Claimed by Mom"). The list owner never sees claim status anywhere (UI, API, notifications). For managed kids' lists, managing parents are givers and DO see claims.
- **Edit/delete**: only the owner or a kid's managers. Others claim only.
- **Received**: owner/managers mark items received after Christmas.
- **Elfster import**: one-time admin import (no ongoing feature). Elfster has no export API; admin pastes a copied Elfster list, reviews it, and Wishbook re-fetches each link.
- **Auth**: per-user login required since it's exposed publicly via reverse proxy. Admin-created accounts, no open signup.

## Brand Commitments

The project, repo (The-Croz/wishbook), container, and app are all named **Wishbook**. App title (PWA name, browser tab, headers): **Wishbook**. The logo reads **Crosby Family** (never just "Crosby"). Logo: option 4, "Stack of presents" (green / red / yellow boxes stacked, beside "Crosby Family" in two lines). The stack alone is the app icon. Source files in design/brand/. Built for one family, not a general product.

## Evidence on Hand

None yet. No existing Elfster export captured.

## Product Principles

1. The surprise is sacred: secrecy is enforced server-side, not just hidden in the UI.
2. Pasting a link is the whole add flow.
3. Phone-first, one-thumb use.
4. Prices are honest about their age.
5. Works for grandparents: no jargon, big targets.
