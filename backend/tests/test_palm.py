"""Pure-logic tests for the palm reading feature (no DB, no network)."""

from types import SimpleNamespace

from app.routers.palm import GenerateIn, _build_profile, _clean_lines, _signature
from app.services.palm_reading import _facts


def _payload(**over):
    base = dict(
        name="Asha",
        relation="Self",
        dominant_hand="Right",
        hand_shape="Water",
        finger_length="Long",
        thumb_flex="Flexible",
        lines={"heart": "Deep & long", "head": "Not sure"},
        mounts=["Venus", "Jupiter"],
        marks=["Fish (Matsya)"],
    )
    base.update(over)
    return GenerateIn(**base)


def test_clean_lines_drops_unknown_keys_and_blanks():
    cleaned = _clean_lines({"heart": "Deep & long", "bogus": "x", "fate": ""})
    assert cleaned == {"heart": "Deep & long"}


def test_signature_is_order_independent_for_mounts():
    a = _payload(mounts=["Venus", "Jupiter"])
    b = _payload(mounts=["Jupiter", "Venus"])
    assert _signature(a, a.lines, a.mounts) == _signature(b, b.lines, b.mounts)


def test_signature_changes_with_answers():
    a = _payload()
    b = _payload(hand_shape="Fire")
    assert _signature(a, a.lines, a.mounts) != _signature(b, b.lines, b.mounts)


def test_build_profile_carries_signature_and_trait():
    p = _payload()
    prof = _build_profile(p, p.lines, p.mounts, p.marks)
    assert prof["signature"] == _signature(p, p.lines, p.mounts)
    assert prof["hand_shape_trait"] == "sensitive, intuitive"


def test_facts_renders_not_sure_and_mounts():
    row = SimpleNamespace(
        name="Asha",
        dominant_hand="Right",
        hand_shape="Water",
        finger_length="Long",
        thumb_flex="Flexible",
        lines={"heart": "Deep & long", "head": "Not sure"},
        mounts=["Venus"],
        marks=["Fish (Matsya)", "None"],
    )
    text = _facts(row)
    assert "Heart line (Hridaya Rekha): Deep & long" in text
    assert "Head line (Mastaka Rekha): Not sure" in text
    assert "Fullest mounts: Venus" in text
    assert "Fish (Matsya)" in text
    assert "None" not in text.split("Auspicious marks noticed:")[-1]
