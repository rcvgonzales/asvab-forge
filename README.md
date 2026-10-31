# ASVAB Forge

AI-powered ASVAB prep PWA. Vite/React SPA → FastAPI proxy + static server → LLM provider, one Docker container on Cloud Run, API key in Secret Manager. Single user, per device: all progress lives in `localStorage` (`asvabforge.v2`).

## What it does

- **HOME** — rank + XP bar with the blocking promotion gate, daily missions, AFQT readiness gauge with branch minimum ticks, line-score composites for your target job, subtest accuracy, pacing vs budget, T−N test-date countdown, settings (test date, target job, per-subtest study notes, backup export/import).
- **LEARN** — blueprint topics per subtest (weight shown as ●○ dots, ✓ once read) → AI lesson: core concept, method, worked example, common trap, memory hook. Cached; reopening costs no API call.
- **DRILL** — batches of 5, adaptive difficulty, instant explanations. Served from an offline question bank when possible; the bank refills itself in the background.
- **REDO** — every missed question (drill or test) returns on 1/3/7-day spacing; three clean reps master it.
- **TEST** — timed mini-AFQT: AR 8 · WK 8 · PC 5 · MK 8, per-section countdown, no pausing, auto-submit at zero.
- **VOCAB** — Leitner flashcards for Word Knowledge, AI-generated with dedup against your deck.
- AR/MK answer keys are re-checked by a second "auditor" LLM pass; questions where writer and auditor disagree are dropped.
- Assembling Objects is intentionally excluded (diagram-based; text generation would train the wrong skill). The UI says so.

## Local dev

```bash
# terminal 1 — backend (Python 3.12)
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export LLM_PROVIDER=gemini          # or anthropic
export GEMINI_API_KEY=your-key      # or ANTHROPIC_API_KEY
uvicorn main:app --reload --port 8080

# terminal 2 — frontend (Vite proxies /api → localhost:8080)
cd frontend
npm install
npm run dev
```

Frontend unit tests (`cleanMath`): `cd frontend && npm test`.

Backend tests (JSON extraction, 429 rate limiting, 422 on non-JSON output, model fallback, SPA fallback):

```bash
pip install pytest && pytest backend/
```

Production-like local run:

```bash
docker build -t asvab-forge .
docker run -p 8080:8080 -e GEMINI_API_KEY=your-key asvab-forge
```

### Environment variables

| Var | Default | Notes |
|---|---|---|
| `LLM_PROVIDER` | `gemini` | `gemini` or `anthropic` |
| `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` | — | server-side only |
| `GEMINI_MODEL` | `gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite` | preference order for hedged fallback |
| `GEMINI_TIMEOUT` | `30` | seconds per model attempt |
| `GEMINI_HEDGE_AFTER` | `8` | seconds before racing the next model |
| `GEMINI_THINKING_BUDGET_HIGH` | `1024` | budget for `thinking: "high"` requests (auditor) |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | |
| `GEMINI_THINKING_BUDGET` | `256` | default budget, added on top of `max_tokens` |
| `RATE_LIMIT_PER_HOUR` | `60` | per client IP, `/api/generate` only |
| `STATIC_DIR` | `./static` beside `main.py` | Docker copies the Vite build here |

## Deploy to Cloud Run

```bash
PROJECT_ID=$(gcloud config get-value project)
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com

# 1. store the key
# (strip the newline — a trailing \n in the key breaks the request header)
grep '^GEMINI_API_KEY=' .env | cut -d= -f2- | tr -d '\n' | \
  gcloud secrets create asvab-forge-gemini-key --data-file=-

# 2. let the Cloud Run runtime service account read it
gcloud secrets add-iam-policy-binding asvab-forge-gemini-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# 3. build from source (Cloud Build runs the Dockerfile) and deploy
gcloud run deploy asvab-forge \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --max-instances 1 \
  --set-env-vars LLM_PROVIDER=gemini \
  --set-secrets GEMINI_API_KEY=asvab-forge-gemini-key:latest
```

