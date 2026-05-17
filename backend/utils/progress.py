import atexit
import os
import re
import shutil
import sys
import threading
from collections.abc import Callable

_ANSI_RE = re.compile(r"\033\[[0-9;]*[mK]")

# ASCII-only spinner: braille/block chars have ambiguous east-asian width
# and some terminals render them as 2 columns, breaking cursor math.
_SPINNER = r"-\|/"


@atexit.register
def _restore_cursor() -> None:
    mode = os.getenv("CHILECOMPRA_TUI", "").lower()
    if sys.stdout.isatty() or mode in {"1", "true", "ansi", "on"}:
        sys.stdout.write("\033[?25h")
        sys.stdout.flush()


class C:
    reset   = "\033[0m"
    bold    = "\033[1m"
    dim     = "\033[2m"
    cyan    = "\033[36m"
    bcyan   = "\033[96m"
    bgreen  = "\033[92m"
    byellow = "\033[93m"
    bblue   = "\033[94m"
    white   = "\033[97m"
    gray    = "\033[90m"
    bred    = "\033[91m"


def _vlen(s: str) -> int:
    return len(_ANSI_RE.sub("", s))


def _pad(s: str, width: int) -> str:
    vl = _vlen(s)
    if vl > width:
        return _ANSI_RE.sub("", s)[:width]
    return s + " " * (width - vl)


def _term_w() -> int:
    return shutil.get_terminal_size(fallback=(80, 24)).columns


def bar(done: int, total: int, width: int = 32) -> str:
    ratio = max(0, min(1, done / total)) if total > 0 else 0
    filled = int(width * ratio)
    return (
        f"{C.bgreen}{'#' * filled}{C.reset}"
        f"{C.gray}{'.' * (width - filled)}{C.reset}"
    )


def budget_bar(used: int, total: int, width: int = 24) -> str:
    ratio = max(0, min(1, used / total)) if total > 0 else 0
    filled = int(width * ratio)
    pct_val = int(100 * ratio) if total > 0 else 0
    color = C.bred if pct_val >= 90 else C.byellow if pct_val >= 70 else C.bblue
    return (
        f"{color}{'#' * filled}{C.reset}"
        f"{C.gray}{'.' * (width - filled)}{C.reset}"
    )


def pct(done: int, total: int) -> str:
    ratio = max(0, min(1, done / total)) if total > 0 else 0
    v = int(100 * ratio) if total > 0 else 0
    color = C.bgreen if v >= 100 else C.byellow if v >= 50 else C.white
    return f"{color}{v:3d}%{C.reset}"


def num(n) -> str:
    try:
        return f"{int(n):,}"
    except (TypeError, ValueError):
        return str(n)


def label(s: str) -> str:
    return f"{C.gray}{s}{C.reset}"


def val(s) -> str:
    return f"{C.bold}{C.white}{s}{C.reset}"


def stat_row(lbl1: str, v1, lbl2: str, v2) -> str:
    return (
        f"  {label(f'{lbl1:<14}')}{val(f'{num(v1):>10}')}"
        f"    {label(f'{lbl2:<12}')}{val(f'{num(v2):>10}')}"
    )


