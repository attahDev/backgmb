#!/usr/bin/env python3
"""
Bulk-upload course chapters (modules) into gmbtebac from a YAML file.

Why this exists: a module's `content` is a structured JSON blob (sections,
each optionally with an image/video embed) — writing that by hand in
Postman for every chapter of every course doesn't scale once you're
actually authoring curriculum. This script lets a course author write
plain YAML instead and does the API calls.

Usage:
    pip install requests pyyaml --break-system-packages
    python3 upload_course_content.py course.yaml --token <admin-jwt>

    # Or set the token once:
    export GMBTE_ADMIN_TOKEN=<admin-jwt>
    python3 upload_course_content.py course.yaml

course.yaml shape (one file per course):

    course:
      title: "Climate & Social Justice"
      category: climate          # climate | education
      description: "..."
      metadata:
        image: "https://.../hero.jpg"
        duration: "2 weeks"
        level: "Beginner"
        certificateAvailable: true

    modules:
      - title: "Why Climate Justice Matters"
        content:
          description: "An intro to the intersection of climate and equity."
          duration: "45 min"
          learningOutcomes:
            - "Explain the link between climate change and inequality"
          sections:
            - id: intro
              title: "Setting the scene"
              type: content
              order: 0
              paragraphs:
                - "Climate change does not affect everyone equally..."
            - id: case-study-1
              title: "Flint, Michigan"
              type: case-study
              order: 1
              paragraphs:
                - "..."
              media:
                type: video
                url: "https://cdn.example.com/flint.mp4"
                caption: "A 4-minute primer"

Re-running this script for the same course is safe for NEW modules (it
looks up the course by the slug the backend generates from its title and
only creates modules that don't already exist by title) — it does not
currently update existing modules in place; that's a deliberate scope cut,
not an oversight, since silently overwriting content someone may have
hand-edited via the admin UI later felt like the wrong default. If you need
that, add an explicit `--overwrite` flag before relying on it.
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any

import requests
import yaml

API_BASE = os.environ.get("GMBTE_API_BASE", "https://gmbtebac.onrender.com")


def slugify(title: str) -> str:
    """Mirror the backend's slug generation closely enough to find an
    already-created course — the backend is still the source of truth for
    the real slug (handles collisions), this is just for lookup."""
    return "-".join(title.lower().split())


def api(method: str, path: str, token: str, **kwargs) -> dict[str, Any]:
    resp = requests.request(
        method,
        f"{API_BASE}{path}",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        timeout=30,
        **kwargs,
    )
    if not resp.ok:
        print(f"  ! {method} {path} -> {resp.status_code}: {resp.text[:300]}", file=sys.stderr)
        resp.raise_for_status()
    body = resp.json()
    return body.get("data", body) if isinstance(body, dict) else body


def find_existing_course(token: str, slug_guess: str) -> dict[str, Any] | None:
    try:
        return api("GET", f"/courses/by-slug/{slug_guess}", token)
    except requests.HTTPError:
        return None


def ensure_course(token: str, course_def: dict[str, Any]) -> dict[str, Any]:
    slug_guess = slugify(course_def["title"])
    existing = find_existing_course(token, slug_guess)
    if existing:
        print(f"Course '{course_def['title']}' already exists (slug={existing['slug']}) — reusing it.")
        return existing

    print(f"Creating course '{course_def['title']}'...")
    return api(
        "POST",
        "/courses",
        token,
        json={
            "title": course_def["title"],
            "description": course_def.get("description"),
            "category": course_def["category"],
            "metadata": course_def.get("metadata"),
        },
    )


def existing_module_titles(token: str, course_id: str) -> set[str]:
    modules = api("GET", f"/courses/{course_id}/modules", token)
    return {m["title"] for m in modules}


def upload_modules(token: str, course: dict[str, Any], modules: list[dict[str, Any]]) -> None:
    already_there = existing_module_titles(token, course["id"])

    for i, module_def in enumerate(modules):
        title = module_def["title"]
        if title in already_there:
            print(f"  - skipping '{title}' (already exists — this script never updates in place)")
            continue

        print(f"  - uploading '{title}'...")
        api(
            "POST",
            f"/courses/{course['id']}/modules",
            token,
            json={
                "title": title,
                "content": module_def["content"],
                "order": module_def.get("order", i),
            },
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("yaml_file", help="Path to a course.yaml file (see script docstring for shape)")
    parser.add_argument("--token", default=os.environ.get("GMBTE_ADMIN_TOKEN"), help="Admin JWT (or set GMBTE_ADMIN_TOKEN)")
    args = parser.parse_args()

    if not args.token:
        parser.error("Need an admin token — pass --token or set GMBTE_ADMIN_TOKEN")

    with open(args.yaml_file, encoding="utf-8") as f:
        data = yaml.safe_load(f)

    course = ensure_course(args.token, data["course"])
    upload_modules(args.token, course, data.get("modules", []))
    print(f"Done. {course['title']} -> {API_BASE.rstrip('/')}/courses/by-slug/{course['slug']}")


if __name__ == "__main__":
    main()
