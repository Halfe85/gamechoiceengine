# Game Choice Engine

Mobile-first Angular companion for story-driven games: **dialogue, actions, choices, QTEs, quest objectives, player state and goal-aware routes**.

First content pack: **Game of Thrones: A Telltale Games Series**. Six episodes indexed; episode 1 chapter 1 has a **partial** researched sample. This is an alpha, not a complete walkthrough.

## Develop locally

Requires Node.js 22+ and Python 3.

```sh
npm install
npm start
```

The `prestart` / `prebuild` scripts use Python's standard SQLite library to generate `public/data/game.sqlite` and a `game-of-thrones.json` projection from `database/schema.sql` + curated content in `database/build.py`.

The Angular app currently reads the generated **JSON projection** and stores private tracker progress in **localStorage**, not SQLite/OPFS yet. Game content is generated from a real SQLite DB. Browser SQLite and independent user-save databases are a future upgrade.

See [database/README.md](database/README.md) for data model, provenance and roadmap.

GitHub Pages is built and deployed using `.github/workflows/deploy.yml` (no Jekyll needed).
