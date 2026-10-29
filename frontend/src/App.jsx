import React, { useEffect, useRef, useState } from 'react'

/* ================================================================== tokens */
const C = {
  bg: '#12140F',       // night olive
  panel: '#1A1D15',
  panel2: '#22261B',
  line: '#2C3123',
  sand: '#E9E3D1',
  khaki: '#8F8B77',
  olive: '#5A6349',
  blaze: '#E86A1F',    // ordnance orange
  green: '#82A85C',
  red: '#C4503C',
  amber: '#D2A24C',
}
const F = {
  disp: "'Bricolage Grotesque', sans-serif",
  body: "'Figtree', sans-serif",
  mono: "'JetBrains Mono', monospace",
}
const S = {
  app: {
    minHeight: '100dvh', background: C.bg, color: C.sand, fontFamily: F.body,
    display: 'flex', flexDirection: 'column',
    paddingTop: 'env(safe-area-inset-top)',
  },
  wrap: { width: '100%', maxWidth: 560, margin: '0 auto', padding: '0 16px', flex: 1 },
  h1: { fontFamily: F.disp, fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', margin: '18px 0 2px' },
  sub: { color: C.khaki, fontSize: 13, margin: 0 },
  card: { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, marginTop: 14 },
  label: { fontFamily: F.mono, fontSize: 11, letterSpacing: '0.12em', color: C.khaki, textTransform: 'uppercase' },
  btn: {
    background: C.blaze, color: '#16120C', border: 'none', borderRadius: 10,
    padding: '13px 18px', fontFamily: F.disp, fontWeight: 600, fontSize: 15,
    cursor: 'pointer', width: '100%',
  },
  btnGhost: {
    background: 'transparent', color: C.sand, border: `1px solid ${C.line}`,
    borderRadius: 10, padding: '12px 16px', fontFamily: F.body, fontWeight: 500,
    fontSize: 14, cursor: 'pointer', width: '100%', textAlign: 'left',
  },
  nav: {
    display: 'flex', borderTop: `1px solid ${C.line}`, background: C.panel,
    paddingBottom: 'env(safe-area-inset-bottom)',
    position: 'sticky', bottom: 0, zIndex: 10,
  },
  navBtn: (active) => ({
    flex: 1, background: 'none', border: 'none', padding: '12px 0 10px',
    color: active ? C.blaze : C.khaki, fontFamily: F.mono, fontSize: 10,
    letterSpacing: '0.06em', cursor: 'pointer',
  }),
  choice: (state) => ({
    display: 'block', width: '100%', textAlign: 'left', marginTop: 8,
    padding: '13px 14px', borderRadius: 10, fontSize: 15, cursor: 'pointer',
    fontFamily: F.body, color: C.sand,
    background: state === 'correct' ? 'rgba(130,168,92,0.15)'
      : state === 'wrong' ? 'rgba(196,80,60,0.15)' : C.panel2,
    border: `1px solid ${state === 'correct' ? C.green : state === 'wrong' ? C.red : C.line}`,
  }),
}

/* ================================================================== domain */
const SUBTESTS = [
  { id: 'AR', name: 'Arithmetic Reasoning', afqt: true, secs: 90,
    desc: 'Word problems: rates, ratios, percentages, interest, work problems.' },
  { id: 'WK', name: 'Word Knowledge', afqt: true, secs: 30,
    desc: 'Synonyms and meaning-in-context for military-relevant vocabulary.' },
  { id: 'PC', name: 'Paragraph Comprehension', afqt: true, secs: 90,
    desc: 'Short passages: main idea, inference, detail, author purpose.' },
  { id: 'MK', name: 'Mathematics Knowledge', afqt: true, secs: 60,
    desc: 'Algebra, geometry, exponents, factoring, equations.' },
  { id: 'GS', name: 'General Science', afqt: false, secs: 45,
    desc: 'Biology, chemistry, physics, earth science fundamentals.' },
  { id: 'EI', name: 'Electronics Information', afqt: false, secs: 50,
    desc: "Circuits, Ohm's law, components, electrical systems." },
  { id: 'AS', name: 'Auto & Shop', afqt: false, secs: 45,
    desc: 'Engines, vehicle systems, shop tools and practices.' },
  { id: 'MC', name: 'Mechanical Comprehension', afqt: false, secs: 60,
    desc: 'Levers, pulleys, gears, pressure, described without diagrams.' },
]
const SUB = (id) => SUBTESTS.find((s) => s.id === id)

/* Exam blueprint: topic taxonomy per subtest, used to ground generation in the
   real test's topology rather than whatever the LLM defaults to. Weights are
   rough emphasis, not official percentages. */
const BLUEPRINT = {
  AR: [
    ['distance-rate-time', 3], ['ratios & proportions', 3], ['percentages, discounts, simple interest', 3],
    ['work-rate problems (combined workers)', 2], ['mixtures & concentrations', 1],
    ['money & unit conversion', 2], ['age and number relationship problems', 1], ['geometry word problems (area, perimeter)', 1],
  ],
  WK: [
    ['direct synonym ("X most nearly means")', 4], ['meaning from context sentence', 3],
    ['prefix/root/suffix inference', 2], ['commonly confused words', 1],
  ],
  PC: [
    ['main idea', 3], ['stated detail', 2], ['inference', 3],
    ['vocabulary in context', 1], ['author purpose or tone', 1], ['sequence / following instructions', 1],
  ],
  MK: [
    ['solving linear equations & inequalities', 3], ['exponents & radicals', 2],
    ['factoring & polynomials', 2], ['fractions, decimals, order of operations', 2],
    ['geometry: angles, triangles, circles, area/volume', 3], ['probability & basic statistics', 1],
  ],
  GS: [
    ['human body systems & nutrition', 3], ['biology: cells, genetics, ecology', 2],
    ['physics: motion, energy, heat, light, sound', 3], ['chemistry: atoms, compounds, reactions', 2],
    ['earth & space: geology, weather, astronomy', 2],
  ],
  EI: [
    ["Ohm's law, power, series/parallel circuits", 3], ['components: resistors, capacitors, diodes, transistors', 3],
    ['AC vs DC, transformers, motors', 2], ['wiring, grounding, fuses, electrical safety', 2], ['radio & frequency basics', 1],
  ],
  AS: [
    ['four-stroke engine cycle & engine components', 3], ['fuel, ignition, cooling, lubrication systems', 2],
    ['drivetrain, brakes, suspension, steering', 2], ['shop tools: identification & proper use', 3],
    ['fasteners, measurement, materials & processes', 2],
  ],
  MC: [
    ['levers & mechanical advantage', 3], ['pulleys, gears, gear ratios', 3],
    ['fluids, pressure, hydraulics', 2], ['springs, friction, inclined planes', 2],
    ['force, motion, torque basics', 2], ['structural loads & supports', 1],
  ],
}
/* Line-score composites: these gate the JOB, not just enlistment.
   Approximations of official composites (VE = WK+PC verbal expression). */
const COMPOSITES = [
  { id: 'GT', name: 'General Technical', subs: ['VE', 'AR'], branch: 'Army/Marines',
    note: 'Intel, MP, most technical MOS. 110+ opens most doors.' },
  { id: 'ST', name: 'Skilled Technical', subs: ['VE', 'AR', 'MC', 'GS'], branch: 'Army',
    note: 'Cyber, signals intel, medical, IT.' },
  { id: 'EL', name: 'Electronics', subs: ['AR', 'MK', 'EI', 'GS'], branch: 'Army/Air Force',
    note: 'Electronics repair, avionics, cyber ops.' },
  { id: 'MM', name: 'Mechanical Maintenance', subs: ['AS', 'MC', 'EI'], branch: 'Army',
    note: 'Vehicle, aircraft, equipment maintenance.' },
  { id: 'CL', name: 'Clerical', subs: ['VE', 'AR', 'MK'], branch: 'Army',
    note: 'Admin, finance, HR, logistics.' },
]
const TARGET_JOBS = [
  { name: 'Not set', comps: [] },
  { name: 'Intelligence analyst', comps: ['ST', 'GT'] },
  { name: 'Cyber / IT specialist', comps: ['ST', 'GT', 'EL'] },
  { name: 'Signals intelligence', comps: ['ST', 'GT'] },
  { name: 'Electronics / avionics', comps: ['EL', 'ST'] },
  { name: 'Medical / healthcare', comps: ['ST', 'GT'] },
  { name: 'Mechanical maintenance', comps: ['MM', 'GT'] },
  { name: 'Admin / finance / logistics', comps: ['CL', 'GT'] },
]

/* weighted sample of 3 topics for a batch */
const sampleTopics = (id) => {
  const pool = (BLUEPRINT[id] || []).flatMap(([t, w]) => Array(w).fill(t))
  const picked = new Set()
  while (picked.size < Math.min(3, new Set(pool).size)) {
    picked.add(pool[Math.floor(Math.random() * pool.length)])
  }
  return [...picked]
}
const BRANCHES = [
  { name: 'Army', min: 31 }, { name: 'Air Force', min: 31 },
  { name: 'Marines', min: 32 }, { name: 'Navy', min: 35 },
  { name: 'Coast Guard', min: 40 },
]
const RANKS = [
  { grade: 'E-1', name: 'Recruit', xp: 0 },
  { grade: 'E-2', name: 'Private', xp: 300 },
  { grade: 'E-3', name: 'Private First Class', xp: 800, gate: { test: 70 } },
  { grade: 'E-4', name: 'Specialist', xp: 1600, gate: { test: 80 } },
  { grade: 'E-5', name: 'Sergeant', xp: 3000, gate: { test: 85 } },
  { grade: 'E-6', name: 'Staff Sergeant', xp: 5200, gate: { test: 90 } },
  { grade: 'E-7', name: 'Sergeant First Class', xp: 8000, gate: { readiness: 90 } },
]
const XP = { drillRight: 10, drillWrong: 2, testRight: 15, testDone: 30, vocabKnew: 5, missRep: 8, missMastered: 25, dailyBonus: 50 }
const BOX_INTERVALS = [0, 1, 3, 7] // days per Leitner box (1-indexed)
const BANK_MIN = 10   // refill threshold per subtest
const BANK_BATCH = 8  // questions per refill call

/* ================================================================== storage */
const KEY = 'asvabforge.v2'
const today = () => new Date().toISOString().slice(0, 10)
const freshDaily = () => ({ date: today(), counts: {}, vocab: 0, miss: 0, bonus: false })
const emptyState = () => ({
  v: 2,
  stats: Object.fromEntries(SUBTESTS.map((s) => [s.id, { attempted: 0, correct: 0, timeMs: 0, recent: [] }])),
  tests: [],            // { date, score, perSection }
  deck: [],             // { word, def, example, box, due }
  missQueue: [],        // { q, choices, answer, explanation, sub, box, due }
  bank: {},             // { AR: [question, ...] }
  xp: 0,
  bestTest: 0,
  daily: freshDaily(),
  streak: { last: null, days: 0 },
  testDate: null,       // 'YYYY-MM-DD'
  notes: {},            // { AR: 'user study notes…' } — grounds generation
  targetJob: 'Not set',
  diagDone: false,      // first-run diagnostic completed/skipped
  lessons: {},          // { 'AR|topic': lessonObj } cached
})
/* merge any saved/imported object over fresh defaults so old saves never crash new code */
const hydrate = (raw) => {
  const base = emptyState()
  const st = { ...base, ...raw }
  st.stats = {}
  for (const id of Object.keys(base.stats)) {
    st.stats[id] = { ...base.stats[id], ...(raw.stats?.[id] || {}) }
    if (!Array.isArray(st.stats[id].recent)) st.stats[id].recent = []
  }
  for (const k of ['tests', 'deck', 'missQueue']) if (!Array.isArray(st[k])) st[k] = []
  for (const k of ['bank', 'notes', 'lessons']) if (!st[k] || typeof st[k] !== 'object') st[k] = {}
  if (!st.streak || typeof st.streak !== 'object') st.streak = base.streak
  // pre-diagnostic saves that already have a test shouldn't see the day-one banner
  if (raw.diagDone === undefined) st.diagDone = st.tests.length > 0
  if (!st.daily || st.daily.date !== today()) st.daily = freshDaily()
  return st
}
const looksLikeBackup = (o) =>
  !!o && typeof o === 'object' && !Array.isArray(o) &&
  !!o.stats && typeof o.stats === 'object' &&
  Object.values(o.stats).every((s) => s && Number.isFinite(s.attempted) && Number.isFinite(s.correct)) &&
  ['tests', 'deck', 'missQueue'].every((k) => o[k] === undefined || Array.isArray(o[k])) &&
  (o.xp === undefined || Number.isFinite(o.xp))
const load = () => {
  try {
    const raw = JSON.parse(
      localStorage.getItem(KEY) || localStorage.getItem('asvabforge.v1') || '{}'
    )
    return hydrate(raw && typeof raw === 'object' ? raw : {})
  } catch { return emptyState() }
}
const save = (st) => {
  try { localStorage.setItem(KEY, JSON.stringify(st)) } catch { /* quota / private mode */ }
}

/* record one scored answer: accuracy, rolling window (difficulty), pacing */
const RECENT_N = 20
const record = (st, id, right, ms) => {
  const s = st.stats[id]
  s.attempted += 1
  if (right) s.correct += 1
  s.timeMs += ms
  s.recent = [...(s.recent || []), right ? 1 : 0].slice(-RECENT_N)
}
/* adaptive difficulty from the rolling window of the last RECENT_N answers */
const levelFor = (st, id) => {
  const r = st.stats[id]?.recent || []
  if (r.length < 5) return 'moderate'
  const a = r.reduce((x, y) => x + y, 0) / r.length
  return a > 0.8 ? 'hard' : a < 0.55 ? 'foundational' : 'moderate'
}

const bumpStreak = (streak) => {
  const t = today()
  if (streak.last === t) return streak
  const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10)
  return { last: t, days: streak.last === y ? streak.days + 1 : 1 }
}

