# Rat Escape v11.2

v11.2 redesigns **STAGE 3 / 封鎖研究区画** from the ground up.

## Stage 3 redesign
- 12 x 18 grid / start: `g9` / clear: 20 rats
- Five staggered pipes: `a3`, `g18`, `l9`, `g1`, `a15`
- The old dead-end-heavy corridor map was removed.
- The new map contains many one-cell-wide circulation loops, allowing the player to run around obstacles and genuinely get behind a rat.
- The user's map rule is preserved: **there are zero 2 x 2 blocks made entirely of open cells**.
- All open cells are connected.
- Structural cycle rank: 28, giving many alternate circulation paths without creating 2 x 2 open areas.

## Online battle
The v11.1 countdown/rematch changes are preserved.

Run with:
```powershell
npm.cmd install
npm.cmd start
```
Then open `http://localhost:3000`.
