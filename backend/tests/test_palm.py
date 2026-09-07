"""Pure-logic tests for the palm reading feature (no DB, no network)."""

from types import SimpleNamespace

from app.routers.palm import Features, _build_profile, _clean_lines, _signature
from app.services.palm_reading import _facts


def _features(**over):
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
    return Features(**base)


def test_clean_lines_drops_unknown_keys_and_blanks():
    cleaned = _clean_lines({"heart": "Deep & long", "bogus": "x", "fate": ""})
    assert cleaned == {"heart": "Deep & long"}


def test_signature_is_order_independent_for_mounts():
    a = _features(mounts=["Venus", "Jupiter"])
    b = _features(mounts=["Jupiter", "Venus"])
    assert _signature(a) == _signature(b)


def test_signature_changes_with_answers():
    assert _signature(_features()) != _signature(_features(hand_shape="Fire"))


def test_build_profile_carries_signature_and_trait():
    f = _features()
    prof = _build_profile(f)
    assert prof["signature"] == _signature(f)
    assert prof["hand_shape_trait"] == "sensitive, intuitive"


def test_facts_renders_not_sure_mounts_and_scan_note():
    row = SimpleNamespace(
        name="Asha",
        dominant_hand="Right",
        hand_shape="Water",
        finger_length="Long",
        thumb_flex="Flexible",
        lines={"heart": "Deep & long", "head": "Not sure"},
        mounts=["Venus"],
        marks=["Fish (Matsya)", "None"],
        profile={"source": "scan", "observations": "A calm, expressive hand."},
    )
    text = _facts(row)
    assert "Heart line (Hridaya Rekha): Deep & long" in text
    assert "Head line (Mastaka Rekha): Not sure" in text
    assert "Fullest mounts: Venus" in text
    assert "A calm, expressive hand." in text
    assert "read from a photo" in text
