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
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A1:Z1000`,
  })
  return res.data.values || []
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { action, session, exercise } = body
    const sheets = await getSheets()

    if (action === 'saveSession') {
      const s = session
      await appendRow(sheets, 'Sessions', [s.id, s.date, s.type, s.duration, s.rpe, s.notes || '', s.dist || '', s.hr || ''])
      return Response.json({ ok: true })
    }

    if (action === 'saveExercise') {
      const e = exercise
      await appendRow(sheets, 'Exercises', [e.sessionId, e.date, e.name, e.sets, e.reps, e.kg])
      return Response.json({ ok: true })
    }

    if (action === 'getSessions') {
      const rows = await getRows(sheets, 'Sessions')
      const sessions = rows.map(r => ({
        id: r[0], date: r[1], type: r[2], duration: +r[3],
        rpe: r[4], notes: r[5] || '', dist: r[6] || '', hr: r[7] || '',
      }))
      return Response.json({ sessions: sessions.reverse() })
    }

    if (action === 'getExercises') {
      const rows = await getRows(sheets, 'Exercises')
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