class Dashboard:
    """
    Animated box-drawing dashboard.

    Uses ANSI save/restore cursor (ESC 7 / ESC 8) so the redraw position
    is anchored absolutely — immune to line-wrap miscounts and stderr drift.
    Trailing ESC[J clears any leftover lines from a taller previous render.
    Falls back to plain newlines when stdout is not a TTY.
    """

    def __init__(self, title: str, subtitle: str = ""):
        self._title = title
        self._subtitle = subtitle
        self._frame = 0
        self._last_height = 0
        self._tty = _ansi_capable()
        self._msgs: list[str] = []   # buffered log messages shown inside box
        self._lock = threading.RLock()
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None

    # ------------------------------------------------------------------
    def log(self, msg: str) -> None:
        """Buffer a message to show in the next render (inside the box)."""
        with self._lock:
            self._msgs.append(msg[:72])
            if len(self._msgs) > 4:
                self._msgs.pop(0)

    # ------------------------------------------------------------------
    def start_auto(
        self,
        lines_provider: Callable[[], list[str]],
        status_provider: Callable[[], str] | None = None,
        interval: float = 0.25,
    ) -> None:
        """Render continuously from another thread while blocking work runs."""
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()

        def loop() -> None:
            while not self._stop_event.wait(max(0.05, interval)):
                status = status_provider() if status_provider else "activo"
                self.render(lines_provider(), status=status)

        self.render(lines_provider(), status=status_provider() if status_provider else "activo")
        if not self._tty:
            return
        self._thread = threading.Thread(target=loop, name="dashboard-render", daemon=True)
        self._thread.start()

    # ------------------------------------------------------------------
    def stop_auto(self, final_lines: list[str] | None = None, status: str = "listo") -> None:
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1)
        self._thread = None
        if final_lines is not None:
            self.render(final_lines, status=status)
        if self._tty:
            sys.stdout.write("\033[?25h")
            sys.stdout.flush()

    # ------------------------------------------------------------------
    def render(self, lines: list[str], status: str = "activo") -> None:
        with self._lock:
            self._frame += 1
            spin = f"{C.byellow}{_SPINNER[self._frame % len(_SPINNER)]}{C.reset}"

            w = _term_w()
            inner = max(40, min(w - 4, 68))   # conservative: keep rows stable on narrow terminals

            bc = f"{C.dim}{C.cyan}"
            r = C.reset
            h_line = f"{bc}─{r}" * inner
            top = f"{bc}┌{r}{h_line}{bc}┐{r}"
            bot = f"{bc}└{r}{h_line}{bc}┘{r}"
            mid = f"{bc}├{r}{h_line}{bc}┤{r}"

            def row(content: str = "") -> str:
                return f"{bc}│{r} {_pad(content, inner - 1)}{bc}│{r}"

            title_s = f"{C.bold}{C.white}{self._title}{r}"
            sub_s   = f"  {C.gray}{self._subtitle}{r}" if self._subtitle else ""
            left_s  = f"{C.bcyan}▸{r} {title_s}{sub_s}"
            right_s = f"{spin} {C.bgreen}{status}{r}"
            gap     = max(2, (inner - 1) - _vlen(left_s) - _vlen(right_s))
            header_row = f"{bc}|{r} {_pad(left_s + ' ' * gap + right_s, inner - 1)}{bc}|{r}"

            block = [top, header_row, mid]
            for line in lines:
                block.append(row(line))

            if self._msgs:
                block.append(row(f"  {C.gray}---{C.reset}"))
                for msg in self._msgs:
                    block.append(row(f"  {C.bred}{msg}{C.reset}"))

            block.append(bot)

            if not self._tty:
                for line in block:
                    sys.stdout.write(_ANSI_RE.sub("", line) + "\n")
                sys.stdout.flush()
                return

            if self._last_height:
                sys.stdout.write(f"\033[{self._last_height}A")
            else:
                sys.stdout.write("\033[?25l")

            sys.stdout.write("\r\033[J")           # clear previous frame before drawing
            for line in block:
                sys.stdout.write(f"\r\033[2K{line}\n")

            self._last_height = len(block)
            sys.stdout.write("\033[J")             # clear from cursor to end of screen
            sys.stdout.flush()


def _ansi_capable() -> bool:
    mode = os.getenv("CHILECOMPRA_TUI", "").lower()
    if mode in {"1", "true", "ansi", "on"}:
        return True
    if mode in {"0", "false", "plain", "off"}:
        return False
    if sys.stdout.isatty():
        return True
    term = os.getenv("TERM", "")
    if os.getenv("CI"):
        return False
    return bool(term and term.lower() != "dumb")
