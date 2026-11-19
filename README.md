# Ultimate Fishing Simulator 3D

A mobile-friendly 3D fishing simulator built with React, Three.js, and Vite.

## Current gameplay

- 3D fishing world with dynamic water, sky, weather, day/night atmosphere, and underwater fish
- Fishing rod casting, bite timing, line tension, and fish-fight mechanics
- Walkable angler controls and drivable boats
- Multiple fishing locations, fish species, bait, rods, reels, lines, and hooks
- Shop, inventory, fish bag, aquarium, missions, achievements, and daily rewards
- Touch controls for phones and keyboard/mouse controls for PC
- Local save progress in the browser

## Run locally

Requires Bun (recommended) or a compatible Node.js environment.

```bash
bun install
bun run dev
```

Open the local Vite URL shown in the terminal.

## Production build

```bash
bun install --frozen-lockfile
bun run build
bun run preview
```

## Publish the web game

The workflow at `.github/workflows/deploy-pages.yml` builds the project and publishes `dist/` to GitHub Pages whenever code is pushed to `main`.

To enable it once:
1. Open the repository **Settings → Pages**.
2. Under **Build and deployment**, choose **GitHub Actions** as the source.
3. Open the **Actions** tab and check the “Build and deploy Fishing Simulator” workflow.

After a successful deployment, the game URL is:

https://ritakumarimotihari2020-bot.github.io/How-to-fishing-/

## Install on Android

After GitHub Pages deployment succeeds:
1. Open the game URL in Chrome on Android.
2. Open Chrome's menu.
3. Choose **Install app** or **Add to Home screen**.

The PWA manifest and service worker provide an app-like launch experience and cache the app shell. The 3D world and gameplay assets may still need an internet connection on the first load.

## Controls

- PC: WASD to move, mouse drag to look, E to board/leave boat, Space/action to cast and reel, V to change camera, U for underwater view, Esc to pause.
- Android: use the on-screen joystick and action controls. Drag to look around.

## Android APK note

This repository currently ships as a web/PWA game. GitHub Pages installation creates an app-like shortcut; it does **not** produce a signed native APK. A native Android build still needs a Capacitor Android wrapper and an Android build/signing setup.

## Performance

The game enables high-quality rendering when a capable GPU is available and reduces expensive effects on software-rendered WebGL devices. For smoother play on older phones, use the in-game graphics settings.
