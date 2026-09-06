"""Generate the non-English locale JSON files for the app from en.json.

Runs every string in frontend/src/i18n/locales/en.json through Sarvam
(sarvam-translate:v1), writing hi/od/ta/te/mr/kn.json next to it. Results are
also cached in the translations table, so re-runs are cheap.

i18next `{{placeholder}}` tokens are preserved verbatim — only the text around
them is translated.

Usage:
    cd backend
    uv run python -m scripts.seed_locales           # all target languages
    uv run python -m scripts.seed_locales hi ta      # only these
"""

import asyncio
import json
import re
import sys
from pathlib import Path

from app.services import sarvam

ROOT = Path(__file__).resolve().parents[2]
LOCALES = ROOT / "frontend" / "src" / "i18n" / "locales"
TARGETS = ["hi", "od", "ta", "te", "mr", "kn"]

PLACEHOLDER = re.compile(r"\{\{[^}]+\}\}")


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


async def _t_segment(segment: str, lang: str) -> str:
    """Translate a fragment, re-attaching the leading/trailing whitespace that
    Sarvam strips (it matters around {{placeholders}})."""
    if not segment.strip():
        return segment
    lead = segment[: len(segment) - len(segment.lstrip())]
    trail = segment[len(segment.rstrip()) :]
    return f"{lead}{await sarvam.translate(segment.strip(), lang, 'en')}{trail}"


async def _translate_preserving_placeholders(text: str, lang: str) -> str:
    """Translate the text but keep {{...}} tokens exactly as-is."""
    if not PLACEHOLDER.search(text):
        return await sarvam.translate(text, lang, "en")

    out: list[str] = []
    pos = 0
    for m in PLACEHOLDER.finditer(text):
        out.append(await _t_segment(text[pos : m.start()], lang))
        out.append(m.group(0))  # placeholder verbatim
        pos = m.end()
    out.append(await _t_segment(text[pos:], lang))
    return "".join(out)


async def build(lang: str, en_flat: dict[str, str]) -> None:
    out: dict[str, str] = {}
    for key, text in en_flat.items():
        # Keep e-mail-style examples untouched.
        if "@example.com" in text:
            out[key] = text
        else:
            out[key] = await _translate_preserving_placeholders(text, lang)
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
