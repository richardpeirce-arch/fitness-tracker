const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'
const KEY = process.env.GOOGLE_SHEETS_API_KEY
const SHEET_ID = process.env.GOOGLE_SPREADSHEET_ID

async function appendRow(sheetName, values) {
  const url = `${SHEETS_API}/${SHEET_ID}/values/${sheetName}!A1:append?valueInputOption=USER_ENTERED&key=${KEY}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [values] }),
  })
  if (!res.ok) throw new Error(`Sheets error: ${res.status}`)
  return res.json()
}

async function getRows(sheetName) {
  const url = `${SHEETS_API}/${SHEET_ID}/values/${sheetName}!A1:Z1000?key=${KEY}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Sheets read error: ${res.status}`)
  const data = await res.json()
  return data.values || []
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { action, session, exercise } = body

    if (action === 'saveSession') {
      const s = session
      await appendRow('Sessions', [s.id, s.date, s.type, s.duration, s.rpe, s.notes || '', s.dist || '', s.hr || ''])
      return Response.json({ ok: true })
    }

    if (action === 'saveExercise') {
      const e = exercise
      await appendRow('Exercises', [e.sessionId, e.date, e.name, e.sets, e.reps, e.kg])
      return Response.json({ ok: true })
    }

    if (action === 'getSessions') {
      const rows = await getRows('Sessions')
      const sessions = rows.map(r => ({
        id: r[0], date: r[1], type: r[2], duration: +r[3],
        rpe: r[4], notes: r[5] || '', dist: r[6] || '', hr: r[7] || '',
      }))
      return Response.json({ sessions: sessions.reverse() })
    }

    if (action === 'getExercises') {
      const rows = await getRows('Exercises')
      const exercises = rows.map(r => ({
        sessionId: r[0], date: r[1], name: r[2],
        sets: +r[3], reps: +r[4], kg: +r[5],
      }))
      return Response.json({ exercises })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Sheets API error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
