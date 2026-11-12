# UI/UX redesign review — before / after

Date: 2026-11-12 KST
Status: implemented on feature branch, draft PR, **not merged to main**.

- Baseline `main` commit: `d7b004bee9ee7665e63b93d8a479b3ac2311e4e3`
- Branch: `feat/study-os-redesign`
- Draft PR: https://github.com/ggy5555/hafs-focus/pull/1

## Change comparison

| Area | Before (main) | After (branch) |
| --- | --- | --- |
| Dashboard | Four equally ranked metric cards first | Current/next school day and running timer above subordinate summary statistics |
| Mobile navigation | Horizontal icon-only top bar | Fixed labeled bottom navigation with six original destinations |
| Study timer | Subject dropdown with fixed nine labels, numeric clock and three controls | Custom catalog selector/management entry, prominent running subject, localized state controls, responsive button layout |
| Subject management | Fixed `SUBJECTS` array, no user editing | Add/rename/archive/restore with stable IDs; legacy subjects continue to work |
| Weekly timetable | Desktop six-column layout also used on phone with horizontal scrolling | Desktop full table; phone weekday switch and single-day editing; current period highlighted |
| Planner | Create/complete/delete | Existing actions plus inline title/due date edits and home preview |
| Analytics | Seven-day study bars and subject totals | Existing calculations preserved; custom subject IDs resolve to student-facing names |
| Styles | Existing RESET LAB inspired monoscale CSS | Explicit academic tokens, consistent spacing, cards and mobile touch targets |
| PWA | Cache v2 | Cache v3 after static resource change |
| Notion | No sync | No sync; reviewed draft of OAuth, secure per-user API and data source mapping only |

## Preservation audit

- Original clock and pause/interval overlap functions were not modified.
- Original 3-grade × 3-track profiles and day schedules were not modified.
- Timetable cell storage remains the same 5 × 8 string matrix under each profile key.
- `hafs-focus-v2` and legacy storage key are unchanged.
- JSON export remains `{app: 'HAFS Focus', version: 2, exportedAt, data}`; the catalog is an optional new field inside `data`.
- Past `session.subject` values for default subjects stay valid as stable identifiers, even after display-name edits.
- New subjects are referenced by unique stable IDs. Historical unknown IDs are retained as archived references rather than silently dropped.
- PWA manifest and existing offline shell behavior remain intact; cache version is updated.
- No API credentials, network connections to Notion or external servers are included.

## Automated verification

GitHub Actions run: https://github.com/ggy5555/hafs-focus/actions/runs/43183340497

| Check | Method | Result |
| --- | --- | --- |
| JavaScript syntax | `node --check app.js` | **Passed** |
| Existing school/timer/profile tests | `node --test tests/*.test.cjs` | **Passed** |
| New subject migration, rename, archive, history and backup tests | Same Node command | **Passed** |
| Mobile layout | Playwright Chromium, 390 × 844 | **Passed** |
| Tablet layout | Playwright Chromium, 820 × 1180 | **Passed** |
| Desktop layout | Playwright Chromium, 1440 × 900 | **Passed** |
| Subjects -> rename -> active study -> end and preserve intervals | Browser smoke | **Passed** |
| Task create/edit/complete | Browser smoke | **Passed** |
| Nine-profile timetable isolation (grade switch) | Browser smoke | **Passed** |
| JSON export and reload persistence | Browser smoke | **Passed** |
| Service worker offline reload | Browser smoke | **Passed** |
| Browser runtime errors / horizontal overflow | Browser smoke | **Passed** |

These are automated checks, not a substitute for hands-on student usability testing. All manual review and any production deployment require separate approval.

## Remaining / deliberately deferred

- Notion live OAuth, Notion API writes, per-student identity, hosting and external deployment **not implemented**.
- No automatic multi-device synchronization of study records.
- Human visual review, keyboard/screen-reader accessibility audit and testing on physical devices remain recommended before merging.
- The deployed GitHub Pages URL still serves `main`; the feature branch can be reviewed through the PR and local checkout, not the production URL.

## Next approval gate

Review the draft PR and browser functionality. Merge to `main` only on explicit user approval. Separately approve backend provider, authentication model and Notion scope before any live integration.