/* ---- derived: readiness, missions, rank ---- */
const acc = (st, id) => (st.stats[id].attempted ? st.stats[id].correct / st.stats[id].attempted : null)

/* null ("need data") until VE, AR and MK all have attempts — a strong WK session
   alone shouldn't read as AFQT-ready */
const readiness = (st) => {
  const ve = [acc(st, 'WK'), acc(st, 'PC')].filter((v) => v != null)
  const veAvg = ve.length ? ve.reduce((a, b) => a + b, 0) / ve.length : null
  const parts = [veAvg, veAvg, acc(st, 'AR'), acc(st, 'MK')]
  if (parts.some((v) => v == null)) return null
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100)
}

const compositeReadiness = (st, comp) => {
  const vals = comp.subs.map((id) => {
    if (id === 'VE') {
      const ve = [acc(st, 'WK'), acc(st, 'PC')].filter((v) => v != null)
      return ve.length ? ve.reduce((a, b) => a + b, 0) / ve.length : null
    }
    return acc(st, id)
  }).filter((v) => v != null)
  return vals.length === comp.subs.length
    ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100)
    : null
}

/* subtests relevant to the target job (always includes the AFQT four) */
const relevantSubs = (st) => {
  const job = TARGET_JOBS.find((j) => j.name === st.targetJob)
  if (!job || !job.comps.length) return SUBTESTS.map((s) => s.id)
  const ids = new Set(['AR', 'WK', 'PC', 'MK'])
  job.comps.forEach((cid) => COMPOSITES.find((c) => c.id === cid)?.subs.forEach((s) => {
    if (s === 'VE') { ids.add('WK'); ids.add('PC') } else ids.add(s)
  }))
  return [...ids]
}

const weakestSub = (st) => {
  const rel = new Set(relevantSubs(st))
  const rated = SUBTESTS
    .filter((s) => rel.has(s.id))
    .map((s) => ({ s, a: acc(st, s.id), n: st.stats[s.id].attempted }))
    .filter((x) => x.n >= 5)
    .sort((a, b) => a.a - b.a)
  return rated[0]?.s || SUB('AR')
}

const daysToTest = (st) => {
  if (!st.testDate) return null
  return Math.ceil((new Date(st.testDate + 'T00:00:00') - Date.now()) / 864e5)
}

const missionsFor = (st) => {
  const weak = weakestSub(st)
  const d = daysToTest(st)
  const intense = d != null && d <= 14 && d >= 0
  const dueMiss = st.missQueue.filter((m) => m.due <= Date.now()).length
  const list = [
    {
      id: 'weak',
      label: `Drill ${weak.id} (weakest): ${intense ? 20 : 10} questions`,
      progress: st.daily.counts[weak.id] || 0,
      target: intense ? 20 : 10,
    },
    {
      id: 'vocab',
      label: 'Vocab: 10 card reviews',
      progress: st.daily.vocab,
      target: 10,
    },
  ]
  const missTarget = Math.min(5, st.daily.miss + dueMiss)
  if (missTarget > 0) {
    list.push({ id: 'miss', label: `Redemption: ${missTarget} reps`, progress: st.daily.miss, target: missTarget })
  }
  return list
}

