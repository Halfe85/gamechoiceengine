#!/usr/bin/env python3
"""Generate a validated SQLite knowledge base and a static read model for GitHub Pages.

All in-game text in this seed is editorial paraphrase, not a game-script transcript.
Additional sourced nodes can be added over time without changing the web deployment model.
"""
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "public" / "data" / "game.sqlite"
JSON = ROOT / "public" / "data" / "game-of-thrones.json"

EPISODES = [
    "Iron From Ice", "The Lost Lords", "The Sword in the Darkness",
    "Sons of Winter", "A Nest of Vipers", "The Ice Dragon"
]

def insert(db, table, **values):
    cols = ", ".join(values.keys())
    placeholders = ", ".join("?" for _ in values)
    db.execute(f"INSERT INTO {table} ({cols}) VALUES ({placeholders})", tuple(values.values()))

def make_database(db):
    db.executescript((ROOT / "database" / "schema.sql").read_text(encoding="utf-8"))
    insert(db, "games", id="got-telltale", title="Game of Thrones: A Telltale Games Series",
           developer="Telltale Games", adapter="telltale",
           description="Follow House Forrester through an episodic story.")
    for number, name in enumerate(EPISODES, start=1):
        insert(db, "episodes", id=f"got-e{number}", game_id="got-telltale",
               number=number, title=name, coverage="partial" if number == 1 else "metadata")

    insert(db, "sources", id="gamepressure-e1c1", title="Gamepressure: Episode 1, Chapter 1",
           url="https://www.gamepressure.com/gameofthronestelltale/chapter-1-episode-1-iron-from-ice/zd6dab")
    insert(db, "sources", id="gamepressure-e1", title="Gamepressure: Episode 1 overview",
           url="https://www.gamepressure.com/gameofthronestelltale/introduction-episode-1-iron-from-ice/z46da9")
    insert(db, "sources", id="telltale-overview", title="Telltale community: game announcement",
           url="https://community.telltale.com/discussion/86663/first-trailer-for-game-of-thrones-a-telltale-games-series")

    for number in range(1, 7):
        insert(db, "scenes", id=f"got-e1-c{number}", episode_id="got-e1",
               number=number, title=f"Chapter {number}" if number != 1 else "The Forrester Camp",
               protagonist="Gared Tuttle" if number == 1 else None,
               coverage="partial" if number == 1 else "outline")

    nodes = [
        ("sword", "action", "Prepare the sword", "Examine and clean the sword when prompted.", 0),
        ("camp-talk", "dialogue", "Around the camp", "Respond during the opening exchange with the soldiers; silence is also possible.", 0),
        ("lord", "dialogue", "Speak with Lord Forrester", "Respond to Lord Forrester about service and loyalty.", 0),
        ("bowen", "dialogue", "Speak with Bowen", "Continue the conversation with Bowen while assisting in the camp.", 0),
        ("alarm", "decision", "The attack: choose whom to help", "During the sudden attack, decide whether to warn Lord Forrester or save Bowen.", 1),
        ("escape", "qte", "Escape the attack", "Follow the on-screen timed controls. Record whether you completed the sequence.", 1),
        ("forest", "dialogue", "Lord Forrester's instructions", "Continue with Lord Forrester and listen to his instructions.", 0),
        ("screams", "action", "Investigate the screams", "Move toward the sounds and examine what has happened.", 0),
        ("farm", "decision", "Choose your immediate response", "Decide how to react when danger reaches Gared's family.", 1),
        ("britt", "decision", "Spare or strike", "Decide whether to show mercy during the confrontation.", 1),
        ("end", "transition", "Continue the story", "Proceed to the next chapter when this sequence ends.", 0),
    ]
    for i, (key, kind, title, description, spoiler) in enumerate(nodes, start=1):
        insert(db, "nodes", id=f"got-e1-{key}", scene_id="got-e1-c1",
               position=i, kind=kind, title=title, description=description,
               coverage="partial", spoiler_level=spoiler)
        insert(db, "evidence", source_id="gamepressure-e1c1",
               entity_type="node", entity_id=f"got-e1-{key}",
               note="Editorial paraphrase from a public walkthrough.")

    choices = [
        ("camp-talk", [("agree", "Answer confidently", "say"), ("question", "Ask a question", "say"),
                        ("sharp", "Make a sharp remark", "say"), ("silent", "Remain silent", "silent")]),
        ("lord", [("loyal", "Promise loyal service", "say"), ("ask", "Ask what is expected", "say"),
                  ("silent", "Remain silent", "silent")]),
        ("bowen", [("kind", "Be friendly", "say"), ("direct", "Be direct", "say"),
                   ("silent", "Remain silent", "silent")]),
        ("alarm", [("warn", "Warn Lord Forrester", "do"), ("save", "Save Bowen", "do")]),
        ("escape", [("complete", "QTE completed", "success"), ("failed", "QTE failed / retried", "failure")]),
        ("forest", [("promise", "Give your word", "say"), ("ask", "Ask for clarification", "say"),
                    ("silent", "Remain silent", "silent")]),
        ("farm", [("sword", "Draw your sword", "do"), ("father", "Rush to your father", "do")]),
        ("britt", [("mercy", "Show mercy", "do"), ("strike", "Strike the attacker", "do")]),
    ]
    for key, variants in choices:
        for i, (opt, label, kind) in enumerate(variants, start=1):
            insert(db, "options", id=f"got-e1-{key}-{opt}", node_id=f"got-e1-{key}",
                   position=i, label=label, response_kind=kind, verified=1 if key in ("alarm","farm","britt") else 0)

    insert(db, "variables", id="bowen_alive", game_id="got-telltale", label="Bowen survives attack",
           value_type="boolean", default_value=None)
    for suffix, value in (("warn", "false"), ("save", "true")):
        insert(db, "effects", id="effect-bowen-" + suffix, option_id="got-e1-alarm-" + suffix,
               variable_id="bowen_alive", operation="set", value=value,
               verification="verified", source_id="gamepressure-e1c1")

    insert(db, "goals", id="keep-bowen", game_id="got-telltale",
           name="Keep Bowen alive", description="A verified short-term goal for the opening chapter.",
           coverage="verified")
    insert(db, "goal_rules", id="rule-keep-bowen", goal_id="keep-bowen", variable_id="bowen_alive",
           expected_value="true", weight=1, confidence="verified")
    insert(db, "goals", id="house-forrester", game_id="got-telltale",
           name="Best possible fate for House Forrester",
           description="Full-season route under research. No guaranteed perfect outcome is claimed.",
           coverage="unmapped")

    insert(db, "quests", id="survive-attack", game_id="got-telltale", episode_id="got-e1",
           title="Survive the opening attack", description="Track Gared's actions during the attack.",
           coverage="partial")
    insert(db, "quest_objectives", id="warning-choice", quest_id="survive-attack", position=1,
           title="Resolve the urgent choice", variable_id="bowen_alive", expected_value=None)
    insert(db, "node_quest_links", node_id="got-e1-alarm", objective_id="warning-choice")
    db.commit()
    errors = db.execute("PRAGMA foreign_key_check").fetchall()
    if errors:
        raise RuntimeError(f"Foreign-key violations: {errors}")

