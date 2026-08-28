# Pick Your Fight

A lane-defence game in the Plants vs Zombies 2 mould - but the fight is yours to
pick. Bees against hornets, doctors against viruses, campers against mosquitos,
knights against goblins, and more. Same tactics, completely different cast.

No unit levelling. What you plant on wave one is exactly as strong on wave twenty.

- Live: https://androidbill.github.io/pick-your-fight/
- Static PWA, no build step. Everything ships from `public/`.
- `node scripts/check.mjs` imports every module to catch a syntax error before it
  becomes a blank screen on a phone.

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
