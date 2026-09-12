'use client'
import { useState, useEffect, useRef } from 'react'
import styles from './page.module.css'

const EXERCISES = {
  Push: ['Arnold press','Bench press (DB)','Bench press (BB)','Cable fly','Chest fly (DB)','Chest fly (Machine)','Chest press (machine)','Dumbbell press','Incline bench press (DB)','Incline bench press (BB)','Incline dumbbell press','Lateral raise','Overhead press (DB)','Overhead press (BB)','Pushups','Shoulder press (DB)','Shoulder press (BB)','Tricep dips','Tricep pushdown','Overhead tricep extension (DB)','Overhead tricep extension (Cable)','Front raise'],
  Pull: ['Banded pull aparts','Barbell row','Bicep curl (DB)','Bicep curl (BB)','Cable row','Chin-up','Draw a sword','Dumbbell row','Face pull','Hammer curl','Incline curl','Inverted row','Lat pulldown','Preacher curl (DB)','Preacher curl (BB)','Pull-up','Seated cable row','Single-arm row'],
  Legs: ['Bulgarian split squat (DB)','Bulgarian split squat (BB)','Calf raise (DB)','Calf raise (Machine)','Deadlift (BB)','Deadlift (DB)','Goblet squat','Glute bridge (BB)','Glute bridge (DB)','Hip thrust (BB)','Hip thrust (DB)','Leg curl','Leg extension','Leg press','Lunges (DB)','Lunges (BB)','Romanian deadlift (BB)','Romanian deadlift (DB)','Split squat (DB)','Split squat (BB)','Squat (BB)','Squat (DB)','Step-up (DB)','Step-up (BB)','Sumo deadlift (BB)','Sumo deadlift (DB)'],
  Core: ['Ab wheel','Bird dog','Cable crunch','Dead bug','Dragon flag','Hanging knee raise','Hanging leg raise','L-sit','Pallof press','Plank','Russian twist','Side plank','Suitcase carry','Toes to bar','Woodchop'],
}

const CARDIO_TYPES = ['Treadmill','Bike','Rower','Ski erg','Cross trainer','Outdoor run','Outdoor cycle','Swimming','Other']
const CARDIO_ZONES = ['Zone 1 — Recovery','Zone 2 — Easy / fat-burning','Zone 3 — Moderate / steady','Zone 4 — Hard / threshold','Zone 5 — Max / intervals','Mixed / circuit']
const PILATES_FOCUS = ['Full body','Core focus','Legs focus','Upper body focus','Glutes focus']
const CATEGORIES = ['Push','Pull','Legs','Core']
const SESSION_TYPES = ['Strength','Pilates','Cardio','Mixed']

const BADGE = {
  Push: { bg: '#dbeafe', color: '#1e40af' },
  Pull: { bg: '#ede9fe', color: '#5b21b6' },
  Legs: { bg: '#dcfce7', color: '#166534' },
  Core: { bg: '#fef3c7', color: '#92400e' },
  Pilates: { bg: '#fce7f3', color: '#9d174d' },
  Cardio: { bg: '#d1fae5', color: '#065f46' },
  Strength: { bg: '#e0f2fe', color: '#0369a1' },
  Mixed: { bg: '#f3f4f6', color: '#374151' },
}

function todayStr() { return new Date().toISOString().split('T')[0] }
function fmtDate(d) { return new Date(d + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) }
function rpeColor(r) { return +r >= 8 ? '#dc2626' : +r >= 6 ? '#d97706' : '#16a34a' }

const DEFAULT_PROFILE = {
  age: '42',
  experience: '12 years training, less frequently in the last 6 since having kids',
  injuries: 'Left shoulder — multiple surgeries, now stable. Shoulder stability work important. Lower back can be tight — pilates helps.',
  goals: 'Healthspan and longevity. Support a stressful job and family life. General health and consistency, not athletic performance.',
  notes: '',
}

function api(action, data = {}) {
  return fetch('/api/sheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...data }),
  }).then(r => r.json())
}

const ACTIVE_SESSION_KEY = 'ft_active_session'

