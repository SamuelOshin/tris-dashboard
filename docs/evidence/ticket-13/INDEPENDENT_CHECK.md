# Independent check of CASE_STUDY_01.md

**Not done by a human.** The ticket asks for confirmation that someone other than the implementer followed the case
study and reproduced the result. I could not arrange a human reader. The nearest I could do, and what was done:

- **Who:** an independent AI subagent (a separate model session with no memory of the implementation), told to follow
  `docs/CASE_STUDY_01.md` literally using only the repository documents, not to read the case-study script, the tests or
  the evidence folders, and not to modify any file. It used its own empty database (`tris_cold_check`) and its own
  backend port (8001), so nothing from the author's setup could help it.
- **What it did:** Path A (the one-command path): created the empty database, set `DATABASE_URL`, ran the seed step,
  `alembic stamp head`, started the backend, and ran `python -m app.scripts.case_study --check --base-url http://localhost:8001`.
- **Result:** the run finished with `CASE STUDY REPRODUCED: every figure matches` (exit code 0). It also compared more than
  fifteen of the document's "Expected" figures for steps 1 to 8 with the printed output and found them equal.
- **What it found wrong or missing in the document** (all fixed afterwards): the backend can stop with a
  `UnicodeEncodeError` on Windows when started in the background with redirected output (the document now says to set
  `PYTHONUTF8=1` and `PYTHONIOENCODING=utf-8`); it was unclear that the seed, stamp and server steps all need
  `DATABASE_URL`; the document did not say how to tell the backend is ready, how long it takes, or how to use another
  port (`--base-url`); the default-weights scores were not printed separately by the script (it now prints every figure
  a step produces).
- **What it did not check:** Path B (the on-screen steps and screenshots), the explanations shown in the browser, the
  "opening the case again does not create a second one" claim, the eight-field closure rule, and the automated test.
  The screens themselves were walked by the author and captured in `screenshots/`.

**Note:** after this check the setup commands in section 0 changed (the migration fix replaced the seed-then-stamp
sequence by `alembic upgrade head` then seed). The new sequence was run by the author on a scratch database (migrations,
seed, `alembic check` clean) but the independent reader has not followed the revised text.

## Follow-up: the owner followed the revised document (2026-10-07)

The project owner (not the implementer of the document) followed the revised section 0 and Path A on a new empty database.
- First attempt: sign-in failed with `401 Unauthorized` because the seed step had not been run. The document ran the four
  commands together in one block; it now says to run them in order, one at a time, states that skipping the seed gives
  a 401, and gives the line the seed prints when it succeeds.
- After seeding, the owner's run printed `CASE STUDY REPRODUCED: every figure matches`, with all seven imports accepted
  in full (6, 144, 18, 6, 12, 84 and 12 rows, none rejected), 12 stored forecast runs, risk scores with weight versions 1
  and 2, both closure refusals (`PERMISSION_DENIED`, `SEPARATION_OF_DUTIES_VIOLATION`), the case closed, and the
  validation figures.
- The owner also noticed the stale "Coming soon" strip on the Material Cost page; it was removed.

**Still open:** Path B (the on-screen steps) has been followed only by the author and, in part, the owner; nobody who has
not seen the project has followed the document.