const gateMet = (st, rank) => !rank.gate ||
  (rank.gate.test != null && st.bestTest >= rank.gate.test) ||
  (rank.gate.readiness != null && (readiness(st) ?? 0) >= rank.gate.readiness)

/* ranks are sequential: a rank is held only if XP ≥ threshold AND its gate is met,
   and you can't skip past a rank whose gate is still blocking */
const currentRank = (st) => {
  let rank = RANKS[0]
  for (const cand of RANKS) {
    if (st.xp >= cand.xp && gateMet(st, cand)) rank = cand
    else break
  }
  return rank
}
const nextRank = (st) => RANKS[RANKS.indexOf(currentRank(st)) + 1] || null

/* finalize: run after every mutation — refresh daily, award mission bonus */
const finalize = (st) => {
  if (st.daily.date !== today()) st.daily = freshDaily()
  const missions = missionsFor(st)
  if (!st.daily.bonus && missions.length && missions.every((m) => m.progress >= m.target)) {
    st.daily.bonus = true
    st.xp += XP.dailyBonus
  }
  return st
}

/* ================================================================== api */
async function generate(prompt, maxTokens = 4096) {
  const r = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, max_tokens: maxTokens }),
  })
  const body = await r.json().catch(() => null)
  if (!r.ok || !body || body.error) {
    const raw = body && body.raw ? ` — model said: ${body.raw.slice(0, 200)}` : ''
    throw new Error((body && (body.detail || body.error)) ? `${body.detail || body.error}${raw}` : `HTTP ${r.status}`)
  }
  return body.data
}

