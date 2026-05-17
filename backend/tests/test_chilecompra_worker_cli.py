import io

from scripts.chilecompra_worker import _backfill_lines
from utils.progress import Dashboard


def test_backfill_tui_keeps_only_essential_progress_and_budget():
    lines = _backfill_lines(
        idx=3,
        total=10,
        target_date="2024-01-03",
        kind="all",
        totals={"discovered": 5, "queued": 4, "processed": 2, "failed": 0, "skipped": 1, "errors": 0},
        depth=4,
        used=90,
        daily_budget=9000,
    )

    rendered = "\n".join(lines)
    assert "Fechas" in rendered
    assert "Budget" in rendered
    assert "3 / 10 fechas" in rendered
    assert "90 / 9,000 llamadas" in rendered
    assert "Endpoint" not in rendered
    assert "Params" not in rendered
    assert "Copiar URL" not in rendered
    assert "ticket" not in rendered.lower()


def test_dashboard_clears_previous_frame_before_redraw(monkeypatch):
    output = io.StringIO()
    monkeypatch.setenv("CHILECOMPRA_TUI", "ansi")
    monkeypatch.setattr("sys.stdout", output)

    dash = Dashboard("TEST")
    dash.render(["first"], status="activo")
    dash.render(["second"], status="activo")

    rendered = output.getvalue()
    assert "\r\033[J" in rendered
    assert rendered.count("\r\033[J") == 2
    assert "\033[5A" in rendered
