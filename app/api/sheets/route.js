import { google } from 'googleapis'

const SHEET_ID = process.env.GOOGLE_SPREADSHEET_ID

async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return google.sheets({ version: 'v4', auth })
}

async function appendRow(sheets, sheetName, values) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  })
}

async function getRows(sheets, sheetName) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${sheetName}!A1:Z1000`,
    })
    return res.data.values || []
  } catch { return [] }
}

async function clearAndWrite(sheets, sheetName, values) {
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A1:Z1000`,
  })
  if (values.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { action } = body
    const sheets = await getSheets()

    if (action === 'saveSession') {
      const s = body.session
      await appendRow(sheets, 'Sessions', [s.id, s.date, s.name || '', s.duration, s.rpe, s.notes || '', s.type || 'Strength'])
      return Response.json({ ok: true })
    }

    if (action === 'getSessions') {
      const rows = await getRows(sheets, 'Sessions')
      const sessions = rows.map(r => ({
        id: r[0], date: r[1], name: r[2] || '', duration: +r[3],
        rpe: r[4], notes: r[5] || '', type: r[6] || 'Strength',
      }))
      return Response.json({ sessions: sessions.reverse() })
    }

    if (action === 'saveExercise') {
      const e = body.exercise
      await appendRow(sheets, 'Exercises', [e.sessionId, e.date, e.category, e.name, e.sets, e.reps, e.kg, e.rpe || ''])
      return Response.json({ ok: true })
    }

    if (action === 'getExercises') {
      const rows = await getRows(sheets, 'Exercises')
      const exercises = rows.map(r => ({
        sessionId: r[0], date: r[1], category: r[2], name: r[3],
        sets: +r[4], reps: +r[5], kg: +r[6], rpe: r[7] || '',
      }))
      return Response.json({ exercises })
    }

    if (action === 'saveCardio') {
      const c = body.cardio
      await appendRow(sheets, 'Cardio', [c.sessionId, c.date, c.type, c.duration, c.distance || '', c.hr || ''])
      return Response.json({ ok: true })
    }

    if (action === 'getCardio') {
      const rows = await getRows(sheets, 'Cardio')
      const cardio = rows.map(r => ({
        sessionId: r[0], date: r[1], type: r[2], duration: +r[3],
        distance: r[4] || '', hr: r[5] || '',
      }))
      return Response.json({ cardio })
    }

    if (action === 'saveReflection') {
      const r = body.reflection
      await appendRow(sheets, 'Reflections', [r.sessionId, r.date, r.energy, r.sleep, r.stress, r.notes || ''])
      return Response.json({ ok: true })
    }

    if (action === 'getReflections') {
      const rows = await getRows(sheets, 'Reflections')
      const reflections = rows.map(r => ({
        sessionId: r[0], date: r[1], energy: +r[2], sleep: +r[3], stress: +r[4], notes: r[5] || '',
      }))
      return Response.json({ reflections })
    }

    if (action === 'saveProfile') {
      const p = body.profile
      await clearAndWrite(sheets, 'Profile', [[p.age, p.experience, p.injuries, p.goals, p.notes]])
      return Response.json({ ok: true })
    }

    if (action === 'getProfile') {
      const rows = await getRows(sheets, 'Profile')
      if (!rows.length) return Response.json({ profile: null })
      const r = rows[0]
      return Response.json({ profile: { age: r[0], experience: r[1], injuries: r[2], goals: r[3], notes: r[4] } })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Sheets API error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
