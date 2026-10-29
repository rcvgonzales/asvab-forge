# One-shot prompt for Claude Code — paste everything below the line

---

Build a complete, production-deployable ASVAB study PWA called **ASVAB Forge**. Work autonomously to completion: scaffold, implement, build, and verify. Do not stop to ask questions — make reasonable decisions and note them in the README.

## Tech stack (non-negotiable)

- **Frontend:** React 18 + Vite. The entire app lives in ONE component file, `frontend/src/App.jsx`. No CSS framework — a `C` palette object and `S` style object with plain inline styles. Google Fonts: Bricolage Grotesque (display), Figtree (body), JetBrains Mono (numbers/timers/labels).
- **Backend:** FastAPI, Python 3.12, ONE file `backend/main.py`: LLM proxy + static file server. `httpx` for async outbound calls, Pydantic for validation. API keys live server-side only.
- **Provider-agnostic LLM:** env var `LLM_PROVIDER` = `gemini` (default, model `gemini-2.5-flash`, use `responseMimeType: application/json`) or `anthropic` (model `claude-sonnet-4-6`). One endpoint: `POST /api/generate` accepting `{prompt, max_tokens, temperature}`, returning `{data: <parsed JSON>}`.
- **Infra:** multi-stage Dockerfile (node:20-slim builds Vite → python:3.12-slim serves API + `static/`), deployable with `gcloud run deploy --source .`, key in Secret Manager. Include `.dockerignore`, `.gitignore`, and a README with local-dev and Cloud Run deploy commands (including the `secrets add-iam-policy-binding` step).
- **Persistence:** localStorage only (single user, per device), key `asvabforge.v2`. PWA: web manifest, standalone iOS meta tags, `100dvh` + `env(safe-area-inset-*)`, and a service worker (`public/sw.js`) that caches the app shell cache-first but NEVER caches `/api/*`.

## Visual identity

Night-ops field manual: bg `#12140F`, panels `#1A1D15`/`#22261B`, lines `#2C3123`, text sand `#E9E3D1`, muted khaki `#8F8B77`, accent ordnance orange `#E86A1F`, green `#82A85C`, red `#C4503C`, amber `#D2A24C`. Mobile-first, max-width 560px, bottom nav with 6 tabs: HOME · LEARN · DRILL · REDO · TEST · VOCAB.

## Domain model

