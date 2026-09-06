from app.services.sarvam import _chunk


def test_short_text_single_chunk():
    assert _chunk("Hello world", 100) == ["Hello world"]


def test_splits_on_sentence_boundary():
    text = "First sentence here. Second sentence here. Third sentence here."
    chunks = _chunk(text, 40)
    assert all(len(c) <= 40 for c in chunks)
    assert "".join(chunks).replace(" ", "") == text.replace(" ", "")


def test_hard_wraps_oversized_sentence():
    text = "x" * 250
    chunks = _chunk(text, 100)
    assert [len(c) for c in chunks] == [100, 100, 50]
