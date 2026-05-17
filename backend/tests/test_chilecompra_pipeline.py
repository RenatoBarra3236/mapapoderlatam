from datetime import datetime

from ingestion.chilecompra_pipeline import TIMEZONE, _priority, is_night_window


def test_night_window_wraps_midnight():
    assert is_night_window(datetime(2026, 5, 17, 22, 30, tzinfo=TIMEZONE))
    assert is_night_window(datetime(2026, 5, 17, 6, 30, tzinfo=TIMEZONE))
    assert not is_night_window(datetime(2026, 5, 17, 12, 0, tzinfo=TIMEZONE))


def test_priority_prefers_high_amount_awarded_records():
    high = {"record": {"Estado": "Adjudicada", "MontoEstimado": 1_000_000_000, "Comprador": {"NombreOrganismo": "Municipalidad Demo"}}}
    low = {"record": {"Estado": "Publicada", "MontoEstimado": 1_000_000, "Comprador": {"NombreOrganismo": "Servicio Demo"}}}

    assert _priority(high) < _priority(low)