def as_rows(db, table):
    return [dict(x) for x in db.execute(f"SELECT * FROM {table}")]

def main():
    DB.parent.mkdir(parents=True, exist_ok=True)
    if DB.exists():
        DB.unlink()
    with sqlite3.connect(DB) as db:
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        make_database(db)
        model = {
            "schemaVersion": 1,
            "notice": "Partial, sourced companion dataset; no claim of complete gameplay coverage.",
            "games": as_rows(db, "games"),
            "episodes": as_rows(db, "episodes"),
            "scenes": as_rows(db, "scenes"),
            "nodes": as_rows(db, "nodes"),
            "options": as_rows(db, "options"),
            "variables": as_rows(db, "variables"),
            "effects": as_rows(db, "effects"),
            "goals": as_rows(db, "goals"),
            "goal_rules": as_rows(db, "goal_rules"),
            "quests": as_rows(db, "quests"),
            "quest_objectives": as_rows(db, "quest_objectives"),
            "node_quest_links": as_rows(db, "node_quest_links"),
            "sources": as_rows(db, "sources")
        }
    JSON.write_text(json.dumps(model, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {DB.relative_to(ROOT)} and {JSON.relative_to(ROOT)}")
    print(f"Episode metadata: {len(model['episodes'])}; sample nodes: {len(model['nodes'])}")

if __name__ == "__main__":
    main()
