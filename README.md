# Bloom Circuit

A quiet connection puzzle for [start.ng](https://start.ng). Turn the paths, connect every tile to the golden seed, and bring six gardens into bloom.

## Play

- Click or tap a tile to turn it clockwise.
- Right-click or Shift-click to turn it counterclockwise.
- Use arrow keys to explore, Enter/Space to turn, and Shift+Enter to turn back.
- Hints set and lock one tile in its correct orientation, costing 180 points.
- Undo reverses a turn and counts as another turn.
- Each garden earns `max(100, 1800 - turns × 12 - hints × 180)` points.
- There is no countdown. The timer stops on pause and when the page is hidden.

The same six seeded gardens make runs comparable. Every generated garden is a connected spanning tree and has a guaranteed solution. Progress and personal best are stored on this device. start.ng handles character profiles, sign-in, and shared scores. The shared board ranks gardens grown, score, then active time.

## Run locally

Serve this folder with any static web server, for example `python -m http.server 4173`. No build step, packages, external scripts, passwords, or API keys are required. Profile and leaderboard features activate on the published `*.start.ng` origin. The game works locally and as a guest.

## Publish

Commit the ready-to-play files to a public GitHub repository. Follow [the start.ng documentation](https://start.ng/docs.md), calling `/games/check` before `/games/publish`. Approve a new game with the returned approval link. Future pushes update the game automatically.

## Files

`core.mjs` contains deterministic puzzle generation, connectivity and scoring. `game.mjs` implements interaction and persistence. `startng.mjs` isolates the start.ng connection, validates message origin/source/request ID, and renders player-provided names as text. `cover.png` is the original generated game cover.

## Cover artwork

Created with the built-in imagegen tool, then encoded as an optimized 1600 × 1000 PNG for the platform's size limit. Final prompt:

> Use case: stylized-concept. Create a polished 16:10 landscape cover image for a browser puzzle game called Bloom Circuit. Exact text: "BLOOM CIRCUIT" in bold clean ivory geometric lettering in the upper left, with small tagline "A LITTLE LIGHT. A LOT OF LIFE." below. Scene: an isometric square board with dark forest green tiles, gracefully curving mint-green luminous paths joining at tile edges like a circuit, branching from a golden glowing sun seed to small orange, pale yellow, and pink flowers at endpoints. At the right, miniature sculptural leaves and soft magical firefly particles. Sophisticated cozy game art, crisp shapes, subtle grain, dark near-black forest background, luminous lime and warm apricot accents. Board occupies bottom right with generous readable title area. Restrained, premium indie puzzle aesthetic. No people, no interface buttons, no logos or watermark. Output 1600x1000 or equivalent 16:10, suitable as cover.png.