Eight subtests (Assembling Objects intentionally excluded — it's diagram-based; say so in the UI):
AR Arithmetic Reasoning (90s/q budget), WK Word Knowledge (30s), PC Paragraph Comprehension (90s), MK Mathematics Knowledge (60s) — these four are AFQT and visually flagged orange everywhere. GS General Science (45s), EI Electronics Information (50s), AS Auto & Shop (45s), MC Mechanical Comprehension (60s).

Branch AFQT minimum tick marks on the readiness gauge: Army 31, Air Force 31, Marines 32, Navy 35, Coast Guard 40, with a caption: typical HS-diploma floors, confirm with a recruiter.

**Line-score composites (these gate the JOB, not just enlistment):** hardcode `COMPOSITES` — GT General Technical (VE+AR), ST Skilled Technical (VE+AR+MC+GS), EL Electronics (AR+MK+EI+GS), MM Mechanical Maintenance (AS+MC+EI), CL Clerical (VE+AR+MK) — where VE = mean(WK, PC) accuracy. Each has a one-line note on what jobs it opens. Also hardcode `TARGET_JOBS` (Not set, Intelligence analyst → ST/GT, Cyber/IT → ST/GT/EL, Signals intelligence → ST/GT, Electronics/avionics → EL/ST, Medical → ST/GT, Mechanical maintenance → MM/GT, Admin/finance/logistics → CL/GT). Composite readiness = mean of member subtest accuracies ×100, shown only when every member has data. Caption: approximations, verify with recruiter.

**Blueprint grounding (important for question accuracy):** hardcode a `BLUEPRINT` object mapping each subtest to weighted topic lists reflecting the real exam's topology (e.g. AR: distance-rate-time ×3, ratios ×3, percentages/interest ×3, work-rate ×2, mixtures ×1, money/unit conversion ×2, age/number problems ×1, geometry word problems ×1; build equivalent lists for all 8 from standard ASVAB study-guide taxonomies). Each generation call weight-samples 3 topics and instructs the model to distribute questions across them and match official practice-question tone. Do NOT ingest or reproduce content from copyrighted prep books.

**User notes grounding (RAG-lite):** Settings has a per-subtest textarea (`state.notes[subId]`). If notes exist, inject up to 1500 chars into the generation prompt inside `<notes>` tags with the instruction: test the same concepts but write original questions, never copy sentences. Stretch goal only if everything else is done: a backend `/api/embed`-based retrieval over larger note files with brute-force cosine similarity — no vector DB.

## Features (all required)

1. **Adaptive drills.** Batches of 5 per subtest. Difficulty from rolling accuracy: <55% → "foundational", >80% → "hard", else "moderate" (needs ≥5 attempts). Immediate feedback with explanation. Wrong answers show "Added to your redemption queue."
2. **Redemption queue (miss-based spaced repetition).** Every wrong answer (drill AND test) is stored `{...question, sub, box: 1, due: now+1d}`. REDO tab serves due items one at a time. Correct → box+1, intervals [–, 1, 3, 7] days; passing box 3 removes it (mastered, +25 XP). Wrong → back to box 1, due tomorrow. Empty state encourages drilling.
3. **Offline question bank.** Per-subtest arrays in `state.bank`, cap 30 each. Drills serve 5 from the bank instantly when available, then background-refill (batch of 8) when below 10, guarded by a ref so only one refill runs. If offline with an empty bank, show a clear error. Drill picker shows cached counts. With the service worker this makes the app fully usable offline.
4. **Answer-key audit for math.** For AR and MK only: after generating, send a second "auditor" prompt containing the questions+choices asking the model to independently solve each and return `[{"i":0,"answer":2}]`. Drop questions where auditor disagrees with writer. If the audit call fails, serve unaudited rather than nothing.
5. **Rank + XP + gates.** XP: drill correct +10, drill wrong +2, test question correct +15, test completion +30, vocab "knew it" +5, redemption rep +8, mastery +25, all-daily-missions bonus +50. Ranks: E-1 Recruit 0, E-2 Private 300, E-3 PFC 800 (gate: any timed test ≥70%), E-4 Specialist 1600 (test ≥80%), E-5 Sergeant 3000 (test ≥85%), E-6 Staff Sergeant 5200 (test ≥90%), E-7 Sergeant First Class 8000 (gate: readiness ≥90). A rank is held only if XP ≥ threshold AND its gate is met. Home shows current rank, XP bar to next, and the blocking gate with a ✓ when met.
6. **Daily missions.** Reset daily: (a) drill the weakest subtest (lowest accuracy with ≥5 attempts, default AR) — 10 questions, or 20 if a set test date is ≤14 days away; (b) 10 vocab reviews; (c) up to 5 redemption reps if any are due. Progress bars, tap-to-navigate, +50 XP bonus awarded once when all complete (check inside a `finalize(state)` helper run after every mutation).
7. **Timed mini-AFQT.** Sections AR(8q)/WK(8q)/PC(5q)/MK(8q), per-section countdown = n × subtest budget, no pausing; auto-submits at zero. Misses feed the redemption queue. Score recorded to history and `bestTest` (drives rank gates).
8. **Pacing analytics.** Record per-question elapsed ms into `stats[sub].timeMs` in drills, tests, and redemption. Home shows, for subtests with ≥5 attempts, avg seconds vs budget with ON PACE / OVER flags and a caption explaining that OVER means slow, not wrong.
9. **Readiness gauge.** VE = mean(WK acc, PC acc); readiness = round(mean(VE, VE, AR acc, MK acc) × 100). Big mono number, branch tick marks overlaid on the bar, explicit caption: practice signal, NOT an official AFQT score.
10. **Test-date countdown.** Date input in Settings; home shows T−N days (red inside 14) and mission intensity doubles.
11. **Vocab flashcards.** Leitner boxes [1,3,7] days. "Generate 15 new words" calls the LLM with the existing word list for dedup. Tap to flip, Missed it / Knew it.
12. **Export/import backup.** JSON download named `asvab-forge-backup-YYYY-MM-DD.json`; import validates shape before replacing state.
13. **Streak.** Day streak bumped by any scored activity; consecutive-day logic.
14. **Concept lessons (LEARN tab).** Pick subtest → topic list from `BLUEPRINT` sorted by weight (show weight as ●○ dots, ✓ if already read) → LLM-generated lesson cached in `state.lessons["SUB|topic"]`. Lesson prompt returns RAW JSON `{title, core (2-3 short paragraphs), steps[] (3-5 attack method), example {q, solution}, trap (most common mistake), mnemonic (or "")}`, grounded in user notes if present. Render as: core prose card, numbered Method card, Worked example card, red Common trap card, amber Memory hook card, Regenerate button. Wrong drill answers show a "Teach me {SUB} concepts →" link that jumps to LEARN for that subtest. Home quick-actions includes "Concept lessons (learn before you drill)".
15. **Day-one diagnostic.** `state.diagDone` false by default. Home shows a prominent amber "Day one · start here" card explaining to take one diagnostic mini-AFQT BEFORE studying (seeds readiness, weakest-subtest targeting, missions), with a primary "Take the diagnostic (~25 min)" button → TEST, and a ghost "Skip — I already know my baseline". Completing any timed test sets `diagDone = true`.
16. **Target-job focus.** Settings has a Target job select. Home shows a "Line scores" card: when a job is set, show only that job's composites; otherwise the first three. `weakestSub()` (which drives the daily weak-subtest mission) restricts to subtests relevant to the target job (always including the AFQT four) so the mission targets the composites that actually gate the job.

## Backend requirements

- Defensive JSON extraction: strip markdown fences, then fall back to slicing the outermost `[...]` or `{...}`. If unparseable, return HTTP 422 with `{error: "model_output_not_json", raw: <first 2000 chars>}` so the UI can show the model's actual reply.
- Per-IP sliding-window rate limiter (default 60/hour, env `RATE_LIMIT_PER_HOUR`), trusting the first `X-Forwarded-For` entry (Cloud Run). Return 429 with a human message.
- SPA fallback: any non-file, non-`/api` GET serves `index.html`. `GET /api/health` returns `{ok, provider}`.

## Generation prompts (embed these patterns)

- Question prompt: names the subtest, its scope, the 3 sampled blueprint topics, optional `<notes>`, target difficulty, "self-contained text, no images", exactly 4 choices, one correct, concise teaching explanation, RAW JSON ONLY with schema `[{"q","choices","answer","explanation"}]`, 0-based answer index, "vary which index is correct".
- Auditor prompt (AR/MK): independent solver returning RAW JSON `[{"i","answer"}]`.
- Vocab prompt: mid-to-high-frequency WK words, avoid provided known list, RAW JSON `[{"word","def","example"}]`.
- Frontend sanitizer: keep only items with a string `q`, exactly 4 choices, integer `answer` in 0–3.

## Known pitfalls (avoid these — they cost debugging time)

- localStorage schema: merge loaded state over `emptyState()` defaults per subtest so old saves never crash new code; reset `daily` when the date rolls.
- `structuredClone` state before mutating in `setState` updaters; persist inside the setter wrapper.
- Reset the per-question timing ref whenever the question index or batch changes.
- The section timer: `clearInterval` on section finish AND unmount; auto-finish effect keyed on `left`.
- Vite dev proxy `/api` → `localhost:8080` in `vite.config.js`.
- Service worker must skip non-GET and `/api/*` or generation breaks.
- Date input needs `colorScheme: 'dark'` to be legible on the dark palette.
- Don't cache more than ~30 questions per subtest (localStorage bloat).
- Lessons use `max_tokens` ≈ 3000 (longer than questions); still enforce RAW JSON and validate `data.core` exists before caching.
- Compute composite readiness as null (render "need data") until every member subtest has attempts — partial composites mislead.
- The diagnostic banner must disappear on both completion AND skip; don't tie it to `tests.length` alone or a skip re-shows it.

## Acceptance checklist (verify before declaring done)

- [ ] `npm run build` succeeds in `frontend/`
- [ ] Backend imports clean; `extract_json` handles fenced, chatty-preamble, and garbage inputs; rate limiter returns 429 past the limit (test with FastAPI TestClient)
- [ ] Docker build succeeds end-to-end
- [ ] A wrong drill answer appears in REDO the next day (verify by manipulating `due` in devtools)
- [ ] Rank card shows a gate as blocking when XP is sufficient but no qualifying test score exists
- [ ] App loads and drills serve from the bank with network disabled (after one online session)
- [ ] LEARN tab renders a lesson with all five sections and caches it (second open needs no API call)
- [ ] Setting target job "Cyber / IT specialist" changes the weakest-subtest mission to consider EI/GS/MC alongside the AFQT four
- [ ] Diagnostic banner shows on fresh state, disappears after completing a test or pressing Skip
- [ ] README documents local dev, deploy commands, and every judgment call you made