For Anthropic, create an `anthropic-api-key` secret the same way and deploy with `--set-env-vars LLM_PROVIDER=anthropic --set-secrets ANTHROPIC_API_KEY=anthropic-api-key:latest`. Rotate a key with `gcloud secrets versions add <name> --data-file=-`. Scale-to-zero keeps a personal instance in the free tier.

## Layout

```
├── frontend/
│   ├── index.html            PWA + iOS standalone meta, safe-area viewport, Google Fonts
│   ├── vite.config.js        dev proxy /api → :8080
│   ├── public/               manifest, sw.js, icons
│   └── src/App.jsx           the entire app (C palette + S styles, inline)
├── backend/
│   ├── main.py               FastAPI: /api/generate, /api/health, static SPA server
│   └── test_main.py          pytest suite (not shipped in the image)
├── Dockerfile                node:20-slim builds → python:3.12-slim serves
└── README.md
```

## Judgment calls

**Scoring and progression**
- **Readiness needs the full AFQT picture.** The readiness number shows "need data" until VE (WK or PC), AR and MK all have attempts, so a strong WK session alone can't read as AFQT-ready. Composites follow the same rule.
- **Adaptive difficulty uses a rolling window.** "Rolling accuracy" is the last 20 scored answers per subtest (`stats[id].recent`), not lifetime accuracy. It's recomputed every batch, so difficulty shifts mid-session. You need ≥5 answers in the window; before that it's "moderate".
- **Ranks are sequential.** You can't skip a rank whose gate is still blocking. For example, 9000 XP with a best test of 85% holds E-5 Sergeant, not E-7. When you have the XP for the next rank but not its gate, the rank card shows **PROMOTION BLOCKED**.
- **Redemption XP.** Correct reps earn +8 (+25 instead on mastery). A wrong rep resets the item to box 1 and earns nothing.
- **Missions.** The redemption mission's target is `min(5, reps done today + due now)`, so it stays satisfiable once you've cleared the queue. The weakest-subtest mission counts drill answers only.

**Timed test**
- **Unanswered questions are wrong.** When the clock auto-submits, unanswered questions count against the test score, like the real CAT-ASVAB's unfinished-section penalty. They are *not* added to subtest stats, because there's no knowledge signal in them.
- **Stats are committed when the test completes.** If you leave mid-test, nothing is recorded, and the timer is cleared on unmount. Misses are queued as you answer.
- **The section budget follows the questions actually served.** The AR/MK audit can drop a question, so the countdown is `questions served × subtest budget`, and pacing stays realistic.
- **Tests can use the bank.** If generation comes back short or you're offline, a section is topped up from the offline bank. A mid-test generation failure offers to retry that section and keeps the sections you've finished.

