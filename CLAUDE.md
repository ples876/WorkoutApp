# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A privacy-first workout tracker: a static, offline web app (no server, no cloud, no accounts). All data lives in the browser's IndexedDB via Dexie.js (loaded from CDN). Vanilla HTML/CSS/JS with **no framework and no build step**. Deep reference docs already exist — read [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for the full data model/feature docs and [README.md](README.md) for product scope. Note: both those files (and `.clinerules`) predate later work and say the DB is "v3" — the current schema is **v5** (see `js/db.js`).

## Commands

There is **no build, lint, or test tooling** — nothing to compile and no test suite.

- **Run locally:** open `index.html` directly in a browser, or serve the folder statically (e.g. `python -m http.server 8000`, or VS Code Live Server).
- **Sanity-check JS before committing:** `node --check js/<file>.js` — this is the standard verification here since there's no test runner. Real verification is manual: exercise the flow in a browser.
- **Deploy:** push to `main`. GitHub Actions builds and deploys to GitHub Pages automatically (no build step; it just publishes the static files).

## Architecture (the parts that span multiple files)

**Init sequence** (`js/app.js` → `initApp`): load theme → `initDatabase()` → `refreshState()` → `setupTabNavigation()` → `render()`. Critical ordering trap: if `initDatabase()` returns false (e.g. Dexie `VersionError`), init **returns before `setupTabNavigation()`**, so the nav becomes unclickable and the page shows only the static empty-state HTML from `index.html`. A "dead app" almost always means DB init failed.

**State + rendering loop** (unidirectional, observer-based):
`User action → handler → db.js write → state loader (loadExercises/loadPrograms/loadActiveProgram/loadActiveWorkout) → notifyListeners() → render()`.
- `js/state.js` holds one global `state` object and a `subscribe/notifyListeners` list. Every loader calls `notifyListeners()`.
- `js/ui.js` subscribes once; any notify triggers `render()`, which switches on `state.currentTab` and calls the matching `render*()`. Each `render*()` sets `innerHTML` then wires listeners via a paired `setup*Listeners()`. Dynamic lists (sets, exercises, program entries) use **event delegation** on a parent — do not attach per-item listeners (past double-fire bugs).

**Data model** (`js/db.js` tables; catalog vs. logged reality):
- `exercises` — the catalog (predefined + custom), with `notes`.
- `programs` — **templates**: `workouts[]`, each workout = `{ workoutNumber, exercises: [{ exerciseId, targetSets }] }`. Plus pointer state `currentWorkout` + `completedCycles`.
- `workoutSessions` — a logged instance of a workout (`programId`, `workoutNumber`, `date`, `isComplete`).
- `sets` — individual logged sets (`workoutSessionId`, `exerciseId`, `weight`, `reps`).
Exercise history = query all `sets` by `exerciseId`. Programs never change when you log; sessions/sets are the reality. **Invariants:** exactly one active program (`isActive`) and at most one in-progress session (`isComplete === false`) at a time. `advanceWorkout()` moves `currentWorkout` forward, looping back to 1 and bumping `completedCycles` on wrap.

**Program builder** (`renderProgramForm` + `handleSaveProgram`): a module-level `workoutData` scratch object backs add/remove/reorder, but **the DOM is the source of truth at save** — `handleSaveProgram` reads the rendered `.exercise-entry` elements. "Copy program" reuses the create form via `copySourceProgramId` (pre-fills from a source program, saves as a brand-new one).

**Modals** (`js/ui.js`): built dynamically, not in HTML. `showConfirmModal({...})` returns a `Promise<boolean>` and is the replacement for native `confirm()`; `showFinishWorkoutModal` shows the end-of-workout summary. Shared `closeModal()` / `handleModalKeydown()`, single `#modal-overlay`. Native `alert()` is still used for notifications (not yet migrated).

## Conventions & rules

- **Vanilla JS, async/await for all DB ops, mobile-first CSS.** No frameworks/build tools. **No emojis in code** (only in UI where explicitly wanted).
- **DB migrations are versioned and append-only.** To change schema, add a new `db.version(N).stores({...}).upgrade(tx => ...)` block in `js/db.js`; never edit an existing version's schema. Back-fill new fields in `.upgrade()`.
- **Never let the on-disk DB version exceed the committed code's declared version.** Dexie refuses to open a newer DB and throws `VersionError`, killing init (see above). This bit us when a higher schema version ran in a live-reloading browser and was later reverted. Forward upgrades (code ≥ disk) are automatic and safe. To recover from a backwards mismatch, bump the code's version to match — **do not** tell the user to clear IndexedDB (that deletes their logged workouts).
- **Theme:** CSS variables toggled by `body.dark-mode`, persisted in `localStorage['theme']`; applied first thing in `initApp` to avoid a flash.
- **Import is replace-only** (wipes then bulk-adds); there is no merge.

## Deploy gotcha

The GitHub Pages `deploy` job intermittently fails with `Error: Deployment failed, try again later.` even when the build is fine. Fix: re-run the failed job, or push an empty commit to trigger a fresh run. Pages also serves through a ~10-minute CDN cache, so a successful deploy can take that long to appear.
