"""
Compare the Ticket 1 baseline test run with the current full run, test by test.

Usage (from the repository root):
    python docs/evidence/ticket-14/regression_diff.py

A regression is a test that passed at the baseline and does not pass now: it failed, was skipped,
or is missing (deleted or renamed). New tests are listed but are not regressions.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BASELINE = ROOT / "docs" / "baseline" / "v14_baseline_tests.txt"
CURRENT = ROOT / "docs" / "evidence" / "ticket-14" / "backend_regression.txt"
LINE = re.compile(
    r"^(tests/\S.*?::.*?)\s+(PASSED|FAILED|SKIPPED|ERROR|XFAIL|XPASS)\s+\[\s*\d+%\]", re.M
)


def outcomes(path: Path) -> dict[str, str]:
    text = path.read_text(encoding="utf-8", errors="replace").replace("\\", "/")
    return {name: status for name, status in LINE.findall(text)}


def main() -> int:
    before, now = outcomes(BASELINE), outcomes(CURRENT)
    passed_before = {n for n, s in before.items() if s == "PASSED"}
    broken = sorted(n for n in passed_before if now.get(n) != "PASSED")
    new = sorted(n for n in now if n not in before)
    print(f"baseline tests recorded: {len(before)} ({len(passed_before)} passed)")
    print(f"current tests recorded:  {len(now)} ({sum(1 for s in now.values() if s == 'PASSED')} passed)")
    print(f"baseline tests that no longer pass: {len(broken)}")
    for name in broken:
        print(f"  REGRESSION {name}: now {now.get(name, 'MISSING')}")
    print(f"tests added since the baseline: {len(new)}")
    print("RESULT:", "ZERO REGRESSIONS" if not broken and passed_before else "REGRESSIONS FOUND")
    return 1 if broken or not passed_before else 0


if __name__ == "__main__":
    sys.exit(main())
