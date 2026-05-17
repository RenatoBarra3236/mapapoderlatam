from datetime import datetime

import logging
import sys

from scripts.seed_data_tui import SourceStats, TaskState, _run_background_quietly, _task_line, format_stats_table


def test_format_stats_table_shows_loaded_counts():
    lines = format_stats_table(
        [
            SourceStats(
                "infolobby",
                raw_total=10,
                raw_processed=8,
                raw_failed=2,
                source_rows=8,
                entities=5,
                relationships=4,
                latest_status="completed_with_errors",
                latest_processed=8,
                latest_failed=2,
            )
        ]
    )

    rendered = "\n".join(lines)
    assert "Fuente" in rendered
    assert "infolobby" in rendered
    assert "8/2" in rendered
    assert "completed_with_errors 8/2" in rendered


def test_task_line_includes_status_and_message():
    line = _task_line(
        TaskState(
            "ChileCompra worker",
            status="running",
            message="ciclo 1",
            started_at=datetime(2026, 5, 17, 22, 1, 2),
        )
    )

    assert "ChileCompra worker" in line
    assert "running" in line
    assert "22:01:02" in line
    assert "ciclo 1" in line


def test_background_quietly_suppresses_stdout_stderr_and_logs(capsys):
    def noisy_task():
        print("stdout leak")
        print("stderr leak", file=sys.stderr)
        logging.getLogger("seed-data-test").error("log leak")
        return "ok"

    assert _run_background_quietly(noisy_task) == "ok"

    captured = capsys.readouterr()
    assert "stdout leak" not in captured.out
    assert "stderr leak" not in captured.err
    assert "log leak" not in captured.err
