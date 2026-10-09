# Game of Thrones · Iron From Ice · Episode 1, Chapter 1

**This is a research scaffold, not yet the entire transcript.**

Source: [chapter-01.json](chapter-01.json). Schema: [chapter-01.schema.json](chapter-01.schema.json).
It currently contains 64 ordered, original editorial event anchors (19 dialogue
menus, three major choices, four QTE sequences, 26 explicit transcript gaps).
Actual dialogue is deliberately `null` until checked and entered.

## Source material to retrieve

1. **Full script / spoken lines and dialogue variations:**
   https://ttgot.fandom.com/wiki/Iron_From_Ice/Transcript

   On this page, copy from **The Twins, The Red Wedding – Gared** through the
   *family farm* confrontation. Stop before **Ironrath, Stronghold of House
   Forrester – Gared**, which begins the following chapter in the guide's
   segmentation. This page covers *the entire episode*, not only Chapter 1.

2. **Action/QTE and dialogue menu order:**
   https://www.gamepressure.com/gameofthronestelltale/chapter-1-episode-1-iron-from-ice/zd6dab

   Use this for cross-checking the flow, not as an exhaustive script.
   The source may have mistakes and explicitly restricts copying; do not
   republish its prose as a public transcript.

3. **Visual comparison – game input prompts and timing:**
   https://www.youtube.com/watch?v=5_8-qAyB4Z8

   This records only one playthrough and cannot verify all branching lines.

## Import workflow

Save the sourced material as a UTF-8 `.txt` or `.html` file and send it in the
ChatGPT conversation. **Don't paste a very long script into a single message.**
The text can then be parsed into a draft of this JSON, without claiming
unverified scenes or branches as complete.

For every source paragraph/line:
- Add `speech` entries (or `subtitle` / `notification`) in chronological
  order. This includes ambient characters and spoken text **between** choices.
- For each dialogue menu, fill `prompt_lines` (who says what first), then every
  `choice_menu.slots[].screen_text` exactly as it appears in the game.
- Fill `branch_timeline` separately **for every response**, including the
  player-character's spoken version of the selected option, NPC's reaction,
  additional speech, changes of state, and divergence/merge points.
- Use `interaction` or `qte` for controllable actions and record the real
  input prompt, any timed sequence, success and failure paths, and retry behavior.
- Record a precise `source_locator` for each verbatim element (a screenshot,
  the wiki's section, a source-file line number, or a video timestamp).
- Remove `transcript_gap` markers only after all lines in that range are
  accounted for. Do not set `status: verified` until a line/choice is checked.

**Do not conflate** the on-screen option with what Gared actually says after
selection. One dialogue choice can produce multiple follow-up lines.

Validation:
```bash
python3 database/validate_chapter.py
python3 database/validate_chapter.py --strict   # must fail until 100% verified
```

`npm run build` runs the validator, then places a copy in
`public/data/got-e1-c1.json` for eventual use by Angular. Existing user
progress remains in its own save store, and existing basic tracker records
are not overwritten.

**Publication rights:** The Fandom transcript and in-game speech are
copyrighted third-party material. A publicly accessible GitHub repository
is not a private backup. Keep raw source material privately, and ensure that
you have a proper legal basis to publish exact dialogue at scale.
