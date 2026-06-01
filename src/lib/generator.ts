import type { ReadingMap, LearnerProfile, Book, PathNode } from '../types'

async function callClaude(apiKey: string, system: string, userMessage: string): Promise<string> {
  if (!apiKey) throw new Error('No API key set.')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Anthropic API error ${res.status}: ${text}`)
  }

  const data = await res.json() as { content: { type: string; text: string }[]; stop_reason?: string }
  if (data.stop_reason === 'max_tokens') {
    throw new Error('The reading map was too large to generate completely. Try a narrower topic or set your goal to "survey".')
  }
  return data.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
}

function buildSystemPrompt(): string {
  return `You are an expert academic librarian and curriculum designer. Generate comprehensive reading maps as structured JSON.

You produce reading maps that represent the TRUE knowledge graph of a field. You know which books are genuinely foundational vs supplementary. You flag genuine community controversies. You know which editions matter.

RULES:
- Be honest about difficulty. Do not underestimate math intensity.
- Include 8-20 books depending on topic scope and learner goal.
- Assign realistic time estimates (weeks per book at ~10hrs/week).
- Identify the true critical path - minimum books to functional competence.
- Track parallel paths (theory vs applied) when they exist.
- Flag books genuinely contested in the community.
- Include at least 2 field dependencies for any non-trivial topic.
- Position nodes: x increases left-to-right with time (0-1200), y separates tracks (0-800).

Return ONLY valid JSON. No prose, no markdown fences.`
}

function buildUserPrompt(topic: string, profile: LearnerProfile): string {
  const goalDesc: Record<string, string> = {
    survey: 'broad understanding',
    research: 'reach the research frontier',
    applied: 'practical competence',
    teaching: 'ability to explain and teach',
  }
  const levelDesc: Record<string, string> = {
    novice: 'complete beginner',
    intermediate: 'some background',
    advanced: 'strong background',
  }
  return `Generate a complete academic reading map for: "${topic}"

LEARNER PROFILE:
- Level: ${profile.level} (${levelDesc[profile.level]})
- Goal: ${profile.goal} (${goalDesc[profile.goal]})
- Time: ${profile.timeHorizon} | Mode: ${profile.pathMode}
- Prior fields: ${profile.priorFields.join(', ') || 'none'}
- Free only: ${profile.freeOnly}

Return JSON with this EXACT structure:
{
  "id": "unique-slug",
  "topic": "TOPIC",
  "summary": "2-3 sentence overview",
  "estimatedTotalWeeks": 0,
  "criticalPath": ["book-id-1", "book-id-2"],
  "books": [{
    "id": "unique-slug",
    "title": "Full Title",
    "author": "Author Name",
    "year": 2000,
    "tier": "foundational|core|optional|advanced|paper",
    "difficulty": 3,
    "mathIntensity": 3,
    "estimatedWeeks": 4,
    "prerequisites": ["book-id"],
    "unlocks": ["book-id"],
    "availability": "free|paid|open-access|libgen",
    "url": null,
    "description": "2-3 sentences",
    "whyRead": "one sentence pitch",
    "skipIf": ["condition"],
    "tags": ["tag"],
    "controversyNote": null,
    "editionNote": null,
    "alternativeTo": null
  }],
  "tracks": [{
    "id": "track-slug",
    "name": "Track Name",
    "type": "theory|applied|historical|computational",
    "description": "what this covers",
    "bookIds": ["book-id"],
    "color": "#3b82f6"
  }],
  "nodes": [{
    "bookId": "book-id",
    "position": { "x": 100, "y": 100 },
    "isCriticalPath": true,
    "isBottleneck": false,
    "isUnlocked": true
  }],
  "edges": [{
    "id": "edge-id",
    "source": "book-id",
    "target": "book-id",
    "type": "prerequisite|recommended|parallel"
  }],
  "fieldDependencies": [{
    "field": "Field Name",
    "reason": "why you need this",
    "keyBooks": ["classic book title"]
  }]
}`
}

export async function generateReadingMap(
  apiKey: string,
  topic: string,
  profile: LearnerProfile,
  onStep: (step: string) => void,
): Promise<ReadingMap> {
  onStep('Analysing topic structure...')
  const rawText = await callClaude(apiKey, buildSystemPrompt(), buildUserPrompt(topic, profile))

  onStep('Parsing knowledge graph...')

  // Extract the JSON object regardless of surrounding prose or code fences
  const start = rawText.indexOf('{')
  const end = rawText.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`No JSON found in response. Got: ${rawText.slice(0, 200)}`)
  }
  const cleaned = rawText.slice(start, end + 1)

  let parsed: Omit<ReadingMap, 'profile' | 'generatedAt'>
  try {
    parsed = JSON.parse(cleaned)
  } catch (e) {
    throw new Error(`JSON parse failed: ${e instanceof Error ? e.message : String(e)}\n\nResponse started with: ${rawText.slice(0, 300)}`)
  }

  onStep('Building reading paths...')
  const map: ReadingMap = {
    ...parsed,
    id: parsed.id ?? crypto.randomUUID(),
    profile,
    generatedAt: new Date().toISOString(),
    books: (parsed.books ?? []).map((b: Book) => ({
      ...b,
      prerequisites: b.prerequisites ?? [],
      unlocks: b.unlocks ?? [],
      tags: b.tags ?? [],
      skipIf: b.skipIf ?? [],
    })),
    tracks: parsed.tracks ?? [],
    nodes: (parsed.nodes ?? []).map((n: PathNode) => ({ ...n, isUnlocked: true })),
    edges: parsed.edges ?? [],
    fieldDependencies: parsed.fieldDependencies ?? [],
    criticalPath: parsed.criticalPath ?? [],
  }
  onStep('Ready')
  return map
}

export async function explainBook(apiKey: string, book: Book, topic: string, trackName?: string): Promise<string> {
  const system = `You explain academic books and papers to curious students in plain, friendly language — like a smart older sibling, not a textbook. No jargon unless you immediately explain it. Keep responses under 180 words.`

  const resourceType = book.tier === 'paper' ? 'research paper' : 'book'
  const trackLine = trackName ? ` It's part of the "${trackName}" specialization.` : ''

  const prompt = `I'm studying "${topic}" and I'm considering reading:

"${book.title}" by ${book.author} (${book.year}) — ${book.tier} ${resourceType}.${trackLine}

In plain school-level language, tell me:
1. What will I actually be able to DO or UNDERSTAND after reading this that I couldn't before?
2. What's the single most important idea it teaches?
3. Is there anything tricky or surprising about it I should know going in?

Be direct and concrete. Speak to me as "you". No bullet points — just flowing sentences.`

  return callClaude(apiKey, system, prompt)
}

