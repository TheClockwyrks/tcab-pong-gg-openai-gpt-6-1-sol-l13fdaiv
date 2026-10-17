# Carom

A top-down paddle duel about angles, spin, and bank shots. Play against the CPU in **Solo**, or share a keyboard in **Versus**. Moving as you strike adds spin; two swaying, rotating obstacles keep the next return unpredictable. First to eleven, win by two.

## Run locally

Requires a current Node.js release supported by Vite.

```sh
npm ci
npm run dev
```

Open the address Vite prints. No server-side service, credentials, downloaded assets, or network access is needed by the game.

## Production

```sh
npm run build
```

Serve `dist/` from the root of any static web server. `npm run preview` previews that production build locally.

## Controls

| Control | Action |
| --- | --- |
| W / S | Left paddle |
| ↑ / ↓ | Right paddle in Versus; left paddle in Solo |
| W / S or ↑ / ↓ | Navigate menus |
| Enter / Space | Confirm |
| P / Escape | Pause or resume |
| Escape | Back from instructions or match results |
| M | Toggle sound |
| Backtick | Engine diagnostic overlay |

Menus also accept mouse and touch. Touch devices have the engine's dual vertical controls. Strike while moving down for positive spin, or up for negative spin. A contact near a paddle's edge makes a steeper return. The ball's trail and orbit accent show its curved flight.

## Implementation and checks

TypeScript and Canvas 2D, built on the vendored Simple 2D engine. The engine owns timing, canvas fitting, input, audio synthesis, recording, and diagnostics. `src/game.ts` exports the state contract and game; `world.ts` implements state construction and the debug surface, `simulation.ts` controls screens and advances play, `physics.ts` resolves flight and collisions, and `view.ts` draws the interface. No art or audio files are loaded at runtime.

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

Tests run real engine frames in Node using an in-memory canvas and controlled clock. They cover menu and pointer input, serving, pausing, movement, spin, oriented collisions, scoring, AI gates, debugging, and recording. The game debug API is available only through `engine.debug`, with poses applied through `engine.apply`; it is not installed on the browser window.

The `showcase/` directory contains player-facing copy, browser screenshots, and a compressed engine draw-command recording of live play.
