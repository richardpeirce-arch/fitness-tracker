'use client'
import { useState, useEffect, useRef } from 'react'
import styles from './page.module.css'

const EXERCISES = {
  'Strength — Push': ['Arnold press','Bench press','Cable fly','Chest fly','Chest press (machine)','Dumbbell press','Incline bench press','Incline dumbbell press','Lateral raise','Overhead press','Pushups','Shoulder press','Tricep dips','Tricep pushdown','Overhead tricep extension','Front raise'],
  'Strength — Pull': ['Barbell row','Bicep curl','Cable row','Chin-up','Dumbbell row','Face pull','Hammer curl','Incline curl','Inverted row','Lat pulldown','Preacher curl','Pull-up','Seated cable row','Single-arm row'],
  'Strength — Legs': ['Bulgarian split squat','Calf raise','Deadlift','Goblet squat','Glute bridge','Hip thrust','Leg curl','Leg extension','Leg press','Lunges','Romanian deadlift','Split squat','Squat','Step-up','Sumo deadlift'],
  'Strength — Core': ['Ab wheel','Bird dog','Cable crunch','Dead bug','Dragon flag','Hanging knee raise','Hanging leg raise','L-sit','Pallof press','Plank','Russian twist','Side plank','Suitcase carry','Toes to bar','Woodchop'],
}

const SESSION_TYPES = [
  { group: 'Strength', options: ['Strength — Push','Strength — Pull','Strength — Legs','Strength — Core'] },
  { group: 'Other', options: ['Cardio','Pilates','Run','Cycling','Yoga / mobility','Other'] },
]

