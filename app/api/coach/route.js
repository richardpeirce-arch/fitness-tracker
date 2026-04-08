import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request) {
  try {
    const { messages, systemPrompt } = await request.json()

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    })

    return Response.json({ content: response.content[0].text })
  } catch (error) {
    console.error('Claude API error:', error)
    return Response.json({ error: 'Failed to get response' }, { status: 500 })
  }
}
