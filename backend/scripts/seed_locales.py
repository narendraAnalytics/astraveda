"""Generate the non-English locale JSON files for the app from en.json.

Runs every string in frontend/src/i18n/locales/en.json through Sarvam
(sarvam-translate:v1), writing hi/od/ta/te/mr/kn.json next to it. Results are
also cached in the translations table, so re-runs are cheap.

Usage:
    cd backend
    python -m scripts.seed_locales           # all target languages
    python -m scripts.seed_locales hi ta      # only these
"""

import asyncio
import json
import sys
from pathlib import Path

from app.services import sarvam

ROOT = Path(__file__).resolve().parents[2]
LOCALES = ROOT / "frontend" / "src" / "i18n" / "locales"
TARGETS = ["hi", "od", "ta", "te", "mr", "kn"]


def _flatten(obj: dict, prefix: str = "") -> dict[str, str]:
    flat: dict[str, str] = {}
    for key, value in obj.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            flat.update(_flatten(value, path))
        else:
            flat[path] = value
    return flat


def _unflatten(flat: dict[str, str]) -> dict:
    root: dict = {}
    for path, value in flat.items():
        node = root
        parts = path.split(".")
        for part in parts[:-1]:
            node = node.setdefault(part, {})
        node[parts[-1]] = value
    return root


async def build(lang: str, en_flat: dict[str, str]) -> None:
    out: dict[str, str] = {}
    for key, text in en_flat.items():
        out[key] = await sarvam.translate(text, lang, "en")
        print(f"  {lang}: {key}")
    target = LOCALES / f"{lang}.json"
    target.write_text(json.dumps(_unflatten(out), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {target}")


async def main() -> None:
    langs = sys.argv[1:] or TARGETS
    en_flat = _flatten(json.loads((LOCALES / "en.json").read_text(encoding="utf-8")))
    for lang in langs:
        await build(lang, en_flat)


if __name__ == "__main__":
    asyncio.run(main())