function todayStr() { return new Date().toISOString().split('T')[0] }
function fmtDate(d) { return new Date(d+'T12:00:00').toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'}) }
function rpeColor(r) { return +r>=8?'#E24B4A':+r>=6?'#EF9F27':'#4a9e5c' }
function isStrength(t) { return t && t.startsWith('Strength') }

const BADGE_COLORS = {
  'Strength — Push': { bg: '#dbeafe', color: '#1e40af' },
  'Strength — Pull': { bg: '#ede9fe', color: '#5b21b6' },
  'Strength — Legs': { bg: '#dcfce7', color: '#166534' },
  'Strength — Core': { bg: '#fef3c7', color: '#92400e' },
  'Pilates': { bg: '#fce7f3', color: '#9d174d' },
  'Cardio': { bg: '#d1fae5', color: '#065f46' },
  'Run': { bg: '#d1fae5', color: '#065f46' },
  'Cycling': { bg: '#d1fae5', color: '#065f46' },
  'default': { bg: '#f3f4f6', color: '#374151' },
}

export default function App() {
  const [tab, setTab] = useState('log')
  const [sessions, setSessions] = useState([])
  const [exercises, setExercises] = useState([])
  const [chatHistory, setChatHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)
  const [exerciseRows, setExerciseRows] = useState([{ id: 1, name: '', sets: '', reps: '', kg: '' }])
  const [form, setForm] = useState({ date: todayStr(), type: 'Strength — Push', duration: '', rpe: '', notes: '', dist: '', hr: '' })
  const [chatInput, setChatInput] = useState('')
  const chatRef = useRef(null)

  useEffect(() => { loadData() }, [])
  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight }, [chatHistory, chatLoading])

  async function loadData() {
    setLoading(true)
    try {
      const [sRes, eRes] = await Promise.all([
        fetch('/api/sheets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getSessions' }) }),
        fetch('/api/sheets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getExercises' }) }),
      ])
      const sData = await sRes.json()
      const eData = await eRes.json()
      if (sData.sessions) setSessions(sData.sessions)
      if (eData.exercises) setExercises(eData.exercises)
    } catch (e) { console.error('Load error:', e) }
    setLoading(false)
  }

  function onTypeChange(type) {
    setForm(f => ({ ...f, type }))
    if (isStrength(type)) {
      const exList = EXERCISES[type] || []
      setExerciseRows([{ id: 1, name: exList[0] || '', sets: '', reps: '', kg: '' }])
    }
  }

  function addExerciseRow() {
    const exList = EXERCISES[form.type] || []
    setExerciseRows(rows => [...rows, { id: Date.now(), name: exList[0] || '', sets: '', reps: '', kg: '' }])
  }

  function updateExRow(id, field, value) {
    setExerciseRows(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function removeExRow(id) {
    setExerciseRows(rows => rows.filter(r => r.id !== id))
  }

  async function saveSession() {
    if (!form.duration) { alert('Please enter duration.'); return }
    setSyncing(true)
    const sid = Date.now().toString()
    const session = { id: sid, ...form, duration: +form.duration }
    try {
      await fetch('/api/sheets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'saveSession', session }) })
      const newExercises = []
      if (isStrength(form.type)) {
        for (const row of exerciseRows) {
          if (row.name && row.sets) {
            const ex = { sessionId: sid, date: form.date, name: row.name, sets: +row.sets, reps: +row.reps || 0, kg: +row.kg || 0 }
            await fetch('/api/sheets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'saveExercise', exercise: ex }) })
            newExercises.push(ex)
          }
        }
      }
      setSessions(s => [session, ...s])
      setExercises(e => [...e, ...newExercises])
      setForm({ date: todayStr(), type: form.type, duration: '', rpe: '', notes: '', dist: '', hr: '' })
      setExerciseRows([{ id: 1, name: EXERCISES[form.type]?.[0] || '', sets: '', reps: '', kg: '' }])
      setTab('history')
    } catch (e) { alert('Error saving. Please try again.') }
    setSyncing(false)
  }

  async function sendChat(msg) {
    const message = msg || chatInput.trim()
    if (!message) return
    setChatInput('')
    const newHistory = [...chatHistory, { role: 'user', content: message }]
    setChatHistory(newHistory)
    setChatLoading(true)

    const sessionLines = sessions.slice(0,30).map(s => {
      const exs = exercises.filter(e => e.sessionId === s.id)
      const exStr = exs.map(e => `${e.name} ${e.sets}x${e.reps}${e.kg?' @'+e.kg+'kg':''}`).join(', ')
      return `${s.date}: ${s.type} (${s.duration}min, RPE ${s.rpe})${s.notes?' — '+s.notes:''}${exStr?' | '+exStr:''}`
    }).join('\n')

    const byEx = {}
    exercises.forEach(e => { if(!byEx[e.name]) byEx[e.name]=[]; byEx[e.name].push(e) })
    const bests = Object.entries(byEx).map(([name,sets]) => {
      const withKg = sets.filter(s=>s.kg>0)
      if (!withKg.length) return null
      const best = withKg.reduce((a,b) => b.kg>a.kg?b:a)
      return `${name}: best ${best.kg}kg (${best.sets}x${best.reps})`
    }).filter(Boolean).join(', ')

    const systemPrompt = `You are a direct, knowledgeable personal trainer and fitness coach. Your client:
- Trains 2–3 days/week, goal is general health and consistency
- Does push/pull/legs/core strength split at a full commercial gym
- Also does pilates and cardio sessions
- Has access to full commercial gym (barbells, cables, machines, dumbbells)

Their training data:
${sessionLines || 'No sessions logged yet.'}
${bests ? '\nCurrent personal bests: ' + bests : ''}

Be specific and data-driven. Reference their actual lifts and sessions. Plain text only, no markdown. Keep replies concise (4–8 sentences) unless a detailed plan is requested. For plans, name exercises, sets, reps, and suggest weights based on their logged data.`

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory.map(m => ({ role: m.role, content: m.content })), systemPrompt })
      })
      const data = await res.json()
      const reply = data.content || 'Something went wrong.'
      setChatHistory(h => [...h, { role: 'assistant', content: reply }])
    } catch {
      setChatHistory(h => [...h, { role: 'assistant', content: 'Error — please try again.' }])
    }
    setChatLoading(false)
  }

  const totalMins = sessions.reduce((a,s) => a+(+s.duration||0), 0)
  const totalHrs = totalMins >= 60 ? `${Math.floor(totalMins/60)}h ${totalMins%60}m` : `${totalMins}m`
  const now = new Date()
  const mon = new Date(now); mon.setDate(now.getDate()-now.getDay()+1); mon.setHours(0,0,0,0)
  const thisWeek = sessions.filter(s => new Date(s.date+'T12:00:00') >= mon).length
  const rpes = sessions.filter(s=>s.rpe).map(s=>+s.rpe)
  const avgRpe = rpes.length ? (rpes.reduce((a,b)=>a+b,0)/rpes.length).toFixed(1) : '—'

  const byEx = {}
  exercises.forEach(e => { if(!byEx[e.name]) byEx[e.name]=[]; byEx[e.name].push(e) })

  const weeks = []
  for (let i=7;i>=0;i--) {
    const d=new Date(); d.setDate(d.getDate()-i*7)
    const s=new Date(d); s.setDate(d.getDate()-d.getDay()+1); s.setHours(0,0,0,0)
    const e=new Date(s); e.setDate(s.getDate()+7)
    const count=sessions.filter(w=>{const wd=new Date(w.date+'T12:00:00');return wd>=s&&wd<e;}).length
    weeks.push({count,label:s.toLocaleDateString('en-AU',{day:'numeric',month:'short'})})
  }
  const maxWeek = Math.max(...weeks.map(w=>w.count),1)

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'#888',fontSize:14}}>
      Loading your data…
    </div>
  )

  return (
    <div className={styles.app}>
      <div className={styles.header}>
        <div>
          <div className={styles.logo}>Fitness Tracker</div>
          <div className={styles.sublogo}>{sessions.length} sessions logged</div>
        </div>
        {syncing && <div style={{fontSize:12,color:'#888'}}>Saving…</div>}
      </div>

      <div className={styles.nav}>
        {['log','history','progress','coach'].map(t => (
          <button key={t} className={`${styles.navBtn} ${tab===t?styles.navBtnActive:''}`} onClick={()=>setTab(t)}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      <div className={styles.content}>

        {tab==='log' && (
          <div>
            <div className={styles.card}>
              <div className={styles.sectionLabel}>Session details</div>
              <div className={styles.grid2} style={{marginBottom:10}}>
                <div><label className={styles.fieldLabel}>Date</label><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></div>
                <div>
                  <label className={styles.fieldLabel}>Session type</label>
                  <select value={form.type} onChange={e=>onTypeChange(e.target.value)}>
                    {SESSION_TYPES.map(g => (
                      <optgroup key={g.group} label={g.group}>
                        {g.options.map(o => <option key={o}>{o}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>
              <div className={styles.grid2} style={{marginBottom:10}}>
                <div><label className={styles.fieldLabel}>Duration (min)</label><input type="number" placeholder="60" min="1" value={form.duration} onChange={e=>setForm(f=>({...f,duration:e.target.value}))} /></div>
                <div><label className={styles.fieldLabel}>Effort / RPE (1–10)</label><input type="number" placeholder="7" min="1" max="10" value={form.rpe} onChange={e=>setForm(f=>({...f,rpe:e.target.value}))} /></div>
              </div>
              <div><label className={styles.fieldLabel}>Session notes (optional)</label><input type="text" placeholder="How you felt, any issues…" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
            </div>

            {isStrength(form.type) && (
              <div className={styles.card}>
                <div className={styles.sectionLabel}>Exercises</div>
                <div style={{marginBottom:8,display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 28px',gap:6}}>
                  <div style={{fontSize:11,color:'#888'}}>Exercise</div>
                  <div style={{fontSize:11,color:'#888'}}>Sets</div>
                  <div style={{fontSize:11,color:'#888'}}>Reps</div>
                  <div style={{fontSize:11,color:'#888'}}>kg</div>
                  <div></div>
                </div>
                {exerciseRows.map(row => (
                  <div key={row.id} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 28px',gap:6,marginBottom:6,alignItems:'center'}}>
                    <select value={row.name} onChange={e=>updateExRow(row.id,'name',e.target.value)}>
                      {(EXERCISES[form.type]||[]).map(ex=><option key={ex}>{ex}</option>)}
                    </select>
                    <input type="number" placeholder="3" min="1" max="20" value={row.sets} onChange={e=>updateExRow(row.id,'sets',e.target.value)} />
                    <input type="number" placeholder="10" min="1" max="100" value={row.reps} onChange={e=>updateExRow(row.id,'reps',e.target.value)} />
                    <input type="number" placeholder="0" min="0" step="0.5" value={row.kg} onChange={e=>updateExRow(row.id,'kg',e.target.value)} />
                    <button onClick={()=>removeExRow(row.id)} style={{background:'none',border:'none',color:'#bbb',fontSize:18,cursor:'pointer',padding:0}}>×</button>
                  </div>
                ))}
                <button className={styles.btnGhost} style={{fontSize:12,padding:'5px 12px',marginTop:4}} onClick={addExerciseRow}>+ Add exercise</button>
              </div>
            )}

            {['Cardio','Run','Cycling'].includes(form.type) && (
              <div className={styles.card}>
                <div className={styles.sectionLabel}>Session detail</div>
                <div className={styles.grid2}>
                  <div><label className={styles.fieldLabel}>Distance (km)</label><input type="number" placeholder="5.0" step="0.1" value={form.dist} onChange={e=>setForm(f=>({...f,dist:e.target.value}))} /></div>
                  <div><label className={styles.fieldLabel}>Avg heart rate</label><input type="number" placeholder="145" value={form.hr} onChange={e=>setForm(f=>({...f,hr:e.target.value}))} /></div>
                </div>
              </div>
            )}

            <button className={styles.btnPrimary} style={{width:'100%'}} onClick={saveSession} disabled={syncing}>
              {syncing ? 'Saving…' : 'Save session'}
            </button>
          </div>
        )}

        {tab==='history' && (
          <div className={styles.card}>
            <div className={styles.sectionLabel}>All sessions</div>
            {sessions.length===0 ? (
              <p style={{color:'#888',textAlign:'center',padding:'30px 0',fontSize:14}}>No sessions yet. Log your first one!</p>
            ) : sessions.map(s => {
              const exs = exercises.filter(e=>e.sessionId===s.id)
              const bc = BADGE_COLORS[s.type] || BADGE_COLORS.default
              return (
                <div key={s.id} className={styles.historyItem}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                    <div>
                      <span style={{display:'inline-block',padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:600,background:bc.bg,color:bc.color,marginBottom:4}}>{s.type}</span>
                      <div style={{fontSize:12,color:'#666'}}>
                        {fmtDate(s.date)} · {s.duration}min
                        <span style={{marginLeft:6}}>
                          <span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:rpeColor(s.rpe),marginRight:3,verticalAlign:'middle'}}></span>
                          RPE {s.rpe}
                        </span>
                      </div>
                      {s.notes && <div style={{fontSize:12,color:'#888',marginTop:2}}>{s.notes}</div>}
                    </div>
                  </div>
                  {exs.length>0 && (
                    <div style={{marginTop:6,display:'flex',flexWrap:'wrap',gap:4}}>
                      {exs.map((e,i) => (
                        <span key={i} style={{fontSize:11,background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:4,padding:'2px 7px',color:'#555'}}>
                          {e.name}{e.sets?` ${e.sets}×${e.reps}`:''}{e.kg?` @ ${e.kg}kg`:''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {tab==='progress' && (
          <div>
            <div className={styles.grid4} style={{marginBottom:12}}>
              {[
                {num:sessions.length,label:'Sessions'},
                {num:thisWeek,label:'This week'},
                {num:totalHrs,label:'Total time'},
                {num:avgRpe,label:'Avg effort'},
              ].map(s=>(
                <div key={s.label} className={styles.statCard}>
                  <div className={styles.statNum}>{s.num}</div>
                  <div className={styles.statLabel}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className={styles.card}>
              <div className={styles.sectionLabel}>8-week activity</div>
              <div style={{display:'flex',alignItems:'flex-end',gap:5,height:72,marginBottom:6}}>
                {weeks.map((w,i)=>(
                  <div key={i} style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
                    <div style={{background:'#111',opacity:w.count?0.15+(w.count/maxWeek)*0.75:0.07,borderRadius:'3px 3px 0 0',height:`${Math.max((w.count/maxWeek)*100,5)}%`}}></div>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',gap:5}}>
                {weeks.map((w,i)=>(
                  <div key={i} style={{flex:1,fontSize:10,color:'#aaa',textAlign:'center',overflow:'hidden',whiteSpace:'nowrap'}}>
                    {i===7?'Now':w.label.split(' ')[0]}
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.sectionLabel}>Strength progress</div>
              {Object.keys(byEx).length===0 ? (
                <p style={{color:'#888',fontSize:13}}>Log some strength sessions to see progress.</p>
              ) : Object.entries(byEx).sort((a,b)=>b[1].length-a[1].length).map(([name,sets])=>{
                const withKg=sets.filter(s=>s.kg>0)
                const best=withKg.length?withKg.reduce((a,b)=>b.kg>a.kg?b:a):null
                const trend=withKg.length>=2?(withKg[withKg.length-1].kg-withKg[0].kg):null
                return (
                  <div key={name} style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',padding:'9px 0',borderBottom:'1px solid #f0f0f0',fontSize:13}}>
                    <span style={{fontWeight:500}}>{name}</span>
                    <span style={{color:'#888',fontSize:12}}>
                      {sets.length} set{sets.length!==1?'s':''} logged
                      {best?` · best ${best.kg}kg × ${best.sets}×${best.reps}`:''}
                      {trend!==null&&trend!==0&&<span style={{color:trend>0?'#4a9e5c':'#E24B4A',marginLeft:5}}>{trend>0?'+':''}{trend}kg</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab==='coach' && (
          <div className={styles.card}>
            <div className={styles.sectionLabel}>AI coach</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:7,marginBottom:14}}>
              {[
                ['Plan my week','Plan my week — push/pull/legs/core split, pilates and cardio, 2–3 sessions. Be specific with exercises, sets and reps.'],
                ['Recovery check','How is my recovery looking based on my recent sessions?'],
                ['Strength progress','Show me my strength progress and where I should increase the weight.'],
                ['Next session','What should I focus on in my next session?'],
                ['Consistency','Am I being consistent enough for general health goals?'],
              ].map(([label,msg])=>(
                <button key={label} className={styles.btnGhost} onClick={()=>sendChat(msg)}>{label}</button>
              ))}
            </div>
            <div ref={chatRef} style={{display:'flex',flexDirection:'column',gap:10,maxHeight:400,overflowY:'auto',marginBottom:12}}>
              {chatHistory.length===0 && (
                <p style={{color:'#aaa',fontSize:13,textAlign:'center',padding:'20px 0'}}>Ask your coach anything — it knows your full training history.</p>
              )}
              {chatHistory.map((m,i)=>(
                <div key={i} style={{
                  padding:'10px 14px',borderRadius:12,fontSize:13,lineHeight:1.6,maxWidth:'90%',whiteSpace:'pre-wrap',wordBreak:'break-word',
                  background:m.role==='user'?'#f3f4f6':'#eff6ff',
                  color:m.role==='user'?'#111':'#1e3a5f',
                  alignSelf:m.role==='user'?'flex-end':'flex-start',
                  borderBottomRightRadius:m.role==='user'?4:12,
                  borderBottomLeftRadius:m.role==='user'?12:4,
                }}>
                  {m.content}
                </div>
              ))}
              {chatLoading && (
                <div style={{padding:'10px 14px',borderRadius:12,fontSize:13,background:'#f9fafb',color:'#aaa',alignSelf:'flex-start',fontStyle:'italic'}}>
                  Thinking…
                </div>
              )}
            </div>
            <div style={{display:'flex',gap:8}}>
              <input type="text" placeholder="Ask your coach…" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendChat()} style={{flex:1}} />
              <button className={styles.btnPrimary} onClick={()=>sendChat()} disabled={chatLoading}>Send</button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
