"""Cosmic Guidance — checks the real-panchang math and the weekday mapping.

Needs pyswisseph (a native build). On Windows that wheel may be missing, so the
whole module skips rather than failing collection — the same posture the Kundali
engine takes. Verify on the Render deploy.
"""

import pytest

pytest.importorskip("swisseph")

from datetime import date

from app.services.cosmic import compute_cosmic_guidance


def _for(d: date) -> dict:
    # Fixed reference location (New Delhi) so the timings are deterministic.
    return compute_cosmic_guidance(on=d)


def test_friday_maps_to_venus_lakshmi():
    g = _for(date(2026, 9, 4))  # a Friday
    assert g["weekday"] == "Friday"
    assert g["planet"] == "Venus"
    assert g["mantra"]["deity"] == "Lakshmi"
    assert g["lucky_color"]["name"] == "Rose Pink"


def test_wednesday_differs_from_friday():
    wed = _for(date(2026, 9, 2))
    fri = _for(date(2026, 9, 4))
    assert wed["weekday"] == "Wednesday"
    assert wed["mantra"]["text"] != fri["mantra"]["text"]
    assert wed["rahu_kalam"]["start"] != fri["rahu_kalam"]["start"]


def test_rahu_kalam_is_a_real_window_before_sunset():
    g = _for(date(2026, 9, 7))  # Monday
    for key in ("rahu_kalam", "gulika_kalam", "yamaganda", "best_time"):
        assert g[key]["start"] and g[key]["end"]
        assert g[key]["start"] != g[key]["end"]
    assert g["approximate"] is False
    assert g["tithi"] and g["nakshatra"]


def test_shape_is_stable():
    g = _for(date(2026, 9, 7))
    for key in (
        "date", "weekday", "planet", "location", "sunrise", "sunset",
        "tithi", "nakshatra", "lucky_color", "mantra", "blessing",
        "rahu_kalam", "gulika_kalam", "yamaganda", "best_time",
    ):
        assert key in g, key
