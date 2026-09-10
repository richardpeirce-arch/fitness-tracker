import Anthropic from '@anthropic-ai/sdk'

const apiKey = process.env.ANTHROPIC_API_KEY
const client = new Anthropic({ apiKey })

export async function POST(request) {
  const diag = {
    keyPresent: Boolean(apiKey),
    keyPrefix: apiKey ? apiKey.slice(0, 13) : null,
    keyLength: apiKey ? apiKey.length : 0,
    sdkVersion: Anthropic.VERSION || null,
  }
  try {
    const { messages, systemPrompt } = await request.json()

    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    })

    const text = response?.content?.[0]?.text
    if (!text) {
      return Response.json(
        { ...diag, error: 'No text in response', raw: JSON.stringify(response).slice(0, 900) },
        { status: 502 }
      )
    }
    return Response.json({ content: text })
  } catch (error) {
    console.error('Claude API error:', error)
    return Response.json({
      ...diag,
      error: 'Failed to get response',
      detail: error?.message || String(error),
      apiStatus: error?.status ?? null,
      errName: error?.name ?? null,
    }, { status: 500 })
  }
}
