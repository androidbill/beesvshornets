# Pick Your Fight

A lane-defence game in the Plants vs Zombies 2 mould - but the fight is yours to
pick. Bees against hornets, doctors against viruses, campers against mosquitos,
knights against goblins, and more. Same tactics, completely different cast.

No unit levelling. What you plant on wave one is exactly as strong on wave twenty.

- Live: https://androidbill.github.io/pick-your-fight/
- Static PWA, no build step. Everything ships from `public/`.
- `node scripts/check.mjs` imports every module to catch a syntax error before it
  becomes a blank screen on a phone.

Landscape only - nine columns of lane defence needs the width.