const questionPrompt = (sub, n, level, notes) => `You are an ASVAB question writer. Generate ${n} multiple-choice questions for the ${sub.name} (${sub.id}) subtest of the US Armed Services Vocational Aptitude Battery.
Subtest scope: ${sub.desc}
This batch must draw from these exam-blueprint topics (distribute questions across them): ${sampleTopics(sub.id).join('; ')}.
${notes ? `Ground questions in the user's own study notes below where relevant — test the same concepts, but write original questions (never copy sentences from the notes):\n<notes>${notes.slice(0, 1500)}</notes>\n` : ''}Target difficulty: ${level}. Match the tone and style of official ASVAB practice questions. Questions must be fully self-contained text (no images or diagrams). Each has exactly 4 answer choices with exactly one correct answer, plus a concise explanation teaching the underlying concept.
Respond with RAW JSON ONLY — no markdown, no commentary. Schema:
[{"q":"question text","choices":["A","B","C","D"],"answer":0,"explanation":"why"}]
"answer" is the 0-based index of the correct choice. Vary which index is correct.`

const verifyPrompt = (qs) => `You are an answer-key auditor for ASVAB math questions. Independently solve each question below, showing no work, and report the index of the correct choice.
Respond with RAW JSON ONLY. Schema: [{"i":0,"answer":2}] where "i" is the question number given and "answer" is the 0-based index of the correct choice.
Questions:
${JSON.stringify(qs.map((q, i) => ({ i, q: q.q, choices: q.choices })))}`

const vocabPrompt = (n, known) => `Generate ${n} ASVAB Word Knowledge flashcards: mid-to-high frequency vocabulary that appears on the WK subtest. Avoid these already-studied words: ${known.slice(-200).join(', ') || 'none'}.
Respond with RAW JSON ONLY. Schema:
[{"word":"...","def":"plain-English definition","example":"short sentence using it"}]`

const lessonPrompt = (sub, topic, notes) => `You are an ASVAB tutor. Write a compact lesson on "${topic}" for the ${sub.name} (${sub.id}) subtest, for a motivated adult learner starting from scratch.
${notes ? `The learner's own notes (build on them, don't copy sentences):\n<notes>${notes.slice(0, 1500)}</notes>\n` : ''}Respond with RAW JSON ONLY. Schema:
{"title":"...","core":"2-3 short paragraphs teaching the concept plainly","steps":["step-by-step method to attack this question type, 3-5 items"],"example":{"q":"one worked ASVAB-style example question","solution":"solution walking through each step"},"trap":"the single most common mistake test-takers make here","mnemonic":"a memory hook if one exists, else empty string"}`

const sanitize = (data) => (Array.isArray(data) ? data : []).filter(
  (q) => q && typeof q.q === 'string' && q.q.trim() && Array.isArray(q.choices) && q.choices.length === 4 &&
         Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4
).map((q) => ({ q: q.q, choices: q.choices.map(String), answer: q.answer, explanation: String(q.explanation || '') }))

/* Generate + (for math subtests) verify the answer keys with a second pass.
   Questions where the auditor disagrees with the writer are dropped. */
async function getQuestions(sub, n, level, notes) {
  let qs = sanitize(await generate(questionPrompt(sub, n, level, notes)))
  if ((sub.id === 'AR' || sub.id === 'MK') && qs.length) {
    try {
      const audit = await generate(verifyPrompt(qs), 2048)
      const keyOf = new Map((Array.isArray(audit) ? audit : [])
        .filter((x) => x && Number.isInteger(Number(x.i)))
        .map((x) => [Number(x.i), Number(x.answer)]))
      qs = qs.filter((q, i) => !keyOf.has(i) || keyOf.get(i) === q.answer)
    } catch { /* audit failed: serve unaudited rather than nothing */ }
  }
  if (!qs.length) throw new Error('model returned no usable questions')
  return qs
}

/* ================================================================== shared UI */
function Bar({ pct, color = C.blaze, h = 6 }) {
  return (
    <div style={{ background: C.panel2, borderRadius: 99, height: h, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color, height: '100%', transition: 'width .4s' }} />
    </div>
  )
}
function Spinner({ text }) {
  return (
    <div style={{ ...S.card, textAlign: 'center', padding: 32 }}>
      <div style={{ fontFamily: F.mono, color: C.blaze, fontSize: 13, letterSpacing: '0.1em' }}>GENERATING…</div>
      <p style={{ color: C.khaki, fontSize: 13, marginBottom: 0 }}>{text}</p>
    </div>
  )
}
function ErrorCard({ err, onRetry }) {
  return (
    <div style={{ ...S.card, borderColor: C.red }}>
      <div style={{ ...S.label, color: C.red }}>Generation failed</div>
      <p style={{ fontSize: 13, color: C.khaki }}>{String(err)}</p>
      {onRetry && <button style={S.btn} onClick={onRetry}>Retry</button>}
    </div>
  )
}

/* Answer feedback block shared by drill + redemption */
function Feedback({ q, picked }) {
  return (
    <div style={{ marginTop: 14, padding: 12, background: C.panel2, borderRadius: 10, fontSize: 14, lineHeight: 1.5 }}>
      <span style={{ fontFamily: F.mono, fontSize: 11, color: picked === q.answer ? C.green : C.red, letterSpacing: '0.1em' }}>
        {picked === q.answer ? 'CORRECT' : `CORRECT ANSWER: ${'ABCD'[q.answer]}`}
      </span>
      <p style={{ margin: '6px 0 0', color: C.sand }}>{q.explanation}</p>
    </div>
  )
}

/* ================================================================== HOME */
function RankCard({ state }) {
  const rank = currentRank(state)
  const next = nextRank(state)
  const r = readiness(state)
  const gateText = (g) => g?.test != null ? `score ${g.test}%+ on a timed test` : g?.readiness != null ? `reach ${g.readiness} readiness (now ${r ?? '--'})` : null
  const gateOK = next ? gateMet(state, next) : true
  const blocked = next && state.xp >= next.xp && !gateOK
  const xpPct = next ? ((state.xp - rank.xp) / (next.xp - rank.xp)) * 100 : 100
  return (
    <div style={{ ...S.card, borderColor: C.blaze }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <span style={{ fontFamily: F.mono, color: C.blaze, fontSize: 13 }}>{rank.grade}</span>
          <span style={{ fontFamily: F.disp, fontWeight: 800, fontSize: 20, marginLeft: 10 }}>{rank.name.toUpperCase()}</span>
        </div>
        <span style={{ fontFamily: F.mono, fontSize: 13, color: C.khaki }}>{state.xp} XP</span>
      </div>
      {next && (
        <>
          <div style={{ marginTop: 10 }}><Bar pct={xpPct} color={C.amber} /></div>
          <p style={{ fontSize: 12, color: C.khaki, margin: '6px 0 0' }}>
            {next.grade} {next.name} at {next.xp} XP
            {next.gate && (
              <span style={{ color: gateOK ? C.green : C.amber }}>
                {' '}· gate: {gateText(next.gate)} {gateOK ? '✓' : ''}
              </span>
            )}
          </p>
          {blocked && (
            <p style={{ fontSize: 12, color: C.red, margin: '6px 0 0', fontFamily: F.mono }}>
              PROMOTION BLOCKED — XP is there; the gate isn't. {next.gate.test != null ? 'Take a timed test.' : 'Raise your AFQT subtests.'}
            </p>
          )}
        </>
      )}
      {!next && <p style={{ fontSize: 12, color: C.green, margin: '6px 0 0' }}>Top rank reached.</p>}
    </div>
  )
}

function MissionsCard({ state, go }) {
  const missions = missionsFor(state)
  const allDone = missions.every((m) => m.progress >= m.target)
  const goFor = (id) => id === 'vocab' ? go('cards') : id === 'miss' ? go('redo') : go('drill', weakestSub(state).id)
  return (
    <div style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={S.label}>Daily missions</div>
        {allDone
          ? <span style={{ fontFamily: F.mono, fontSize: 11, color: C.green }}>COMPLETE +{XP.dailyBonus} XP</span>
          : <span style={{ fontFamily: F.mono, fontSize: 11, color: C.khaki }}>+{XP.dailyBonus} XP bonus</span>}
      </div>
      {missions.map((m) => {
        const done = m.progress >= m.target
        return (
          <div key={m.id} onClick={() => !done && goFor(m.id)} style={{ marginTop: 12, cursor: done ? 'default' : 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: done ? C.green : C.sand }}>{done ? '✓ ' : ''}{m.label}</span>
              <span style={{ fontFamily: F.mono, color: C.khaki }}>{Math.min(m.progress, m.target)}/{m.target}</span>
            </div>
            <Bar pct={(m.progress / m.target) * 100} color={done ? C.green : C.blaze} />
          </div>
        )
      })}
    </div>
  )
}

function ReadinessGauge({ state }) {
  const est = readiness(state)
  const d = daysToTest(state)
  return (
    <div style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={S.label}>AFQT readiness estimate</div>
        {d != null && d >= 0 && (
          <span style={{ fontFamily: F.mono, fontSize: 11, color: d <= 14 ? C.red : C.khaki }}>
            T−{d} DAYS
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '6px 0 10px' }}>
        <span style={{ fontFamily: F.mono, fontWeight: 700, fontSize: est == null ? 28 : 52, color: est == null ? C.khaki : C.blaze, lineHeight: 1 }}>
          {est == null ? 'need data' : est}
        </span>
        <span style={{ color: C.khaki, fontSize: 12 }}>
          {est == null
            ? 'needs attempts in WK or PC, plus AR and MK — the diagnostic covers all of them'
            : 'weighted accuracy across AR · WK · PC · MK (practice signal, NOT an official AFQT score)'}
        </span>
      </div>
      <div style={{ position: 'relative', paddingTop: 14 }}>
        <Bar pct={est ?? 0} h={10} />
        {BRANCHES.map((b) => (
          <div key={b.name} style={{ position: 'absolute', left: `${b.min}%`, top: 8, transform: 'translateX(-50%)' }}>
            <div style={{ width: 2, height: 22, background: C.sand, opacity: 0.5, margin: '0 auto' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 10 }}>
        {BRANCHES.map((b) => (
          <span key={b.name} style={{ fontFamily: F.mono, fontSize: 11, color: est != null && est >= b.min ? C.green : C.khaki }}>
            {b.name} {b.min}
          </span>
        ))}
      </div>
      <p style={{ fontSize: 11, color: C.khaki, marginBottom: 0 }}>
        Branch minimums are typical HS-diploma AFQT floors — confirm current numbers with your recruiter.
      </p>
    </div>
  )
}

function LineScoreCard({ state }) {
  const job = TARGET_JOBS.find((j) => j.name === state.targetJob)
  const show = job && job.comps.length
    ? COMPOSITES.filter((c) => job.comps.includes(c.id))
    : COMPOSITES.slice(0, 3)
  return (
    <div style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={S.label}>Line scores {job?.comps.length ? `· ${job.name}` : ''}</div>
        <span style={{ fontFamily: F.mono, fontSize: 11, color: C.khaki }}>gate the job</span>
      </div>
      {show.map((c) => {
        const r = compositeReadiness(state, c)
        return (
          <div key={c.id} style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span>
                <span style={{ fontFamily: F.mono, color: C.amber, marginRight: 8 }}>{c.id}</span>
                {c.name}
                <span style={{ color: C.khaki, fontSize: 11, marginLeft: 8 }}>{c.subs.join('+')}</span>
              </span>
              <span style={{ fontFamily: F.mono, color: r == null ? C.khaki : C.sand }}>{r == null ? 'need data' : r}</span>
            </div>
            <Bar pct={r ?? 0} color={C.amber} />
            <p style={{ fontSize: 11, color: C.khaki, margin: '4px 0 0' }}>{c.note}</p>
          </div>
        )
      })}
      <p style={{ fontSize: 11, color: C.khaki, marginBottom: 0 }}>
        AFQT gets you in; composites get you the job. Set a target job in Settings so missions target the right subtests. Composite formulas are approximations — verify with your recruiter.
      </p>
    </div>
  )
}

function PaceCard({ state }) {
  const rows = SUBTESTS
    .map((s) => ({ s, st: state.stats[s.id] }))
    .filter((x) => x.st.attempted >= 5 && x.st.timeMs > 0)
  if (!rows.length) return null
  return (
    <div style={S.card}>
      <div style={S.label}>Pace vs budget</div>
      {rows.map(({ s, st }) => {
        const avg = st.timeMs / st.attempted / 1000
        const over = avg > s.secs
        return (
          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 8 }}>
            <span><span style={{ fontFamily: F.mono, color: C.khaki, marginRight: 8 }}>{s.id}</span>avg {Math.round(avg)}s / {s.secs}s budget</span>
            <span style={{ fontFamily: F.mono, color: over ? C.red : C.green }}>{over ? 'OVER' : 'ON PACE'}</span>
          </div>
        )
      })}
      <p style={{ fontSize: 11, color: C.khaki, marginBottom: 0 }}>
        The ASVAB punishes bad pacing more than bad knowledge. OVER means you know it but too slowly — drill that subtest for speed.
      </p>
    </div>
  )
}

function SettingsCard({ state, setState }) {
  const fileRef = useRef(null)
  const [notesSub, setNotesSub] = useState('AR')
  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `asvab-forge-backup-${today()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const importData = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result)
        if (!looksLikeBackup(parsed)) throw new Error('this is not an ASVAB Forge backup file')
        setState(() => hydrate(parsed))
      } catch (err) { alert(`Import failed: ${err.message}`) }
    }
    reader.readAsText(file)
    e.target.value = ''
  }
  return (
    <div style={{ ...S.card, marginBottom: 20 }}>
      <div style={S.label}>Settings</div>
      <div style={{ marginTop: 12, fontSize: 13 }}>
        <label style={{ color: C.khaki }}>Test date (drives mission intensity)</label>
        <input
          type="date"
          value={state.testDate || ''}
          onChange={(e) => setState((st) => ({ ...st, testDate: e.target.value || null }))}
          style={{
            display: 'block', width: '100%', marginTop: 6, padding: '10px 12px',
            background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10,
            color: C.sand, fontFamily: F.mono, fontSize: 14, colorScheme: 'dark',
          }}
        />
      </div>
      <div style={{ marginTop: 14, fontSize: 13 }}>
        <label style={{ color: C.khaki }}>Target job (focuses missions on the composites that matter)</label>
        <select
          value={state.targetJob || 'Not set'}
          onChange={(e) => setState((st) => ({ ...st, targetJob: e.target.value }))}
          style={{
            display: 'block', width: '100%', marginTop: 6, padding: '10px 12px',
            background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10,
            color: C.sand, fontFamily: F.mono, fontSize: 13,
          }}
        >
          {TARGET_JOBS.map((j) => <option key={j.name} value={j.name}>{j.name}</option>)}
        </select>
      </div>
      <div style={{ marginTop: 14, fontSize: 13 }}>
        <label style={{ color: C.khaki }}>Study notes (grounds question generation — paste your own notes from books you own)</label>
        <select
          value={notesSub}
          onChange={(e) => setNotesSub(e.target.value)}
          style={{
            display: 'block', width: '100%', marginTop: 6, padding: '10px 12px',
            background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10,
            color: C.sand, fontFamily: F.mono, fontSize: 13,
          }}
        >
          {SUBTESTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id} — {s.name}{state.notes?.[s.id] ? ' ✓' : ''}
            </option>
          ))}
        </select>
        <textarea
          value={state.notes?.[notesSub] || ''}
          onChange={(e) => setState((st) => ({ ...st, notes: { ...st.notes, [notesSub]: e.target.value } }))}
          placeholder="e.g. formulas, mnemonics, topic summaries in your own words…"
          rows={4}
          style={{
            display: 'block', width: '100%', marginTop: 6, padding: '10px 12px',
            background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10,
            color: C.sand, fontFamily: F.body, fontSize: 13, resize: 'vertical',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button style={S.btnGhost} onClick={exportData}>Export backup</button>
        <button style={S.btnGhost} onClick={() => fileRef.current?.click()}>Import backup</button>
        <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={importData} />
      </div>
      <p style={{ fontSize: 11, color: C.khaki, marginBottom: 0 }}>
        Progress lives in this browser only — export a backup before clearing data or switching devices.
      </p>
    </div>
  )
}

