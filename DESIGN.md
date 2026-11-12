# HAFS Focus — Study OS Design System

Status: proposed UI redesign on `feat/study-os-redesign`. Official school affiliation is **not** implied.

## Product principles

1. **Academic, not decorative.** Prioritize current school activity, active timer, remaining tasks and personal timetable.
2. **Monochrome first.** Use color only where state recognition materially improves accuracy.
3. **Local first.** No authentication, server or Notion sync is activated by this UI change.
4. **Real information only.** Never fabricate class subjects or school announcements. A blank timetable must remain blank until the student edits it.
5. **Preserve behavior.** Timer calculation, storage key, profile mapping and official day schedule stay unchanged.

## Core tokens

| Token | Value | Use |
| --- | --- | --- |
| `--ink` | `#171717` | Primary content |
| `--ink2` | `#414141` | Secondary emphasis |
| `--muted` | `#6b6b6b` | Supporting content |
| `--line` | `#e5e5e5` | Dividers and borders |
| `--bg` | `#f5f5f4` | App background |
| `--white` | `#ffffff` | Card background |
| `--dark` | `#171717` | Sidebar and active timer panel |
| `--success` | `#287452` | Sparse success states |
| `--focus` | `#525252` | Keyboard focus ring |
| `--r` | `14px` | Card corner radius |
| `--space-1/2/3/4/6/8` | `4/8/12/16/24/32px` | Spacing scale |

Typography: `Pretendard Variable` or installed Pretendard, then Inter / Noto Sans KR / system UI fallback. Font assets are **not** fetched from third-party servers. Use `font-variant-numeric:tabular-nums` for running timers, durations, timestamps and charts.

Text hierarchy:
- Page titles: approximately 25–29px semibold/bold
- Primary metrics: approximately 32–56px bold with tabular numerals
- Cards and labels: 12–15px, concise and consistent
- Metadata: approximately 11–12px, not relied upon as the sole indication of status

## Navigation

- Desktop and tablet: persistent dark sidebar with visible labels.
- Phone at or below 700px: six primary destinations in fixed bottom navigation (home, timer, schedule, tasks, statistics, settings).
- The top date and profile controls remain accessible.
- Navigation changes must never reset the active timer or stored data.

## Screen layout

### Home
1. Current and next HAFS day activity.
2. Active timer or quick entrance to the timer.
3. Today study time, running duration, pending task count.
4. Three upcoming tasks and recent study sessions.

The school-day panel comes from verified grade/day data; blank timetable cells display generic period labels. Mock data must not be shown as real content.

### Study timer
- Make the selected subject and study type explicit.
- Running time has the strongest visual weight.
- Keep **Start**, **Pause/Resume** and **Finish & save** separate.
- No change to timestamp or interval accounting; paused time is excluded.

### School day and personal timetable
- Keep the official GMC-based day schedule and source link.
- Keep nine independent grade–track timetable slots.
- Desktop: weekday columns; phone: one-day-at-a-time weekday switch.
- Highlight current school slot using KST without inventing subjects.
- Timetable cells remain user-edited strings, not prefilled guesses.

### My subjects
- Subject labels are editable, but IDs are stable.
- Added subjects are available in the timer and per-subject analytics.
- Archive instead of delete; completed sessions remain queryable.
- Rename does not rewrite historical session references.
- If a rename matches timetable cell text, user chooses whether to rename those cells.
- Subject management is in Settings and linked from the timer.

### Planner and analytics
- Inline edit of task title/due date; checkbox completion and delete retain their meaning.
- Pending tasks appear on Home.
- Per-subject and last-seven-day values continue to be computed from actual intervals, not estimates.
- Empty states are contextual and nonjudgmental.

## Responsive behavior

| Width | Main behavior |
| --- | --- |
| >1100px | Multi-column dashboard, sidebar |
| 701–1100px | Compact dashboard, stacked timetable area, sidebar |
| <=700px | Fixed bottom navigation, single-column content, weekday switch |
| <=440px | Condensed cards, stacked add-subject form and two-column timer controls |

Buttons and inputs should generally be at least 44px on touch surfaces; low-density administrative buttons may be 38px with enough separation.

## Interaction and accessibility

- Explicit text for timer state: READY / FOCUSING / PAUSED; color alone is not sufficient.
- Visible keyboard focus; keyboard-accessible nav, timetable, subject rename and task edit.
- Respect `prefers-reduced-motion`.
- Keep confirmation for destructive operations and bulk timetable subject renames.
- Avoid auto animations around a running timer.
- Prefer text content insertion (`textContent`) over HTML interpolation for student data.

## Preservation constraints

- `hafs-focus-v2` and `hafs-focus-study-v1` keys are unchanged.
- The JSON backup envelope (`app`, `version: 2`, `exportedAt`, `data`) remains unchanged; `data.subjects` is an additive, optional v2 extension.
- Existing `session.subject` strings remain valid IDs for the default subjects.
- Legacy records are normalized without discarding previously recognized sessions.
- The original timer interval math and `dailySlots` school schedule remain unchanged.
- PWA shell caching updates only by a version bump after resource changes.

## Reference patterns

- RESET LAB: established monochrome style, **visual inspiration only**.
- Notion: typographic clarity and sparse density.
- Linear: tightly aligned dashboards and clear state affordances.
- 21st.dev: reusable dashboard compositions.
- Dribbble student productivity UI: study-first mobile hierarchy.

These are design references, not embedded external dependencies.
