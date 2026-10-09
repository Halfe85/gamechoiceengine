#!/usr/bin/env python3
"""Validate staged Game Choice Engine chapter timelines without extra dependencies.

Run:
    python3 database/validate_chapter.py
    python3 database/validate_chapter.py --strict

Normal mode validates structure, reports missing transcript data and publishes the
incomplete scaffold. Strict mode additionally requires a fully verified transcript.
"""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "database/games/got-telltale/episode-01/chapter-01.json"
DESTINATION = ROOT / "public/data/got-e1-c1.json"
ALLOWED = {
    "scene", "speech", "transcript_gap", "dialogue_choice", "decision",
    "qte", "action", "interaction", "transition", "subtitle",
    "notification", "animation", "examination"
}


def _require(ok: bool, message: str) -> None:
    if not ok:
        raise ValueError(message)


def validate_chapter(chapter: dict, strict: bool = False) -> dict:
    _require(chapter.get("schema_version") == "1.0.0", "Unexpected schema_version")
    _require(chapter.get("format") == "choiceengine.chapter.timeline", "Wrong timeline format")
    _require(chapter.get("game_id") == "got-telltale", "Wrong game ID")
    _require(chapter.get("chapter", {}).get("id") == "got-e1-c1", "Wrong chapter")
    sources = chapter.get("source_refs", [])
    source_ids = {s["id"] for s in sources}
    _require(len(source_ids) == len(sources) and bool(source_ids), "Invalid source_refs")
    phases = chapter.get("phases", [])
    phase_ids = {phase["id"] for phase in phases}
    _require(len(phase_ids) == len(phases) and bool(phase_ids), "Invalid phases")
    events = chapter.get("timeline")
    _require(isinstance(events, list) and bool(events), "Timeline must not be empty")
    ids: set[str] = set()
    option_ids: set[str] = set()
    missing = 0
    counts: dict[str, int] = {}
    for index, event in enumerate(events, 1):
        eid = event["id"]
        _require(eid not in ids, f"Duplicate event ID: {eid}")
        ids.add(eid)
        _require(event["order"] == index, f"Out of order event: {eid}")
        kind = event["kind"]
        _require(kind in ALLOWED, f"Unknown event kind: {kind}")
        _require(event["phase"] in phase_ids, f"Unknown phase at {eid}")
        _require(bool(set(event.get("source_refs", [])) <= source_ids),
                 f"Unknown source at {eid}")
        counts[kind] = counts.get(kind, 0) + 1
        if event["status"] != "verified":
            missing += 1
        if kind == "transcript_gap":
            _require("lines" in event, f"Missing transcript lines container: {eid}")
            if event.get("missing"):
                missing += 1
        if kind == "speech":
            text = event.get("text")
            if event["status"] == "verified":
                _require(isinstance(text, str) and bool(text.strip()),
                         f"Verified speech has no exact text: {eid}")
                _require(bool(event.get("source_locator")), f"Missing evidence: {eid}")
            elif text is None:
                missing += 1
        if kind in {"dialogue_choice", "decision"}:
            menu = event.get("choice_menu", {})
            slots = menu.get("slots", [])
            _require(len(slots) >= 2, f"Missing options: {eid}")
            _require([o.get("position") for o in slots] == list(range(1, len(slots) + 1)),
                     f"Invalid option sequence: {eid}")
            for option in slots:
                _require(option["id"] not in option_ids,
                         f"Duplicate dialogue option: {option['id']}")
                option_ids.add(option["id"])
                _require(isinstance(option.get("branch_timeline"), list),
                         f"No branch container for {option['id']}")
                if option.get("verification") == "verified":
                    _require(bool(option.get("screen_text")) and
                             bool(option.get("source_locator")),
                             f"Verified dialogue option missing text or source: {option['id']}")
                else:
                    missing += 1
                for branch in option["branch_timeline"]:
                    if branch.get("verification") == "verified":
                        _require(bool(branch.get("source_locator")),
                                 f"Unattributed branch in {option['id']}")
                        if branch.get("kind") in {"speech", "subtitle"}:
                            _require(bool(branch.get("text")),
                                     f"Verified branch speech missing text in {option['id']}")
            if menu.get("fully_transcribed"):
                _require(all(o.get("verification") == "verified" for o in slots),
                         f"Dialogue claimed complete but options unverified: {eid}")
            else:
                missing += 1
        if kind == "qte" and (not event.get("interaction", {}).get("input_sequence")
                               or event.get("interaction", {}).get("control_scheme") == "unknown"):
            missing += 1
    completed = missing == 0 and all(e["status"] == "verified" for e in events)
    if chapter.get("content_status") == "fully_verified" or chapter.get("completion", {}).get("claim_full_transcript"):
        _require(completed, "Chapter claims full transcription, but gaps or unverified material remain")
    if strict:
        _require(completed, f"Full transcript not yet available ({missing} unresolved checks)")
    return {"events": len(events), "counts": counts, "unresolved": missing,
            "fully_verified": completed}


def validate_and_publish(source: Path = SOURCE,
                         destination: Path = DESTINATION,
                         strict: bool = False) -> dict:
    chapter = json.loads(source.read_text(encoding="utf-8"))
    report = validate_chapter(chapter, strict=strict)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true",
                        help="Fail unless absolutely all parts are verified")
    parser.add_argument("--no-publish", action="store_true")
    args = parser.parse_args()
    if args.no_publish:
        report = validate_chapter(json.loads(SOURCE.read_text(encoding="utf-8")),
                                  strict=args.strict)
    else:
        report = validate_and_publish(strict=args.strict)
    print("Chapter 1:", json.dumps(report, ensure_ascii=False))
    if not report["fully_verified"]:
        print("NOTE: Scaffold is incomplete and NOT a full transcript.")


if __name__ == "__main__":
    main()
