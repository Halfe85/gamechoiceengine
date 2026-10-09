# Game Choice Engine

Mobile-first Angular companion for story-driven games: **dialogue, actions, choices, QTEs, quest objectives, player state and goal-aware routes**.

The **Home** screen is an internal news feed (new games and story-content updates) backed by SQLite `news_items`. The separate **Games** tab immediately to its right lists registered games in compact single-line rows. A progress bar and percentage appear only after a player records at least one choice or action; the percentage is computed against **currently mapped story steps**, not the whole game, because content coverage is incomplete. Decision history remains available from the Story Tracker, not as a separate bottom tab.

## Story tracking flow

Selecting a game opens a **single, spoiler-free ending preference screen**: Best Ending, Bad Ending, Balanced Ending, or My Own Story. After confirming, the tracker opens. The choice is saved per game separately from any recorded story decisions, and can be changed later.

On screens 900px wide or narrower, Tracker shows **only the active tracking panel**. Ending preference and episode/chapter navigation each have their own full content views; sidebars are hidden rather than stacked. Desktop retains optional contextual panels.

Preferences are not proof of a known route. A goal only colors choices when explicit, verified goals and effects exist in the content database. The present Telltale prototype does not yet map complete endings, so its options stay neutral. **Game of Thrones: A Telltale Games Series** has six episodes indexed, with a **partial** sample for episode 1 chapter 1. **Baldur's Gate 3** is registered as a planned game with no story content yet. This is an alpha, not a complete walkthrough.

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

## Compact mobile layout and saved resume

Mobile shows a single compact page at a time with no repeated headings or instructional paragraphs. Selecting a game for the first time opens the spoiler-free ending chooser; **returning to a game with a saved ending preference immediately opens its Tracker**, restoring the last saved episode, scene and event. The ending preference is stored independently per game in `gce-<game-id>-ending-preference-v1`. The position is stored in `gce-<game-id>-position-v1` using the stable event ID (with an index fallback for existing saves). Changing the ending does not reset any story decisions or progress. Browsing episodes does not overwrite the saved position unless a chapter is explicitly selected.


## Dialogue fidelity

Dialogue must be verified against the exact text shown in the game. All options
(and any post-choice spoken replies) are separate from action summaries. No vague
approximation is presented as a playable dialogue choice. Unverified dialogue
is visibly marked and cannot be selected. See [database/README.md](database/README.md).
