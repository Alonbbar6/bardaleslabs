// Things you can buy. `buy` is replaced by env links at build time where set.
export const products = [
  {
    id: "socialsnap", name: "SocialSnap", kind: "Hosted subscription",
    price: "$29", per: "/month", priceNote: "TODO(alonso): confirm price. Founding-customer pricing, cancel any time.",
    short: "AI content scheduler for Instagram and YouTube. Fill a queue, we post on schedule, and the AI turns your calls into short cartoon reels.",
    body: "SocialSnap keeps your Instagram and YouTube active without you logging in every other day. You keep a simple queue of posts: a date, a headline, a caption and up to ten images. SocialSnap publishes on a cadence you choose, enforces each platform's limits before anything goes out, and shows you a preview of every post in a private console. Record a sales call or a voice note and Call Cartoons turns the best 45–180 seconds into an animated clip and queues it as a Reel.",
    features: [
      ["Queue, not a calendar", "Add posts in order; SocialSnap picks the next free slot on your cadence."],
      ["Instagram + YouTube", "Feed posts, carousels and Reels; YouTube Shorts and videos."],
      ["Limits enforced", "Caption length, hashtag count and carousel size are checked before posting."],
      ["AI cartoon reels", "Turn a recorded call into a 1–3 minute cartoon with the real audio."],
      ["Private console", "Password-protected dashboard to preview, edit and trigger runs."],
      ["Your accounts", "Posts go out from your own Instagram and YouTube. We never hold your password."],
    ],
    cta: "Request access", ctaInterest: "SocialSnap",
    work: "socialsnap",
  },
  {
    id: "agent-office", name: "Agents at Work embed", kind: "Component + license",
    price: "From $49", per: "/month", priceNote: "TODO(alonso): confirm price. Includes updates; one site.",
    short: "The live 3D office you see on this site. Point it at your own agent events and your users watch your AI team work.",
    body: "A drop-in web component: six animated characters at desks, hand-offs with a box, labels that say what each agent is doing. Drive it from a WebSocket or server-sent events using a small JSON schema, or embed it as an iframe. Built on three.js, ~0.9 MB per character, renders on a phone.",
    features: [
      ["iframe or npm", "One tag, or import createOffice() and control it yourself."],
      ["Simple event schema", "agent.state with typing / carry / waiting / done / failed."],
      ["Your roster", "Rename agents, change the count, swap characters."],
      ["Low cost to run", "Pauses off-screen, capped pixel ratio, static poster on mobile."],
    ],
    cta: "Request access", ctaInterest: "Agents at Work embed", linkLabel: "See it live", link: "AGENTS_URL",
  },
  {
    id: "character-pack", name: "Office worker character pack", kind: "3D assets",
    price: "$5", per: "one-time", priceNote: "Lifetime license, unlimited projects. No redistribution.",
    short: "The six stylized office workers, as web-ready GLB files with a Mixamo-compatible rig and nine animations each.",
    body: "Typing, sitting idle, walking, carrying, cheering, finger-wag no, answering questions, idle and running. Meshopt-compressed with 1024px WebP textures, about 0.9 MB per character. Works in three.js, Blender, Unity and Godot.",
    features: [["6 characters", "Intake, designer, parts buyer, critic, reviser, report writer."], ["9 animations", "Mixamo clips baked into every file."], ["Web-ready", "Meshopt + WebP, ~0.9 MB each."], ["Commercial use", "Games, apps, sites, video."]],
    cta: "Buy for $5", buy: "STRIPE_LINK", linkLabel: "Read the license", link: "/LICENSE-MODELS.md",
  },
];
export const productById = Object.fromEntries(products.map(p => [p.id, p]));
