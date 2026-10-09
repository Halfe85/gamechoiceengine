# Game Choice Engine

Mobile-first Angular companion for story-driven games: **dialogue, actions, choices, QTEs, quest objectives, player state and goal-aware routes**.

The Home screen replaces the bottom-bar Journal entry and lists games registered in the content database. Decision history remains available from the Story Tracker, not as a separate bottom tab. **Game of Thrones: A Telltale Games Series** has six episodes indexed, with a **partial** sample for episode 1 chapter 1. **Baldur's Gate 3** is registered as a planned game with no story content yet. This is an alpha, not a complete walkthrough.

## Develop locally

Requires Node.js 22+ and Python 3.

```sh
npm install
npm start
```

The `prestart` / `prebuild` scripts use Python's standard SQLite library to generate `public/data/game.sqlite` and a `game-of-thrones.json` projection from `database/schema.sql` + curated content in `database/build.py`.

The Angular app currently reads the generated **JSON projection** and stores private tracker progress separately **per game** in **localStorage**, not SQLite/OPFS yet. Existing Game of Thrones browser saves are read as a legacy fallback. Game content is generated from a real SQLite DB. Browser SQLite and independent user-save databases are a future upgrade.

See [database/README.md](database/README.md) for data model, provenance and roadmap.

GitHub Pages is built and deployed using `.github/workflows/deploy.yml` (no Jekyll needed).
