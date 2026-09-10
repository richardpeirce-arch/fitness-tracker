import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request) {
  try {
    const { messages, systemPrompt } = await request.json()

    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    })

    const text = response.content.find(block => block.type === 'text')?.text
    if (!text) {
      return Response.json({ error: 'No response text' }, { status: 502 })
    }

    return Response.json({ content: text })
  } catch (error) {
    console.error('Claude API error:', error)
    return Response.json({ error: 'Failed to get response' }, { status: 500 })
  }
}
