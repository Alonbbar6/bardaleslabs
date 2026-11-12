# bardaleslabs.com

Company site for BardalesLabs: services, work, iOS apps, store, Miami-Dade car directory, lab, about, contact.
Mostly static and data-driven: every page is generated from `src/data/*.js` by `scripts/gen.mjs`, then built with Vite.
Two sections are live data, rendered by the Worker per request from D1 (photos and files in R2), so they change without a redeploy:
`/cars/` (car listings) and the digital products in `/store/`. Both are managed from the admin at `/admin/`.
The 3D agent office comes from `../pixel-web` (imported as `@office`).

```
npm install
npm run dev        # generates pages/ then serves http://localhost:5174 (static pages; /api, /cars, /media proxy to dev:api)
npm run build      # pages/ -> dist/  (three.js code-split onto office pages only)
npm run deploy     # build + wrangler deploy (Worker + static assets)
```

## Editing content
| File | What |
|---|---|
| `src/data/company.js` | tagline, positioning, founder, nav, home-page stats (`TODO(alonso)`), partner names |
| `src/data/services.js` | six service lines; `work: [ids]` links case studies; lead generation has `steps` that drive the office |
| `src/data/work.js` | case studies → `/work/<id>/`; `featured: true` shows on home |
| `src/data/apps.js` | iOS apps → `/apps/`; add `store` URLs (`TODO(alonso)`) |
| `src/data/products.js` | software in the store → `/store/<id>/` (SocialSnap, Agents at Work embed, character pack) |
| admin → **Store** | digital products: name, price, cover, the file buyers download. Live in `/store/` as soon as you save |
| admin → **Cars** | car listings with photos → `/cars/` and `/cars/<id>/` |
| `src/data/cars.js` | car directory copy (hero, how it works, disclaimer) and pick-lists (makes, body types, Miami-Dade areas) |
| `src/data/about.js` | bio, principles, timeline, capabilities |
| `src/agents.js` | lead-gen agent roster + demo script shown in the office |
| `src/render/*.mjs` | HTML templates (layout, components, pages; `cars.mjs` and `store.mjs` are also used by the Worker) |

Add a project = one object in `work.js`. Add a product = one object in `products.js`. Re-run `npm run gen`.

## Configuration
| Where | Key | Purpose |
|---|---|---|
| `.env` | `VITE_AGENTS_WS` | WebSocket streaming real agent events into the office. Empty = scripted demo. |
| `.env` | `VITE_AGENTS_URL` | URL of the standalone "Agents at work" page (pixel-web). |
| `.env` | `VITE_STRIPE_LINK` | Stripe Payment Link for the $5 character pack. Unset = routes to contact. (Or move the pack to admin → Store: an admin product with id `character-pack` replaces this entry.) |
| Worker secret | `RESEND_API_KEY` (+ `CONTACT_FROM`, `CONTACT_TO` vars) | Contact form email and store receipts via Resend; without it the form falls back to `mailto:` and buyers get their link on the thank-you page only. |
| Worker secret | `ADMIN_PASSWORD` | Admin login at `/admin/`. |
| Worker secret | `STRIPE_SECRET_KEY` | Store checkout. Unset = paid products show a request form instead of a Buy button. Free products work without it. |
| Worker secret | `STRIPE_WEBHOOK_SECRET` | Signing secret of the `/api/store/webhook` endpoint: confirms payments if the buyer closes the tab, and marks refunds. |
| `wrangler.toml` | `MEDIA` (R2) | Bucket `bardaleslabs-media`: car photos and product covers (public under `/media/`), product files (private, token downloads only). |

## First deploy of the car directory and store
1. `npx wrangler r2 bucket create bardaleslabs-media` (once; `wrangler deploy` fails until the bucket exists)
2. `npm run db:migrate` (adds the `cars`, `store_products`, `store_orders` tables; safe to re-run)
3. `npm run deploy`
4. To sell paid products: Stripe → Developers → API keys → `npx wrangler secret put STRIPE_SECRET_KEY`.
   Then Stripe → Developers → Webhooks → add `https://bardaleslabs.com/api/store/webhook` with the events
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, and save its signing secret with
   `npx wrangler secret put STRIPE_WEBHOOK_SECRET`. Start with `sk_test_...` keys and a test card, then switch to live keys.

Admin → Store shows a checklist of what's still missing.

## Car directory
Spot a car with a for-sale sign, open `/admin/#cars/new` on your phone, add photos (pick from the camera roll), type in what the sign says, save.
Photos are resized in the browser (1600 px, plus a 640 px thumbnail) and re-encoded, which also strips EXIF data such as GPS location.
Statuses: **draft** (only you; preview from the listing link), **available**, **sale pending** (listed with a badge), **sold** (off the list, page stays up so shared links work).
The VIN button fills year/make/model/trim from NHTSA's free decoder. Listings show "Spotted N days ago"; the admin flags ones that have been up 30+ days.

## Store (digital products)
Admin → Store → New product: name, URL, price (0 = free download in exchange for an email), description, "Title: detail" feature lines, cover image and the file.
Files of any size upload in 10 MB parts. A product can't go live without a file, and one with orders can be archived but not deleted.
Checkout is Stripe Checkout; the order is created by the webhook or by the thank-you page (whichever comes first), and the buyer gets a download link
that works 10 times (`DOWNLOAD_LIMIT` in `src/render/store.mjs`). Orders, revenue and free-download emails are in Admin → Store.

## Local development with the Worker (cars, store, admin)
```
npm run db:local                      # create the tables in the local D1
printf 'ADMIN_PASSWORD=local\n' > .dev.vars   # plus STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET test keys to try checkout
npm run build && npm run dev:api      # http://localhost:8788, with local D1 + R2 under .wrangler/state
```

## Design rules
One typeface, sentence case, dark. One effect per section (line reveals; the office where it means something).
Fixed "Book a call" in the nav and a call to action at the end of every section. No loader, ticker or magnetic buttons.
