# Pick Your Fight

Bees vs Hornets - a lane-defence game in the Plants vs Zombies 2 mould. Build
your hive, hold the garden, defeat the Hornet Queen.

No unit levelling. What you plant on wave one is exactly as strong on wave twenty.

The engine underneath separates generic roles from the cast that plays them
(see below), so a second matchup stays cheap to add later if that changes -
but for now this is the one game.

- Live: https://androidbill.github.io/pick-your-fight/
- Static PWA, no build step. Everything ships from `public/`.
- `node scripts/check.mjs` imports every module to catch a syntax error before it
  becomes a blank screen on a phone.
- `node scripts/bot-tournament.mjs [runsPerLevel]` plays every campaign level
  and Survival headlessly with a simple heuristic bot, through the real rules
  (real costs, cooldowns, wave budgets) — a sanity check on the numbers, not a
  substitute for actually playing it.

## How a matchup is built

The engine owns the behaviour, a battle pack owns the identity.

- `js/defender-roles.js` and `js/invader-roles.js` define the roles the
  simulation knows how to run - `producer`, `shooter`, `wall`, `chiller`,
  `giant` and so on - with their stats, behaviour and a procedural fallback
  drawing.
- `js/battle-packs/<name>.js` maps a cast onto those roles: names, blurbs,
  costs, sprites. Bees vs Hornets is the reference pack.
- `js/battle-packs/<name>-levels.js` holds that pack's campaign and its wave
  generator.

A fighter is drawn from its sprite when the image has loaded and from its
`creature.js` spec when it has not, so a new matchup is playable before any
artwork exists for it.

Landscape only - nine columns of lane defence needs the width.

## Installable PWA

`manifest.webmanifest` ships 192/512/maskable PNG icons plus an apple-touch-icon
(needed for Chrome/Android to actually offer a real install, not just a
bookmark shortcut). `display_override: ["fullscreen", "standalone"]` hides the
OS status bar in installed mode on browsers that support it.

The app always checks whether it's on the latest deploy: on load, when the tab
regains visibility, and every few minutes while open. If the server disagrees
with what's running, a small banner offers a refresh. That refresh unregisters
the current service worker before reloading rather than trusting the browser's
own update check to notice - this file's own source never changes between
versions (only the `?v=` query string does), which is exactly the kind of
change some browsers' byte-compare can silently miss.
