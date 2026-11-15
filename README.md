# Professor Chaos ⚡ — The Lab Is Out of Control

A family-friendly cinematic 2.5D point-and-click adventure, built with **Angular 19 + Phaser 3**.

**Play:** https://tamar-dev.github.io/professor-chaos/

## Episode 01 — The Red Button
1. Start the lab meltdown by pressing the forbidden red button.
2. Explore the professor's desk, books and drawers to find hidden energy crystals.
3. Chase a mischievous robot and tap it three times to recover the last crystal.
4. Calibrate three dials to **3 · 2 · 4**, then activate the invention machine.
5. Enjoy the chaotic finale!

## Controls
- Click glowing hotspots to interact with objects.
- Navigation buttons: full room, desk, machine and robot corner.
- `Esc`: zoom out. `1` / `2` / `3`: focus desk / machine / robots. `H`: hint.
- Accessible HTML action buttons are provided below the canvas.
- Progress is automatically saved in browser local storage.

## Develop
```bash
npm install
npm start
```
Run a production build:
```bash
npm run build -- --base-href /professor-chaos/
```

## Art assets
The master lab artwork lives at `public/assets/lab-master.webp`. The game falls back to simple shapes if the asset is unavailable. The master scene is currently a **single flattened background**; separate animation layers and original character sprites are future work.

## Deployment
Pushing to `main` triggers `.github/workflows/deploy.yml` and publishes `dist/professor-chaos/browser` to GitHub Pages. Set repository **Settings → Pages → Source → GitHub Actions**.

## Roadmap
- Split robot, machine, and foreground objects into independent art layers.
- Add proper robot chase pathing, sound effects, and cinematic transitions.
- Add puzzle variations, story dialogue, and family playtesting.
- Improve dependency security and test coverage.
