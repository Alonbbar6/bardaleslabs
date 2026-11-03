# bardaleslabs.com

Company site for BardalesLabs: services, work, iOS apps, store, lab, about, contact.
Static, data-driven: every page is generated from `src/data/*.js` by `scripts/gen.mjs`, then built with Vite.
The 3D agent office comes from `../pixel-web` (imported as `@office`).

```
npm install
npm run dev        # generates pages/ then serves http://localhost:5174
npm run build      # pages/ -> dist/  (24 pages, three.js code-split onto office pages only)
npm run deploy     # wrangler pages deploy dist --project-name bardaleslabs
```

## Editing content
| File | What |
|---|---|
| `src/data/company.js` | tagline, positioning, founder, nav, home-page stats (`TODO(alonso)`), partner names |
| `src/data/services.js` | six service lines; `work: [ids]` links case studies; lead generation has `steps` that drive the office |
| `src/data/work.js` | case studies → `/work/<id>/`; `featured: true` shows on home |
| `src/data/apps.js` | iOS apps → `/apps/`; add `store` URLs (`TODO(alonso)`) |
| `src/data/products.js` | store items → `/store/<id>/` (SocialSnap, Agents at Work embed, character pack) |
| `src/data/about.js` | bio, principles, timeline, capabilities |
| `src/agents.js` | lead-gen agent roster + demo script shown in the office |
| `src/render/*.mjs` | HTML templates (layout, components, pages) |

Add a project = one object in `work.js`. Add a product = one object in `products.js`. Re-run `npm run gen`.

## Configuration
| Where | Key | Purpose |
|---|---|---|
| `.env` | `VITE_AGENTS_WS` | WebSocket streaming real agent events into the office. Empty = scripted demo. |
| `.env` | `VITE_AGENTS_URL` | URL of the standalone "Agents at work" page (pixel-web). |
| `.env` | `VITE_STRIPE_LINK` | Stripe Payment Link for the $5 character pack. Unset = routes to contact. |
| Pages env | `RESEND_API_KEY`, `CONTACT_FROM`, `CONTACT_TO` | `/api/contact` (functions/) emails the form via Resend; otherwise the form falls back to a prefilled `mailto:`. |

## Design rules
One typeface, sentence case, dark. One effect per section (line reveals; the office where it means something).
Fixed "Book a call" in the nav and a call to action at the end of every section. No loader, ticker or magnetic buttons.