function Home({ state, setState, go }) {
  const dueMiss = state.missQueue.filter((m) => m.due <= Date.now()).length
  const dueCards = state.deck.filter((c) => c.due <= Date.now()).length
  const banked = Object.values(state.bank).reduce((a, b) => a + (b?.length || 0), 0)
  return (
    <div>
      <h1 style={S.h1}>ASVAB Forge</h1>
      <p style={S.sub}>
        {state.streak.days > 0
          ? <>day <span style={{ fontFamily: F.mono, color: C.blaze }}>{state.streak.days}</span> streak
            {banked > 0 && <> · <span style={{ fontFamily: F.mono }}>{banked}</span> questions cached offline</>}</>
          : 'first rep of the day starts your streak'}
      </p>

      {!state.diagDone && (
        <div style={{ ...S.card, borderColor: C.amber, background: 'rgba(210,162,76,0.06)' }}>
          <div style={{ ...S.label, color: C.amber }}>Day one · start here</div>
          <p style={{ margin: '6px 0 10px', fontSize: 14, lineHeight: 1.5 }}>
            Take one diagnostic mini-AFQT <strong>before</strong> you study anything. It seeds your readiness score, finds your weakest subtest, and calibrates every mission that follows.
          </p>
          <button style={S.btn} onClick={() => go('test')}>Take the diagnostic (~25 min)</button>
          <button style={{ ...S.btnGhost, marginTop: 8, textAlign: 'center' }}
            onClick={() => setState((st) => ({ ...st, diagDone: true }))}>
            Skip — I already know my baseline
          </button>
        </div>
      )}
      <RankCard state={state} />
      <MissionsCard state={state} go={go} />
      <ReadinessGauge state={state} />
      <LineScoreCard state={state} />

      {dueMiss > 0 && (
        <div style={{ ...S.card, borderColor: C.amber }}>
          <div style={{ ...S.label, color: C.amber }}>Redemption queue</div>
          <p style={{ margin: '6px 0 10px', fontSize: 14 }}>
            <strong>{dueMiss}</strong> previously missed question{dueMiss > 1 ? 's' : ''} due for another shot. This is your highest-value studying.
          </p>
          <button style={S.btn} onClick={() => go('redo')}>Start redemption reps</button>
        </div>
      )}

      <div style={S.card}>
        <div style={S.label}>Subtest accuracy</div>
        {SUBTESTS.map((s) => {
          const st = state.stats[s.id]
          const pct = st.attempted ? Math.round((st.correct / st.attempted) * 100) : null
          return (
            <div key={s.id} onClick={() => go('drill', s.id)} style={{ marginTop: 12, cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span>
                  <span style={{ fontFamily: F.mono, color: s.afqt ? C.blaze : C.khaki, marginRight: 8 }}>{s.id}</span>
                  {s.name}
                </span>
                <span style={{ fontFamily: F.mono, color: C.khaki }}>
                  {pct == null ? '—' : `${pct}% · ${st.attempted}q`}
                </span>
              </div>
              <Bar pct={pct ?? 0} color={s.afqt ? C.blaze : C.olive} />
            </div>
          )
        })}
        <p style={{ fontSize: 11, color: C.khaki, marginBottom: 0 }}>
          Orange = AFQT subtests (these gate enlistment). Assembling Objects is diagram-based and not covered here — use paper practice for it.
        </p>
      </div>

      <PaceCard state={state} />

      <div style={S.card}>
        <div style={S.label}>Quick actions</div>
        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
          <button style={S.btnGhost} onClick={() => go('learn')}>📖 Concept lessons (learn before you drill)</button>
          <button style={S.btnGhost} onClick={() => go('test')}>⏱ Timed mini-AFQT (4 sections)</button>
          <button style={S.btnGhost} onClick={() => go('cards')}>
            🗂 Vocab flashcards {dueCards > 0 && <span style={{ color: C.blaze, fontFamily: F.mono }}>· {dueCards} due</span>}
          </button>
        </div>
      </div>

      {state.tests.length > 0 && (
        <div style={S.card}>
          <div style={S.label}>Test history · best {state.bestTest}%</div>
          {state.tests.slice(-5).reverse().map((t, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 8 }}>
              <span style={{ color: C.khaki }}>{t.date}</span>
              <span style={{ fontFamily: F.mono, color: C.blaze }}>{t.score}%</span>
            </div>
          ))}
        </div>
      )}

      <SettingsCard state={state} setState={setState} />
      <div style={{ height: 8 }} />
    </div>
  )
}