**Questions and generation**
- **Offline drills.** With fewer than 5 banked questions and no network, a drill serves whatever is banked instead of erroring. The error appears only when the bank for that subtest is empty.
- **Plain-text math.** The question, lesson and auditor prompts all require printed-test Unicode (x², √(x+1), π, ×, a/b) and forbid LaTeX. As a safety net, `cleanMath()` in `App.jsx` converts any LaTeX that slips through. It runs on every question, choice, explanation and lesson field, and at load time on the saved bank, redemption queue and lessons. A `$…$` pair counts as math only when it contains LaTeX markers, so prices like `$12` survive. Unit tests: `cd frontend && npm test`.
- **Audit tolerance.** Questions the auditor skips are kept. Only explicit disagreements are dropped.
- **Gemini model chain, tuned for speed.** `gemini-2.5-flash` (the original spec) is closed to new API users, and `gemini-3.8-flash` hung for 60s on every call in testing. Measured on 2026-10-30 for a 5-question batch: 3.5-flash took 5.5–7.6s, 3.5-flash-lite 2.4s and 3.1-flash-lite 5s. The backend uses 3.5-flash → 3.5-flash-lite → 3.1-flash-lite with hedging: a 429/5xx hands off to the next model at once, and a model still silent after 8s gets raced by the next. The first answer wins and the rest are cancelled. Bad-key and bad-request errors fail fast, upstream timeouts return a readable 504, and the key goes in the `x-goog-api-key` header, never the URL.
- **Broken JSON from the model.** Even in JSON mode, lite models occasionally drop a quote or truncate a reply (seen live: `["reinforce", abandon", …]`). The backend repairs near-misses (a missing opening quote on an array item, trailing commas) only after a strict parse fails. If a reply still isn't valid JSON, the next model gets a turn, as with an overload. The app also retries once silently on garbled output, 502, 503 or 504, and only then shows a plain-English error.
- **Thinking budgets.** The default is 256 tokens: 1024 cost 1–2s per call without better questions, and 0 is rejected by the lite models. The answer-key auditor asks for `thinking: "high"` (1024) because accuracy matters more than speed there.
- **Speed on the client.** The timed test generates all four sections in parallel when you press Start, so a whole mini-AFQT took about 14s instead of one wait per section. On app open the offline bank for today's weak-subtest mission fills in the background, so the first drill is usually instant. The spinner shows elapsed seconds. Measured end to end: AR batch with audit 9s (was ~105s), lesson 6s (was ~50s).
- **Separate secret.** The deploy uses `asvab-forge-gemini-key`, not `gemini-api-key`, because Study Forge already reads `gemini-api-key:latest` in the same project.
- **Gemini thinking budget.** gemini-2.5-flash counts thinking tokens against `maxOutputTokens`, which silently truncated long JSON such as lessons. The backend sets `thinkingBudget` (default 1024) and adds it on top of the requested `max_tokens`.
- **`extract_json` picks the bracket that opens first.** A chatty reply wrapping `{"steps":[...]}` then parses as the object, not the inner array.
- **Notes cap.** Up to 1500 characters of your notes go into both question and lesson prompts. Vocab dedup sends the newest 200 words in your deck.

**Persistence**
- **Old saves.** Saves are hydrated over fresh defaults (per subtest, plus arrays and objects). A pre-diagnostic save that already has a test result is treated as `diagDone`, so the banner doesn't reappear. Saves are also read from `asvabforge.v1` if no v2 key exists.
- **Import validation.** Import checks the shape (a `stats` object with numeric attempted/correct, array fields, numeric XP) and rejects anything else with a message before touching state.
- **Reset progress.** A ⚙ SETTINGS button at the top of HOME jumps to the Settings card. "Reset all progress…" opens an inline **Are you sure?** panel; nothing is erased until "Yes, erase everything". By default it wipes everything, including lessons, offline questions and notes. A checkbox can keep those three, since they're expensive to regenerate or are your own writing. It also deletes the legacy `asvabforge.v1` save so the load fallback can't resurrect old progress.
- **Midnight rollover.** Daily missions roll over on navigation and on window focus as well as on load, so an app left open past midnight resets correctly.

**Service worker and backend**
- **Service-worker strategy.** Navigations are network-first with a 3s timeout, falling back to the cached shell when offline or slow, so a new deploy shows on the next open. Hashed assets, fonts and icons are cache-first. When a new worker replaces an older one, the page reloads itself once; this doesn't happen on a first visit, and the reload can't loop. `/api/*` and non-GET requests are never intercepted. The backend serves `index.html` and `sw.js` with `Cache-Control: no-cache`.
- **Backend hardening.** The SPA fallback never serves `index.html` for `/api/*` (unknown API paths return 404) and refuses `../` traversal out of `static/`. The rate limiter trusts the first `X-Forwarded-For` hop, which Cloud Run sets, and prunes idle IPs. It's in-memory per instance, hence `--max-instances 1` above.

**Content and scope**
- **Blueprint weights** are rough emphasis drawn from standard ASVAB study-guide taxonomies, not official percentages. No copyrighted prep-book content is ingested or reproduced. Study notes are your own text, and prompts tell the model never to copy sentences from them.
- **Branch minimums and composite formulas** are approximations (typical HS-diploma floors; VE = mean of WK and PC accuracy). The UI says to verify with a recruiter.
- **Icons** are generated (orange rank chevrons on night olive): `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`.
- **Not built:** the stretch goal (`/api/embed` retrieval over large note files). Notes are injected directly up to the character cap.

## Known limits

- No cross-device sync. Export a backup before clearing the browser or switching devices; Firestore would be the natural next step.
- The rate limiter's state resets when the instance restarts or scales.