function getStoredActiveSession() {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function setStoredActiveSession(session) {
  try {
    if (session) localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(ACTIVE_SESSION_KEY)
  } catch {}
}

function Slider({ label, value, onChange }) {
  return (
    <div className={styles.sliderRow}>
      <span className={styles.sliderLabel}>{label}</span>
      <input type="range" min="1" max="5" step="1" value={value} onChange={e => onChange(+e.target.value)} />
      <span className={styles.sliderVal}>{value}</span>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('log')
  const [sessions, setSessions] = useState([])
  const [exercises, setExercises] = useState([])
  const [cardio, setCardio] = useState([])
  const [reflections, setReflections] = useState([])
  const [profile, setProfile] = useState(DEFAULT_PROFILE)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [chatHistory, setChatHistory] = useState([])
  const [chatLoading, setChatLoading] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const chatRef = useRef(null)

  const [sessionType, setSessionType] = useState('Strength')
  const [form, setForm] = useState({ date: todayStr(), name: '', duration: '', rpe: '', notes: '' })
  const [activeSession, setActiveSession] = useState(null)
  const [exDraft, setExDraft] = useState({ category: 'Push', name: 'Bench press', sets: '', reps: '', kg: '', rpe: '' })
  const [cardioDraft, setCardioDraft] = useState({ type: 'Treadmill', duration: '', distance: '', hr: '', zone: CARDIO_ZONES[0], calories: '' })
  const [loggingEx, setLoggingEx] = useState(false)
  const [loggingCardio, setLoggingCardio] = useState(false)
  const [pilatesFocus, setPilatesFocus] = useState('Full body')

  const [reflectSession, setReflectSession] = useState(null)
  const [reflectForm, setReflectForm] = useState({ energy: 3, sleep: 3, stress: 3, notes: '' })

  useEffect(() => {
    loadAll()
    const stored = getStoredActiveSession()
    if (stored) setActiveSession(stored)
  }, [])
  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight }, [chatHistory, chatLoading])

  async function loadAll() {
    setLoading(true)
    try {
      const [s, e, c, r, p] = await Promise.all([
        api('getSessions'), api('getExercises'), api('getCardio'),
        api('getReflections'), api('getProfile'),
      ])
      if (s.sessions) setSessions(s.sessions)
      if (e.exercises) setExercises(e.exercises)
      if (c.cardio) setCardio(c.cardio)
      if (r.reflections) setReflections(r.reflections)
      if (p.profile) setProfile({ ...DEFAULT_PROFILE, ...p.profile })
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  function updateExDraft(field, value) {
    setExDraft(d => {
      const updated = { ...d, [field]: value }
      if (field === 'category') updated.name = EXERCISES[value]?.[0] || ''
      return updated
    })
  }

  function updateCardioDraft(field, value) {
    setCardioDraft(d => ({ ...d, [field]: value }))
  }

  async function startSession() {
    setSyncing(true)
    const sid = Date.now().toString()
    const session = { id: sid, date: form.date, name: form.name, duration: 0, rpe: '', notes: '', type: sessionType }
    try {
      await api('saveSession', { session })
      setSessions(s => [session, ...s])
      const active = { id: sid, date: form.date, name: form.name, type: sessionType }
      setActiveSession(active)
      setStoredActiveSession(active)
    } catch (e) { alert('Error starting session. Please try again.') }
    setSyncing(false)
  }

  async function logExercise() {
    if (!activeSession) return
    if (!exDraft.name || !exDraft.sets) { alert('Please enter at least sets for the exercise.'); return }
    setLoggingEx(true)
    const ex = { sessionId: activeSession.id, date: activeSession.date, category: exDraft.category, name: exDraft.name, sets: +exDraft.sets, reps: +exDraft.reps || 0, kg: +exDraft.kg || 0, rpe: exDraft.rpe || '' }
    try {
      await api('saveExercise', { exercise: ex })
      setExercises(e => [...e, ex])
      setExDraft(d => ({ ...d, sets: '', reps: '', kg: '', rpe: '' }))
    } catch (e) { alert('Error logging exercise. Please try again.') }
    setLoggingEx(false)
  }

  async function logCardio() {
    if (!activeSession) return
    if (!cardioDraft.type || !cardioDraft.duration) { alert('Please enter a duration for the cardio block.'); return }
    setLoggingCardio(true)
    const c = { sessionId: activeSession.id, date: activeSession.date, type: cardioDraft.type, duration: +cardioDraft.duration, distance: cardioDraft.distance || '', hr: cardioDraft.hr || '', zone: cardioDraft.zone || '', calories: cardioDraft.calories || '' }
    try {
      await api('saveCardio', { cardio: c })
      setCardio(cs => [...cs, c])
      setCardioDraft(d => ({ ...d, duration: '', distance: '', hr: '', calories: '' }))
    } catch (e) { alert('Error logging cardio. Please try again.') }
    setLoggingCardio(false)
  }

  async function finishSession() {
    if (!activeSession) return
    if (!form.duration) { alert('Please enter duration.'); return }
    setSyncing(true)
    const notes = activeSession.type === 'Pilates'
      ? `Focus: ${pilatesFocus}${form.notes ? ' — ' + form.notes : ''}`
      : form.notes
    const session = { id: activeSession.id, date: activeSession.date, name: activeSession.name, duration: +form.duration, rpe: form.rpe, notes, type: activeSession.type }
    try {
      await api('updateSession', { session })
      setSessions(s => s.map(x => x.id === activeSession.id ? session : x))
      setActiveSession(null)
      setStoredActiveSession(null)
      setForm({ date: todayStr(), name: '', duration: '', rpe: '', notes: '' })
      setSessionType('Strength')
      setExDraft({ category: 'Push', name: 'Bench press', sets: '', reps: '', kg: '', rpe: '' })
      setCardioDraft({ type: 'Treadmill', duration: '', distance: '', hr: '', zone: CARDIO_ZONES[0], calories: '' })
      setPilatesFocus('Full body')
      setTab('history')
    } catch (e) { alert('Error finishing session. Please try again.') }
    setSyncing(false)
  }

  async function saveReflection() {
    if (!reflectSession) return
    const reflection = { sessionId: reflectSession.id, date: reflectSession.date, ...reflectForm }
    await api('saveReflection', { reflection })
    setReflections(r => [...r, reflection])
    setReflectSession(null)
    setReflectForm({ energy: 3, sleep: 3, stress: 3, notes: '' })
    alert('Reflection saved!')
  }

  function buildContext() {
    const sessionLines = sessions.slice(0, 30).map(s => {
      const exs = exercises.filter(e => e.sessionId === s.id)
      const cars = cardio.filter(c => c.sessionId === s.id)
      const ref = reflections.find(r => r.sessionId === s.id)
      const exStr = exs.map(e => `${e.name} (${e.category}) ${e.sets}x${e.reps}${e.kg ? ' @' + e.kg + 'kg' : ''}${e.rpe ? ' RPE' + e.rpe : ''}`).join(', ')
      const carStr = cars.map(c => `${c.type} ${c.duration}min${c.distance ? ' ' + c.distance + 'km' : ''}${c.hr ? ' ' + c.hr + 'bpm' : ''}${c.zone ? ' ' + c.zone : ''}${c.calories ? ' ' + c.calories + 'cal' : ''}`).join(', ')
      const refStr = ref ? ` | Reflection: energy ${ref.energy}/5, sleep ${ref.sleep}/5, stress ${ref.stress}/5${ref.notes ? ' — ' + ref.notes : ''}` : ''
      return `${s.date}: ${s.type}${s.name ? ' — ' + s.name : ''} (${s.duration}min, overall RPE ${s.rpe})${s.notes ? ' | ' + s.notes : ''}${exStr ? ' | Exercises: ' + exStr : ''}${carStr ? ' | Cardio: ' + carStr : ''}${refStr}`
    }).join('\n')

    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentEx = exercises.filter(e => new Date(e.date + 'T12:00:00') >= sevenDaysAgo)
    const fatigue = {}
    recentEx.forEach(e => { fatigue[e.category] = (fatigue[e.category] || 0) + (e.sets || 0) })
    const fatigueStr = Object.entries(fatigue).map(([k, v]) => `${k}: ${v} sets`).join(', ')

    const byExercise = {}
    exercises.forEach(e => { if (!byExercise[e.name]) byExercise[e.name] = []; byExercise[e.name].push(e) })
    const bests = Object.entries(byExercise).map(([name, sets]) => {
      const withKg = sets.filter(s => s.kg > 0)
      if (!withKg.length) return null
      const best = withKg.reduce((a, b) => b.kg > a.kg ? b : a)
      return `${name}: ${best.kg}kg × ${best.sets}×${best.reps}`
    }).filter(Boolean).join(', ')

    return { sessionLines, fatigueStr, bests }
  }

  async function sendChat(msg) {
    const message = msg || chatInput.trim()
    if (!message) return
    setChatInput('')
    const newHistory = [...chatHistory, { role: 'user', content: message }]
    setChatHistory(newHistory)
    setChatLoading(true)

    const { sessionLines, fatigueStr, bests } = buildContext()

    const systemPrompt = `You are Atlas, an experienced personal trainer and wellness coach. Warm but direct. You give specific, actionable advice grounded in your client's actual data.

CLIENT PROFILE:
- Age: ${profile.age}
- Training background: ${profile.experience}
- Injuries/limitations: ${profile.injuries}
- Goals: ${profile.goals}
${profile.notes ? '- Additional notes: ' + profile.notes : ''}

TRAINING PHILOSOPHY FOR THIS CLIENT:
- Healthspan and longevity are the primary lens, not performance or aesthetics
- Consistency over intensity
- Stress and recovery matter as much as training load
- Left shoulder needs regular stability work — build in face pulls, band work or similar
- Lower back responds well to pilates and core work
- Balance push/pull/legs/core across the week
- Pilates sessions often run at high RPE and can leave DOMS in the focus area — account for that when planning the next session

RECENT TRAINING DATA (last 30 sessions):
${sessionLines || 'No sessions logged yet.'}

MUSCLE GROUP LOAD — LAST 7 DAYS:
${fatigueStr || 'No recent data.'}

PERSONAL BESTS:
${bests || 'None recorded yet.'}

RESPONSE GUIDELINES:
- When planning a session or week, ask about energy, sleep and stress if the client hasn't already told you
- Reference their actual data: specific exercises, weights, dates
- For programme planning give specific exercises, sets, reps and weight suggestions based on their logged bests
- Keep responses concise unless a detailed plan is requested
- Plain text only, no markdown
- You are not a medical professional — if something sounds like an injury rather than normal soreness, say so and suggest they get it looked at`

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory.map(m => ({ role: m.role, content: m.content })), systemPrompt })
      })
      const data = await res.json()
      setChatHistory(h => [...h, { role: 'assistant', content: data.content || 'Something went wrong.' }])
    } catch {
      setChatHistory(h => [...h, { role: 'assistant', content: 'Error — please try again.' }])
    }
    setChatLoading(false)
  }

  const totalMins = sessions.reduce((a, s) => a + (+s.duration || 0), 0)
  const totalHrs = totalMins >= 60 ? `${Math.floor(totalMins / 60)}h ${totalMins % 60}m` : `${totalMins}m`
  const now = new Date()
  const mon = new Date(now); mon.setDate(now.getDate() - now.getDay() + 1); mon.setHours(0, 0, 0, 0)
  const thisWeek = sessions.filter(s => new Date(s.date + 'T12:00:00') >= mon).length
  const rpes = sessions.filter(s => s.rpe).map(s => +s.rpe)
  const avgRpe = rpes.length ? (rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1) : '—'

  const byEx = {}
  exercises.forEach(e => { if (!byEx[e.name]) byEx[e.name] = []; byEx[e.name].push(e) })

  const weeks = []
  for (let i = 7; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i * 7)
    const s = new Date(d); s.setDate(d.getDate() - d.getDay() + 1); s.setHours(0, 0, 0, 0)
    const e = new Date(s); e.setDate(s.getDate() + 7)
    const count = sessions.filter(w => { const wd = new Date(w.date + 'T12:00:00'); return wd >= s && wd < e }).length
    weeks.push({ count, label: s.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) })
  }
  const maxWeek = Math.max(...weeks.map(w => w.count), 1)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888', fontSize: 14 }}>
      Loading…
    </div>
  )

  return (
    <div className={styles.app}>
      <div className={styles.header}>
        <div>
          <div className={styles.logo}>Fitness Tracker</div>
          <div className={styles.sublogo}>{sessions.length} sessions logged</div>
        </div>
        {syncing && <div style={{ fontSize: 12, color: '#888' }}>Saving…</div>}
      </div>

      <div className={styles.nav}>
        {['log', 'history', 'progress', 'reflect', 'atlas', 'profile'].map(t => (
          <button key={t} className={`${styles.navBtn} ${tab === t ? styles.navBtnActive : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className={styles.content}>

        {tab === 'log' && (
          <div>
            {!activeSession ? (
              <div className={styles.card}>
                <div className={styles.sectionLabel}>Start a session</div>
                <div className={styles.grid2} style={{ marginBottom: 10 }}>
                  <div><label className={styles.fieldLabel}>Date</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
                  <div>
                    <label className={styles.fieldLabel}>Type</label>
                    <select value={sessionType} onChange={e => setSessionType(e.target.value)}>
                      {SESSION_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label className={styles.fieldLabel}>Session name (optional)</label>
                  <input type="text" placeholder="e.g. Upper body, Morning session…" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <button className={styles.btnPrimary} style={{ width: '100%' }} onClick={startSession} disabled={syncing}>
                  {syncing ? 'Starting…' : 'Start session'}
                </button>
              </div>
            ) : (
              <div>
                <div className={styles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div className={styles.sectionLabel} style={{ margin: 0 }}>Session in progress</div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                        {fmtDate(activeSession.date)}{activeSession.name ? ' · ' + activeSession.name : ''}
                      </div>
                    </div>
                    <span style={{ background: (BADGE[activeSession.type] || BADGE.Mixed).bg, color: (BADGE[activeSession.type] || BADGE.Mixed).color, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{activeSession.type}</span>
                  </div>
                </div>

                {activeSession.type === 'Pilates' && (
                  <div className={styles.card}>
                    <div className={styles.sectionLabel}>Pilates detail</div>
                    <div>
                      <label className={styles.fieldLabel}>Focus area</label>
                      <select value={pilatesFocus} onChange={e => setPilatesFocus(e.target.value)}>
                        {PILATES_FOCUS.map(f => <option key={f}>{f}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {(activeSession.type === 'Strength' || activeSession.type === 'Mixed') && (
                  <div className={styles.card}>
                    <div className={styles.sectionLabel}>Log an exercise</div>
                    <div className={styles.grid2} style={{ marginBottom: 8 }}>
                      <div>
                        <label className={styles.fieldLabel}>Category</label>
                        <select value={exDraft.category} onChange={e => updateExDraft('category', e.target.value)}>
                          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={styles.fieldLabel}>Exercise</label>
                        <select value={exDraft.name} onChange={e => updateExDraft('name', e.target.value)}>
                          {(EXERCISES[exDraft.category] || []).map(ex => <option key={ex}>{ex}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                      <div><label className={styles.fieldLabel}>Sets</label><input type="number" placeholder="3" min="1" value={exDraft.sets} onChange={e => updateExDraft('sets', e.target.value)} /></div>
                      <div><label className={styles.fieldLabel}>Reps</label><input type="number" placeholder="10" min="1" value={exDraft.reps} onChange={e => updateExDraft('reps', e.target.value)} /></div>
                      <div><label className={styles.fieldLabel}>kg</label><input type="number" placeholder="0" min="0" step="0.5" value={exDraft.kg} onChange={e => updateExDraft('kg', e.target.value)} /></div>
                      <div><label className={styles.fieldLabel}>RPE</label><input type="number" placeholder="7" min="1" max="10" value={exDraft.rpe} onChange={e => updateExDraft('rpe', e.target.value)} /></div>
                    </div>
                    <button className={styles.btnPrimary} style={{ width: '100%' }} onClick={logExercise} disabled={loggingEx}>
                      {loggingEx ? 'Logging…' : '+ Log exercise'}
                    </button>
                    {exercises.filter(e => e.sessionId === activeSession.id).length > 0 && (
                      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {exercises.filter(e => e.sessionId === activeSession.id).map((e, i) => (
                          <span key={i} style={{ fontSize: 11, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 4, padding: '2px 7px', color: '#555' }}>
                            {e.name}{e.sets ? ` ${e.sets}×${e.reps}` : ''}{e.kg ? ` @ ${e.kg}kg` : ''}{e.rpe ? ` RPE${e.rpe}` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {(activeSession.type === 'Cardio' || activeSession.type === 'Mixed') && (
                  <div className={styles.card}>
                    <div className={styles.sectionLabel}>Log cardio</div>
                    <div className={styles.grid2} style={{ marginBottom: 8 }}>
                      <div>
                        <label className={styles.fieldLabel}>Type</label>
                        <select value={cardioDraft.type} onChange={e => updateCardioDraft('type', e.target.value)}>
                          {CARDIO_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div><label className={styles.fieldLabel}>Duration (min)</label><input type="number" placeholder="30" min="1" value={cardioDraft.duration} onChange={e => updateCardioDraft('duration', e.target.value)} /></div>
                    </div>
                    <div className={styles.grid2} style={{ marginBottom: 8 }}>
                      <div><label className={styles.fieldLabel}>Distance (km)</label><input type="number" placeholder="5.0" step="0.1" value={cardioDraft.distance} onChange={e => updateCardioDraft('distance', e.target.value)} /></div>
                      <div><label className={styles.fieldLabel}>Avg HR (bpm)</label><input type="number" placeholder="135" value={cardioDraft.hr} onChange={e => updateCardioDraft('hr', e.target.value)} /></div>
                    </div>
                    <div className={styles.grid2} style={{ marginBottom: 10 }}>
                      <div>
                        <label className={styles.fieldLabel}>Zone</label>
                        <select value={cardioDraft.zone} onChange={e => updateCardioDraft('zone', e.target.value)}>
                          {CARDIO_ZONES.map(z => <option key={z}>{z}</option>)}
                        </select>
                      </div>
                      <div><label className={styles.fieldLabel}>Calories</label><input type="number" placeholder="300" value={cardioDraft.calories} onChange={e => updateCardioDraft('calories', e.target.value)} /></div>
                    </div>
                    <button className={styles.btnPrimary} style={{ width: '100%' }} onClick={logCardio} disabled={loggingCardio}>
                      {loggingCardio ? 'Logging…' : '+ Log cardio block'}
                    </button>
                    {cardio.filter(c => c.sessionId === activeSession.id).length > 0 && (
                      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {cardio.filter(c => c.sessionId === activeSession.id).map((c, i) => (
                          <span key={i} style={{ fontSize: 11, background: '#ecfdf5', border: '1px solid #d1fae5', borderRadius: 4, padding: '2px 7px', color: '#065f46' }}>
                            {c.type} {c.duration}min{c.distance ? ' · ' + c.distance + 'km' : ''}{c.hr ? ' · ' + c.hr + 'bpm' : ''}{c.zone ? ' · ' + c.zone : ''}{c.calories ? ' · ' + c.calories + ' cal' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.card}>
                  <div className={styles.sectionLabel}>Finish session</div>
                  <div className={styles.grid2} style={{ marginBottom: 10 }}>
                    <div><label className={styles.fieldLabel}>Total duration (min)</label><input type="number" placeholder="60" min="1" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} /></div>
                    <div><label className={styles.fieldLabel}>Overall RPE (1–10)</label><input type="number" placeholder="7" min="1" max="10" value={form.rpe} onChange={e => setForm(f => ({ ...f, rpe: e.target.value }))} /></div>
                  </div>
                  <div style={{ marginBottom: 14 }}><label className={styles.fieldLabel}>Session notes</label><input type="text" placeholder="How you felt, anything notable…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
                  <button className={styles.btnPrimary} style={{ width: '100%' }} onClick={finishSession} disabled={syncing}>
                    {syncing ? 'Finishing…' : 'Finish session'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className={styles.card}>
            <div className={styles.sectionLabel}>All sessions</div>
            {sessions.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center', padding: '30px 0', fontSize: 14 }}>No sessions yet.</p>
            ) : sessions.map(s => {
              const exs = exercises.filter(e => e.sessionId === s.id)
              const cars = cardio.filter(c => c.sessionId === s.id)
              const ref = reflections.find(r => r.sessionId === s.id)
              const bc = BADGE[s.type] || BADGE.Mixed
              return (
                <div key={s.id} className={styles.historyItem}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                        <span style={{ background: bc.bg, color: bc.color, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{s.type}</span>
                        {s.name && <span style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        {fmtDate(s.date)} · {s.duration}min
                        {s.rpe && <span style={{ marginLeft: 6 }}><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: rpeColor(s.rpe), marginRight: 3, verticalAlign: 'middle' }}></span>RPE {s.rpe}</span>}
                      </div>
                      {s.notes && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{s.notes}</div>}
                    </div>
                    <button className={styles.btnGhost} style={{ fontSize: 11, padding: '4px 10px', marginLeft: 8 }} onClick={() => { setReflectSession(s); if (ref) setReflectForm({ energy: ref.energy, sleep: ref.sleep, stress: ref.stress, notes: ref.notes }); setTab('reflect') }}>
                      {ref ? '✓ Reflected' : 'Reflect'}
                    </button>
                  </div>
                  {exs.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {exs.map((e, i) => (
                        <span key={i} style={{ fontSize: 11, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 4, padding: '2px 7px', color: '#555' }}>
                          {e.name}{e.sets ? ` ${e.sets}×${e.reps}` : ''}{e.kg ? ` @ ${e.kg}kg` : ''}{e.rpe ? ` RPE${e.rpe}` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                  {cars.length > 0 && (
                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {cars.map((c, i) => (
                        <span key={i} style={{ fontSize: 11, background: '#ecfdf5', border: '1px solid #d1fae5', borderRadius: 4, padding: '2px 7px', color: '#065f46' }}>
                          {c.type} {c.duration}min{c.distance ? ' · ' + c.distance + 'km' : ''}{c.hr ? ' · ' + c.hr + 'bpm' : ''}{c.zone ? ' · ' + c.zone : ''}{c.calories ? ' · ' + c.calories + ' cal' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {tab === 'progress' && (
          <div>
            <div className={styles.grid4} style={{ marginBottom: 12 }}>
              {[{ num: sessions.length, label: 'Sessions' }, { num: thisWeek, label: 'This week' }, { num: totalHrs, label: 'Total time' }, { num: avgRpe, label: 'Avg RPE' }].map(s => (
                <div key={s.label} className={styles.statCard}>
                  <div className={styles.statNum}>{s.num}</div>
                  <div className={styles.statLabel}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className={styles.card}>
              <div className={styles.sectionLabel}>8-week activity</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 72, marginBottom: 6 }}>
                {weeks.map((w, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <div style={{ background: '#111', opacity: w.count ? 0.15 + (w.count / maxWeek) * 0.75 : 0.07, borderRadius: '3px 3px 0 0', height: `${Math.max((w.count / maxWeek) * 100, 5)}%` }}></div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                {weeks.map((w, i) => (
                  <div key={i} style={{ flex: 1, fontSize: 10, color: '#aaa', textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {i === 7 ? 'Now' : w.label.split(' ')[0]}
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.sectionLabel}>Strength progress</div>
              {Object.keys(byEx).length === 0 ? (
                <p style={{ color: '#888', fontSize: 13 }}>Log some strength sessions to see progress.</p>
              ) : Object.entries(byEx).sort((a, b) => b[1].length - a[1].length).map(([name, sets]) => {
                const withKg = sets.filter(s => s.kg > 0)
                const best = withKg.length ? withKg.reduce((a, b) => b.kg > a.kg ? b : a) : null
                const trend = withKg.length >= 2 ? (withKg[withKg.length - 1].kg - withKg[0].kg) : null
                return (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '9px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
                    <span style={{ fontWeight: 500 }}>{name}</span>
                    <span style={{ color: '#888', fontSize: 12 }}>
                      {sets.length} sets{best ? ` · best ${best.kg}kg × ${best.sets}×${best.reps}` : ''}
                      {trend !== null && trend !== 0 && <span style={{ color: trend > 0 ? '#16a34a' : '#dc2626', marginLeft: 5 }}>{trend > 0 ? '+' : ''}{trend}kg</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'reflect' && (
          <div className={styles.card}>
            <div className={styles.sectionLabel}>Session reflection</div>
            {!reflectSession ? (
              <div>
                <p style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>Select a session to reflect on:</p>
                {sessions.length === 0 && <p style={{ fontSize: 13, color: '#aaa' }}>No sessions logged yet.</p>}
                {sessions.slice(0, 10).map(s => {
                  const ref = reflections.find(r => r.sessionId === s.id)
                  return (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{s.name || s.type}</span>
                        <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>{fmtDate(s.date)}</span>
                      </div>
                      <button className={ref ? styles.btnSecondary : styles.btnGhost} style={{ fontSize: 12 }} onClick={() => { setReflectSession(s); if (ref) setReflectForm({ energy: ref.energy, sleep: ref.sleep, stress: ref.stress, notes: ref.notes }) }}>
                        {ref ? '✓ Edit' : 'Add'}
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 14 }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{reflectSession.name || reflectSession.type}</span>
                  <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>{fmtDate(reflectSession.date)}</span>
                </div>
                <Slider label="Energy" value={reflectForm.energy} onChange={v => setReflectForm(f => ({ ...f, energy: v }))} />
                <Slider label="Sleep" value={reflectForm.sleep} onChange={v => setReflectForm(f => ({ ...f, sleep: v }))} />
                <Slider label="Stress" value={reflectForm.stress} onChange={v => setReflectForm(f => ({ ...f, stress: v }))} />
                <div style={{ marginTop: 10, marginBottom: 14 }}>
                  <label className={styles.fieldLabel}>Notes — DOMS, how you felt, anything notable</label>
                  <textarea value={reflectForm.notes} onChange={e => setReflectForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Legs sore from yesterday's pilates, felt strong on bench…" />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className={styles.btnPrimary} onClick={saveReflection}>Save reflection</button>
                  <button className={styles.btnGhost} onClick={() => { setReflectSession(null); setReflectForm({ energy: 3, sleep: 3, stress: 3, notes: '' }) }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'atlas' && (
          <div className={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className={styles.sectionLabel} style={{ margin: 0 }}>Atlas — your coach</div>
              {chatHistory.length > 0 && <button className={styles.btnGhost} style={{ fontSize: 11 }} onClick={() => setChatHistory([])}>Clear</button>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
              {[
                ['Plan my week', 'Hey Atlas, help me plan my training this week.'],
                ['Recovery check', 'How is my recovery looking based on my recent sessions?'],
                ['Strength progress', 'How is my strength progressing and where should I push the weight?'],
                ['Next session', 'What should I focus on in my next session?'],
                ['Consistency', 'How consistent have I been and am I on track for my health goals?'],
              ].map(([label, msg]) => (
                <button key={label} className={styles.btnGhost} onClick={() => sendChat(msg)}>{label}</button>
              ))}
            </div>
            <div ref={chatRef} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto', marginBottom: 12 }}>
              {chatHistory.length === 0 && (
                <p style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                  Hey — I&apos;m Atlas. Tell me how you&apos;re feeling and what you&apos;ve got time for, and I&apos;ll help you train smart.
                </p>
              )}
              {chatHistory.map((m, i) => (
                <div key={i} style={{
                  padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.6,
                  maxWidth: '90%', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  background: m.role === 'user' ? '#f3f4f6' : '#eff6ff',
                  color: m.role === 'user' ? '#111' : '#1e3a5f',
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  borderBottomRightRadius: m.role === 'user' ? 4 : 12,
                  borderBottomLeftRadius: m.role === 'user' ? 12 : 4,
                }}>
                  {m.content}
                </div>
              ))}
              {chatLoading && (
                <div style={{ padding: '10px 14px', borderRadius: 12, fontSize: 13, background: '#f9fafb', color: '#aaa', alignSelf: 'flex-start', fontStyle: 'italic' }}>
                  Atlas is thinking…
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" placeholder="Talk to Atlas…" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} style={{ flex: 1 }} />
              <button className={styles.btnPrimary} onClick={() => sendChat()} disabled={chatLoading}>Send</button>
            </div>
          </div>
        )}

        {tab === 'profile' && (
          <div className={styles.card}>
            <div className={styles.sectionLabel}>Your profile</div>
            <p style={{ fontSize: 12, color: '#888', marginBottom: 16, lineHeight: 1.6 }}>
              This is what Atlas knows about you. Update it any time — it&apos;s included in every conversation.
            </p>
            <div style={{ marginBottom: 12 }}>
              <label className={styles.fieldLabel}>Age</label>
              <input type="number" value={profile.age} onChange={e => setProfile(p => ({ ...p, age: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className={styles.fieldLabel}>Training background</label>
              <textarea value={profile.experience} onChange={e => setProfile(p => ({ ...p, experience: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className={styles.fieldLabel}>Injuries / limitations</label>
              <textarea value={profile.injuries} onChange={e => setProfile(p => ({ ...p, injuries: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className={styles.fieldLabel}>Goals</label>
              <textarea value={profile.goals} onChange={e => setProfile(p => ({ ...p, goals: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className={styles.fieldLabel}>Additional notes for Atlas</label>
              <textarea placeholder="Anything else Atlas should know…" value={profile.notes} onChange={e => setProfile(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <button className={styles.btnPrimary} onClick={async () => { await api('saveProfile', { profile }); alert('Profile saved!') }}>
              Save profile
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