export function exportToMarkdown(map: ReadingMap): string {
  const tierEmoji: Record<string, string> = {
    foundational: '🧱', core: '📘', optional: '📗', advanced: '🔬', paper: '📄',
  }
  const lines: string[] = [
    `# Reading Map: ${map.topic}`, '', `> ${map.summary}`, '',
    `**Generated:** ${new Date(map.generatedAt).toLocaleDateString()}`,
    `**Level:** ${map.profile.level} | **Goal:** ${map.profile.goal} | **Estimated:** ${map.estimatedTotalWeeks} weeks`,
    '', '---', '', '## Critical Path', '',
  ]
  map.criticalPath.forEach((id, i) => {
    const book = map.books.find((b) => b.id === id)
    if (book) lines.push(`${i + 1}. **${book.title}** - ${book.author} (${book.year})`)
  })
  lines.push('', '---', '', '## All Books', '')
  for (const book of map.books) {
    lines.push(`### ${tierEmoji[book.tier]} ${book.title}`)
    lines.push(`*${book.author}, ${book.year}* - ${book.tier} - ~${book.estimatedWeeks}w`)
    lines.push('', book.description, '', `**Why read:** ${book.whyRead}`)
    if (book.url) lines.push(`**Link:** ${book.url}`)
    if (book.controversyNote) lines.push(`**Note:** ${book.controversyNote}`)
    lines.push('')
  }
  if (map.fieldDependencies.length > 0) {
    lines.push('---', '', '## Field Dependencies', '')
    for (const dep of map.fieldDependencies) lines.push(`- **${dep.field}:** ${dep.reason}`)
  }
  return lines.join('\n')
}