/* ================================================================== DRILL */
function Drill({ state, setState, initialSub, goHome, goLearn }) {
  const [sub, setSub] = useState(initialSub ? SUB(initialSub) : null)
  const [qs, setQs] = useState(null)
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState(null)
  const [session, setSession] = useState({ right: 0, total: 0 })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)
  const [fromBank, setFromBank] = useState(false)
  const qStart = useRef(Date.now())
  const refilling = useRef(false)

  useEffect(() => { qStart.current = Date.now() }, [i, qs])

  // recomputed every batch from the rolling window, so difficulty tracks you mid-session
  const level = sub ? levelFor(state, sub.id) : 'moderate'

  /* background top-up of the offline bank — fire and forget */
  const refill = (s) => {
    if (refilling.current || !navigator.onLine) return
    refilling.current = true
    getQuestions(s, BANK_BATCH, level, state.notes?.[s.id])
      .then((fresh) => setState((st) => {
        const next = structuredClone(st)
        next.bank[s.id] = [...(next.bank[s.id] || []), ...fresh].slice(0, 30)
        return next
      }))
      .catch(() => {})
      .finally(() => { refilling.current = false })
  }

  const fetchBatch = async (s) => {
    setErr(null)
    const cached = state.bank[s.id] || []
    // full batch from the bank, or whatever is left when offline
    if (cached.length >= 5 || (!navigator.onLine && cached.length > 0)) {
      const take = Math.min(5, cached.length)
      setQs(cached.slice(0, take)); setI(0); setPicked(null); setFromBank(true)
      setState((st) => {
        const next = structuredClone(st)
        next.bank[s.id] = (next.bank[s.id] || []).slice(take)
        return next
      })
      if (cached.length - take < BANK_MIN) refill(s)
      return
    }
    if (!navigator.onLine) {
      setErr(new Error('You are offline and this subtest has no cached questions yet. Reconnect once to build the bank.'))
      return
    }
    setLoading(true)
    try {
      const fresh = await getQuestions(s, 5, level, state.notes?.[s.id])
      setQs(fresh); setI(0); setPicked(null); setFromBank(false)
      refill(s)
    } catch (e) { setErr(e) } finally { setLoading(false) }
  }

  useEffect(() => { if (sub && !qs && !loading && !err) fetchBatch(sub) }, [sub]) // eslint-disable-line

  if (!sub) return (
    <div>
      <h1 style={S.h1}>Drill</h1>
      <p style={S.sub}>Pick a subtest. Difficulty adapts to your accuracy; misses join the redemption queue.</p>
      <div style={{ display: 'grid', gap: 8, marginTop: 14, paddingBottom: 24 }}>
        {SUBTESTS.map((s) => {
          const bankN = (state.bank[s.id] || []).length
          return (
            <button key={s.id} style={S.btnGhost} onClick={() => setSub(s)}>
              <span style={{ fontFamily: F.mono, color: s.afqt ? C.blaze : C.khaki, marginRight: 10 }}>{s.id}</span>
              {s.name}
              {bankN > 0 && <span style={{ float: 'right', fontFamily: F.mono, fontSize: 11, color: C.olive }}>{bankN} cached</span>}
              <div style={{ fontSize: 12, color: C.khaki, marginTop: 3 }}>{s.desc}</div>
            </button>
          )
        })}
      </div>
    </div>
  )

  if (loading) return <Spinner text={`Writing ${level} ${sub.id} questions${sub.id === 'AR' || sub.id === 'MK' ? ' + auditing answer keys' : ''}…`} />
  if (err) return <ErrorCard err={err.message} onRetry={() => fetchBatch(sub)} />
  if (!qs) return null

  const q = qs[i]
  const answered = picked != null

  const pick = (idx) => {
    if (answered) return
    const elapsed = Date.now() - qStart.current
    setPicked(idx)
    const right = idx === q.answer
    setSession((s) => ({ right: s.right + (right ? 1 : 0), total: s.total + 1 }))
    setState((st) => {
      const next = structuredClone(st)
      record(next, sub.id, right, elapsed)
      if (right) {
        next.xp += XP.drillRight
      } else {
        next.xp += XP.drillWrong
        next.missQueue.push({ ...q, sub: sub.id, box: 1, due: Date.now() + 864e5 })
      }
      next.daily.counts[sub.id] = (next.daily.counts[sub.id] || 0) + 1
      next.streak = bumpStreak(next.streak)
      return finalize(next)
    })
  }

  const next = () => {
    if (i + 1 < qs.length) { setI(i + 1); setPicked(null) }
    else { setQs(null); fetchBatch(sub) }
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={S.h1}>{sub.id} · {level}</h1>
        <span style={{ fontFamily: F.mono, fontSize: 13, color: C.khaki }}>
          {session.right}/{session.total}{fromBank ? ' · offline bank' : ''}
        </span>
      </div>
      <div style={S.card}>
        <div style={S.label}>Question {i + 1} of {qs.length}</div>
        <p style={{ fontSize: 16, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{q.q}</p>
        {q.choices.map((c, idx) => {
          let st = 'idle'
          if (answered && idx === q.answer) st = 'correct'
          else if (answered && idx === picked) st = 'wrong'
          return (
            <button key={idx} style={S.choice(st)} onClick={() => pick(idx)}>
              <span style={{ fontFamily: F.mono, color: C.khaki, marginRight: 10 }}>{'ABCD'[idx]}</span>{c}
            </button>
          )
        })}
        {answered && <Feedback q={q} picked={picked} />}
        {answered && picked !== q.answer && (
          <p style={{ fontSize: 11, color: C.amber, marginBottom: 0 }}>
            Added to your redemption queue — it comes back tomorrow.
            {' '}<span style={{ color: C.blaze, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => goLearn(sub.id)}>Teach me {sub.id} concepts →</span>
          </p>
        )}
      </div>
      {answered && <button style={{ ...S.btn, marginTop: 12 }} onClick={next}>
        {i + 1 < qs.length ? 'Next question' : 'New batch'}
      </button>}
      <button style={{ ...S.btnGhost, marginTop: 8, textAlign: 'center' }} onClick={goHome}>End session</button>
    </div>
  )
}

/* ================================================================== REDEMPTION */
function Redemption({ state, setState, goHome }) {
  const [picked, setPicked] = useState(null)
  const [lastResult, setLastResult] = useState(null) // 'mastered' | null
  // the answered item leaves `due` as soon as it is rescheduled — pin it so its feedback stays on screen
  const [cur, setCur] = useState(null)
  const qStart = useRef(Date.now())

  const due = state.missQueue.filter((m) => m.due <= Date.now())
  const q = cur || due[0]

  useEffect(() => { qStart.current = Date.now() }, [q?.q])

  const pick = (idx) => {
    if (picked != null || !q) return
    const elapsed = Date.now() - qStart.current
    setPicked(idx)
    setCur(q)
    const right = idx === q.answer
    setLastResult(right && q.box >= 3 ? 'mastered' : null)
    setState((st) => {
      const next = structuredClone(st)
      const at = next.missQueue.findIndex((m) => m.q === q.q && m.sub === q.sub)
      if (at >= 0) {
        const item = next.missQueue[at]
        if (right) {
          item.box += 1
          if (item.box > 3) {
            next.missQueue.splice(at, 1)          // mastered — out of the queue
            next.xp += XP.missMastered
          } else {
            item.due = Date.now() + BOX_INTERVALS[item.box] * 864e5
            next.xp += XP.missRep
          }
        } else {
          item.box = 1
          item.due = Date.now() + 864e5
        }
      }
      record(next, q.sub, right, elapsed)
      next.daily.miss += 1
      next.streak = bumpStreak(next.streak)
      return finalize(next)
    })
  }

  if (!q && picked == null) return (
    <div style={{ paddingBottom: 24 }}>
      <h1 style={S.h1}>Redemption</h1>
      <div style={{ ...S.card, textAlign: 'center' }}>
        <p style={{ fontSize: 14 }}>
          {state.missQueue.length
            ? `Queue is clear for now. ${state.missQueue.length} question${state.missQueue.length > 1 ? 's' : ''} scheduled for later.`
            : 'No missed questions banked yet. Go drill — every miss lands here for spaced re-attack.'}
        </p>
      </div>
      <button style={{ ...S.btn, marginTop: 14 }} onClick={goHome}>Back to dashboard</button>
    </div>
  )

  const answered = picked != null

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={S.h1}>Redemption</h1>
        <span style={{ fontFamily: F.mono, fontSize: 13, color: C.amber }}>{due.length} due</span>
      </div>
      <p style={S.sub}>You missed this once. Three clean reps and it's mastered.</p>
      {q && (
        <div style={{ ...S.card, borderColor: C.amber }}>
          <div style={S.label}>
            <span style={{ color: C.blaze }}>{q.sub}</span> · box {q.box} of 3
          </div>
          <p style={{ fontSize: 16, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{q.q}</p>
          {q.choices.map((c, idx) => {
            let st = 'idle'
            if (answered && idx === q.answer) st = 'correct'
            else if (answered && idx === picked) st = 'wrong'
            return (
              <button key={idx} style={S.choice(st)} onClick={() => pick(idx)}>
                <span style={{ fontFamily: F.mono, color: C.khaki, marginRight: 10 }}>{'ABCD'[idx]}</span>{c}
              </button>
            )
          })}
          {answered && <Feedback q={q} picked={picked} />}
          {lastResult === 'mastered' && (
            <p style={{ fontSize: 12, color: C.green, marginBottom: 0, fontFamily: F.mono }}>
              MASTERED +{XP.missMastered} XP — removed from the queue.
            </p>
          )}
        </div>
      )}
      {answered && (
        <button style={{ ...S.btn, marginTop: 12 }} onClick={() => { setPicked(null); setLastResult(null); setCur(null) }}>
          {due.length > 0 ? 'Next rep' : 'Finish'}
        </button>
      )}
      <button style={{ ...S.btnGhost, marginTop: 8, textAlign: 'center' }} onClick={goHome}>End session</button>
    </div>
  )
}

/* ================================================================== TEST */
const TEST_PLAN = ['AR', 'WK', 'PC', 'MK'].map((id) => {
  const s = SUB(id)
  const n = id === 'PC' ? 5 : 8
  return { ...s, n, limit: n * s.secs }
})

function TimedTest({ state, setState, goHome }) {
  const [phase, setPhase] = useState('intro')
  const [secIdx, setSecIdx] = useState(0)
  const [qs, setQs] = useState([])
  const [i, setI] = useState(0)
  const [left, setLeft] = useState(0)
  const [answers, setAnswers] = useState([])   // per finished section { id, right, total, log }
  const [log, setLog] = useState([])           // current section: [{ right, ms }]
  const [err, setErr] = useState(null)
  const [final, setFinal] = useState(null)     // { score, xp }
  const timer = useRef(null)
  const qStart = useRef(Date.now())
  const stateRef = useRef(state)
  stateRef.current = state

  const sec = TEST_PLAN[secIdx]

  /* fresh questions first; top up (or, offline, fill entirely) from the bank */
  const startSection = async (idx) => {
    const s = TEST_PLAN[idx]
    setSecIdx(idx); setPhase('loading'); setErr(null)
    try {
      let clean = []
      if (navigator.onLine) {
        try { clean = (await getQuestions(s, s.n, 'moderate, exam-realistic', stateRef.current.notes?.[s.id])).slice(0, s.n) }
        catch (e) { if (!(stateRef.current.bank[s.id] || []).length) throw e }
      }
      const need = s.n - clean.length
      if (need > 0) {
        const fromBank = (stateRef.current.bank[s.id] || []).slice(0, need)
        if (fromBank.length) {
          clean = [...clean, ...fromBank]
          setState((st) => {
            const next = structuredClone(st)
            next.bank[s.id] = (next.bank[s.id] || []).slice(fromBank.length)
            return next
          })
        }
      }
      if (!clean.length) throw new Error(navigator.onLine ? 'no usable questions' : `You are offline and there are no cached ${s.id} questions.`)
      setQs(clean); setI(0); setLog([]); setLeft(clean.length * s.secs); setPhase('run')
      qStart.current = Date.now()
    } catch (e) { setErr(e); setPhase('intro') }
  }

  const begin = () => { setAnswers([]); setFinal(null); startSection(0) }

  useEffect(() => {
    if (phase !== 'run') return
    timer.current = setInterval(() => setLeft((l) => l - 1), 1000)
    return () => clearInterval(timer.current)
  }, [phase, secIdx])

  /* section ends by last answer or by the clock; unanswered questions score as wrong */
  const finishSection = (sectionLog) => {
    clearInterval(timer.current)
    const right = sectionLog.filter((x) => x.right).length
    const nextAnswers = [...answers, { id: sec.id, right, total: qs.length, log: sectionLog }]
    setAnswers(nextAnswers)
    if (secIdx + 1 < TEST_PLAN.length) {
      startSection(secIdx + 1)
      return
    }
    const r = nextAnswers.reduce((a, s) => a + s.right, 0)
    const t = nextAnswers.reduce((a, s) => a + s.total, 0)
    const score = Math.round((r / t) * 100)
    const xp = XP.testDone + r * XP.testRight
    setState((st) => {
      const next = structuredClone(st)
      nextAnswers.forEach((sc) => sc.log.forEach((x) => record(next, sc.id, x.right, x.ms)))
      next.tests.push({ date: today(), score, perSection: nextAnswers.map(({ id, right, total }) => ({ id, right, total })) })
      next.bestTest = Math.max(next.bestTest, score)
      next.diagDone = true
      next.xp += xp
      next.streak = bumpStreak(next.streak)
      return finalize(next)
    })
    setFinal({ score, xp })
    setPhase('done')
  }

  useEffect(() => {
    if (phase === 'run' && left <= 0) finishSection(log)
  }, [left]) // eslint-disable-line

  if (phase === 'intro') return (
    <div style={{ paddingBottom: 24 }}>
      <h1 style={S.h1}>Timed mini-AFQT</h1>
      <p style={S.sub}>Four sections under CAT-style pacing. No pausing — like the real thing. Unanswered questions count as wrong. Rank gates run through this.</p>
      {err && <ErrorCard err={err.message} onRetry={() => (answers.length ? startSection(secIdx) : begin())} />}
      {err && answers.length > 0 && (
        <p style={{ fontSize: 12, color: C.khaki }}>Retry resumes at the {sec.id} section — your finished sections are kept.</p>
      )}
      <div style={S.card}>
        {TEST_PLAN.map((s) => (
          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginTop: 8 }}>
            <span><span style={{ fontFamily: F.mono, color: C.blaze, marginRight: 8 }}>{s.id}</span>{s.name}</span>
            <span style={{ fontFamily: F.mono, color: C.khaki, fontSize: 12 }}>{s.n}q · {Math.round(s.limit / 60)}min</span>
          </div>
        ))}
      </div>
      <button style={{ ...S.btn, marginTop: 14 }} onClick={begin}>{answers.length ? 'Restart test from AR' : 'Start test'}</button>
      <button style={{ ...S.btnGhost, marginTop: 8, textAlign: 'center' }} onClick={goHome}>Back</button>
    </div>
  )

  if (phase === 'loading') return <Spinner text={`Building the ${sec.id} section…${sec.id === 'AR' || sec.id === 'MK' ? ' (auditing answer keys)' : ''}`} />

  if (phase === 'done') return (
    <div style={{ paddingBottom: 24 }}>
      <h1 style={S.h1}>Test complete</h1>
      <div style={{ ...S.card, textAlign: 'center' }}>
        <div style={{ fontFamily: F.mono, fontSize: 56, fontWeight: 700, color: C.blaze }}>
          {final.score}<span style={{ fontSize: 20, color: C.khaki }}>%</span>
        </div>
        {answers.map((s) => (
          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginTop: 8 }}>
            <span style={{ fontFamily: F.mono, color: C.khaki }}>{s.id}</span>
            <span style={{ fontFamily: F.mono }}>{s.right}/{s.total}{s.log.length < s.total ? ` · ${s.total - s.log.length} unanswered` : ''}</span>
          </div>
        ))}
        <p style={{ fontSize: 12, color: C.khaki, marginBottom: 0 }}>
          +{final.xp} XP earned · misses are in your redemption queue
        </p>
      </div>
      <button style={{ ...S.btn, marginTop: 14 }} onClick={goHome}>Back to dashboard</button>
    </div>
  )

  const q = qs[i]
  const answer = (idx) => {
    const ms = Date.now() - qStart.current
    qStart.current = Date.now()
    const right = idx === q.answer
    if (!right) {
      setState((st) => {
        const next = structuredClone(st)
        next.missQueue.push({ ...q, sub: sec.id, box: 1, due: Date.now() + 864e5 })
        return next
      })
    }
    const nextLog = [...log, { right, ms }]
    if (i + 1 < qs.length) { setLog(nextLog); setI(i + 1) }
    else finishSection(nextLog)
  }
  const mm = String(Math.max(0, Math.floor(left / 60))).padStart(2, '0')
  const ss = String(Math.max(0, left % 60)).padStart(2, '0')

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={S.h1}>{sec.id} · {i + 1}/{qs.length}</h1>
        <span style={{ fontFamily: F.mono, fontSize: 22, color: left < 30 ? C.red : C.blaze }}>{mm}:{ss}</span>
      </div>
      <Bar pct={(i / qs.length) * 100} />
      <div style={S.card}>
        <p style={{ fontSize: 16, lineHeight: 1.5, whiteSpace: 'pre-wrap', marginTop: 0 }}>{q.q}</p>
        {q.choices.map((c, idx) => (
          <button key={idx} style={S.choice('idle')} onClick={() => answer(idx)}>
            <span style={{ fontFamily: F.mono, color: C.khaki, marginRight: 10 }}>{'ABCD'[idx]}</span>{c}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ================================================================== LEARN */
function Learn({ state, setState, goHome, initialSub }) {
  const [sub, setSub] = useState(initialSub ? SUB(initialSub) : null)
  const [topic, setTopic] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const key = sub && topic ? `${sub.id}|${topic}` : null
  const lesson = key ? state.lessons?.[key] : null

  const fetchLesson = async (s, t) => {
    setLoading(true); setErr(null)
    try {
      const data = await generate(lessonPrompt(s, t, state.notes?.[s.id]), 3000)
      if (!data || !data.core) throw new Error('model returned no lesson body')
      setState((st) => ({ ...st, lessons: { ...st.lessons, [`${s.id}|${t}`]: data } }))
    } catch (e) { setErr(e) } finally { setLoading(false) }
  }

  const openTopic = (t) => {
    setTopic(t)
    if (!state.lessons?.[`${sub.id}|${t}`]) fetchLesson(sub, t)
  }

  if (!sub) return (
    <div style={{ paddingBottom: 24 }}>
      <h1 style={S.h1}>Learn</h1>
      <p style={S.sub}>Concept lessons before you drill. Pick a subtest, then a topic from the exam blueprint.</p>
      <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
        {SUBTESTS.map((s) => {
          const done = (BLUEPRINT[s.id] || []).filter(([t]) => state.lessons?.[`${s.id}|${t}`]).length
          return (
            <button key={s.id} style={S.btnGhost} onClick={() => setSub(s)}>
              <span style={{ fontFamily: F.mono, color: s.afqt ? C.blaze : C.khaki, marginRight: 10 }}>{s.id}</span>
              {s.name}
              <span style={{ float: 'right', fontFamily: F.mono, fontSize: 11, color: C.olive }}>
                {done}/{(BLUEPRINT[s.id] || []).length} read
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )

  if (!topic) return (
    <div style={{ paddingBottom: 24 }}>
      <h1 style={S.h1}>{sub.id} topics</h1>
      <p style={S.sub}>Weighted by how much the real test leans on each. Start with the heavy ones.</p>
      <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
        {[...(BLUEPRINT[sub.id] || [])].sort((a, b) => b[1] - a[1]).map(([t, w]) => {
          const read = !!state.lessons?.[`${sub.id}|${t}`]
          return (
            <button key={t} style={S.btnGhost} onClick={() => openTopic(t)}>
              <span style={{ color: read ? C.green : C.sand }}>{read ? '✓ ' : ''}{t}</span>
              <span style={{ float: 'right', fontFamily: F.mono, fontSize: 11, color: C.khaki }}>
                {'●'.repeat(w)}{'○'.repeat(4 - w)}
              </span>
            </button>
          )
        })}
      </div>
      <button style={{ ...S.btnGhost, marginTop: 12, textAlign: 'center' }} onClick={() => setSub(null)}>Back</button>
    </div>
  )

  if (loading) return <Spinner text={`Writing a lesson on ${topic}…`} />
  if (err) return <ErrorCard err={err.message} onRetry={() => fetchLesson(sub, topic)} />
  if (!lesson) return null

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={S.label}>{sub.id} · lesson</div>
      <h1 style={{ ...S.h1, marginTop: 4 }}>{lesson.title || topic}</h1>
      <div style={S.card}>
        <p style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>{lesson.core}</p>
      </div>
      {Array.isArray(lesson.steps) && lesson.steps.length > 0 && (
        <div style={S.card}>
          <div style={S.label}>Method</div>
          {lesson.steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.5, marginTop: 8 }}>
              <span style={{ fontFamily: F.mono, color: C.blaze }}>{i + 1}</span><span>{s}</span>
            </div>
          ))}
        </div>
      )}
      {lesson.example?.q && (
        <div style={S.card}>
          <div style={S.label}>Worked example</div>
          <p style={{ fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{lesson.example.q}</p>
          <div style={{ padding: 12, background: C.panel2, borderRadius: 10, fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
            {lesson.example.solution}
          </div>
        </div>
      )}
      {lesson.trap && (
        <div style={{ ...S.card, borderColor: C.red }}>
          <div style={{ ...S.label, color: C.red }}>Common trap</div>
          <p style={{ fontSize: 14, lineHeight: 1.5, margin: '6px 0 0' }}>{lesson.trap}</p>
        </div>
      )}
      {lesson.mnemonic && (
        <div style={{ ...S.card, borderColor: C.amber }}>
          <div style={{ ...S.label, color: C.amber }}>Memory hook</div>
          <p style={{ fontSize: 14, lineHeight: 1.5, margin: '6px 0 0' }}>{lesson.mnemonic}</p>
        </div>
      )}
      <button style={{ ...S.btn, marginTop: 14 }} onClick={() => fetchLesson(sub, topic)}>Regenerate lesson</button>
      <button style={{ ...S.btnGhost, marginTop: 8, textAlign: 'center' }} onClick={() => setTopic(null)}>More {sub.id} topics</button>
      <button style={{ ...S.btnGhost, marginTop: 8, textAlign: 'center' }} onClick={goHome}>Home</button>
    </div>
  )
}

/* ================================================================== CARDS */
function Cards({ state, setState, goHome }) {
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const due = state.deck.filter((c) => c.due <= Date.now())
  const card = due[0]

  const addCards = async () => {
    setLoading(true); setErr(null)
    try {
      const data = await generate(vocabPrompt(15, state.deck.map((c) => c.word)))
      const fresh = (Array.isArray(data) ? data : [])
        .filter((c) => c && c.word && c.def)
        .map((c) => ({ ...c, box: 1, due: Date.now() }))
      setState((st) => {
        const next = structuredClone(st)
        const have = new Set(next.deck.map((c) => c.word.toLowerCase()))
        next.deck.push(...fresh.filter((c) => !have.has(c.word.toLowerCase())))
        return next
      })
    } catch (e) { setErr(e) } finally { setLoading(false) }
  }

  const grade = (knew) => {
    setState((st) => {
      const next = structuredClone(st)
      const idx = next.deck.findIndex((c) => c.word === card.word)
      if (idx >= 0) {
        const c = next.deck[idx]
        c.box = knew ? Math.min(3, c.box + 1) : 1
        c.due = Date.now() + BOX_INTERVALS[c.box] * 864e5
      }
      if (knew) next.xp += XP.vocabKnew
      next.daily.vocab += 1
      next.streak = bumpStreak(next.streak)
      return finalize(next)
    })
    setFlipped(false)
  }

  if (loading) return <Spinner text="Sourcing new WK vocabulary…" />

  return (
    <div style={{ paddingBottom: 24 }}>
      <h1 style={S.h1}>Vocab flashcards</h1>
      <p style={S.sub}>
        {state.deck.length} words in deck · <span style={{ fontFamily: F.mono, color: C.blaze }}>{due.length}</span> due now
      </p>
      {err && <ErrorCard err={err.message} onRetry={addCards} />}
      {card ? (
        <>
          <div
            style={{ ...S.card, minHeight: 200, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center', cursor: 'pointer' }}
            onClick={() => setFlipped((f) => !f)}
          >
            {!flipped ? (
              <>
                <div style={{ fontFamily: F.disp, fontWeight: 800, fontSize: 32 }}>{card.word}</div>
                <p style={{ color: C.khaki, fontSize: 12 }}>tap to reveal</p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 16, lineHeight: 1.5 }}>{card.def}</p>
                {card.example && <p style={{ color: C.khaki, fontSize: 13, fontStyle: 'italic' }}>&ldquo;{card.example}&rdquo;</p>}
                <span style={{ fontFamily: F.mono, fontSize: 11, color: C.khaki }}>box {card.box} · knew it → longer interval</span>
              </>
            )}
          </div>
          {flipped && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button style={{ ...S.btn, background: C.red, color: C.sand }} onClick={() => grade(false)}>Missed it</button>
              <button style={{ ...S.btn, background: C.green, color: '#16120C' }} onClick={() => grade(true)}>Knew it</button>
            </div>
          )}
        </>
      ) : (
        <div style={{ ...S.card, textAlign: 'center' }}>
          <p style={{ fontSize: 14 }}>
            {state.deck.length ? 'All caught up. Nothing due right now.' : 'Deck is empty. Generate your first batch.'}
          </p>
        </div>
      )}
      <button style={{ ...S.btnGhost, marginTop: 12, textAlign: 'center' }} onClick={addCards}>+ Generate 15 new words</button>
      <button style={{ ...S.btnGhost, marginTop: 8, textAlign: 'center' }} onClick={goHome}>Back</button>
    </div>
  )
}

/* ================================================================== APP */
export default function App() {
  const [state, setStateRaw] = useState(load)
  const [view, setView] = useState('home')
  const [drillSub, setDrillSub] = useState(null)
  const [nav, setNav] = useState(0) // bumps on every tab tap so re-tapping a tab resets it

  const setState = (fn) => setStateRaw((prev) => {
    const next = typeof fn === 'function' ? fn(prev) : fn
    save(next)
    return next
  })

  const go = (v, sub = null) => { setDrillSub(sub); setView(v); setNav((n) => n + 1); window.scrollTo(0, 0) }

  // the app may stay open past midnight: roll daily missions over on navigation / focus
  useEffect(() => {
    const roll = () => setState((st) => (st.daily.date === today() ? st : finalize(structuredClone(st))))
    roll()
    window.addEventListener('focus', roll)
    return () => window.removeEventListener('focus', roll)
  }, [view]) // eslint-disable-line

  const k = `${drillSub || 'pick'}-${nav}`
  return (
    <div style={S.app}>
      <div style={S.wrap}>
        {view === 'home' && <Home state={state} setState={setState} go={go} />}
        {view === 'drill' && (
          <Drill key={k} state={state} setState={setState}
            initialSub={drillSub} goHome={() => go('home')} goLearn={(id) => go('learn', id)} />
        )}
        {view === 'learn' && <Learn key={k} state={state} setState={setState} initialSub={drillSub} goHome={() => go('home')} />}
        {view === 'redo' && <Redemption key={k} state={state} setState={setState} goHome={() => go('home')} />}
        {view === 'test' && <TimedTest key={k} state={state} setState={setState} goHome={() => go('home')} />}
        {view === 'cards' && <Cards key={k} state={state} setState={setState} goHome={() => go('home')} />}
      </div>
      <nav style={S.nav}>
        {[['home', 'HOME'], ['learn', 'LEARN'], ['drill', 'DRILL'], ['redo', 'REDO'], ['test', 'TEST'], ['cards', 'VOCAB']].map(([v, label]) => (
          <button key={v} style={S.navBtn(view === v)} onClick={() => go(v)}>{label}</button>
        ))}
      </nav>
    </div>
  )
}
