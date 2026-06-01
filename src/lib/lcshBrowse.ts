const BASE = 'https://id.loc.gov/authorities/subjects'
const NARROWER = 'http://www.w3.org/2004/02/skos/core#narrower'
const PREF_LABEL = 'http://www.w3.org/2004/02/skos/core#prefLabel'
const AUTH_LABEL = 'http://www.loc.gov/mads/rdf/v1#authoritativeLabel'

export interface LcshBrowseNode {
  id: string
  label: string
  narrowerIds: string[]
}

const cache = new Map<string, LcshBrowseNode>()

// Extract English label from JSON-LD concept object
function extractLabel(concept: Record<string, unknown>): string {
  const candidates = [
    ...((concept[PREF_LABEL] as { '@language'?: string; '@value'?: string }[] | undefined) ?? []),
    ...((concept[AUTH_LABEL] as { '@language'?: string; '@value'?: string }[] | undefined) ?? []),
  ]
  return candidates.find((c) => c['@language'] === 'en')?.['@value'] ?? ''
}

// Extract narrower IDs from JSON-LD concept object
function extractNarrower(concept: Record<string, unknown>): string[] {
  const arr = (concept[NARROWER] as { '@id'?: string }[] | undefined) ?? []
  return arr
    .map((n) => (n['@id'] ?? '').replace(`${BASE}/`, ''))
    .filter((id) => /^sh\d+$/.test(id))
}

export async function fetchLcshNode(id: string): Promise<LcshBrowseNode> {
  if (cache.has(id)) return cache.get(id)!
  const res = await fetch(`${BASE}/${id}.json`)
  if (!res.ok) throw new Error(`LCSH ${res.status} for ${id}`)
  const graph: Record<string, unknown>[] = await res.json()
  const uri = `${BASE}/${id}`
  const concept = graph.find((n) => n['@id'] === uri) ?? graph[0]
  const node: LcshBrowseNode = {
    id,
    label: extractLabel(concept),
    narrowerIds: extractNarrower(concept),
  }
  cache.set(id, node)
  return node
}

// Controlled concurrency pool
async function pool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = []
  const queue = [...tasks]
  async function worker() {
    while (queue.length) {
      const task = queue.shift()!
      results.push(await task())
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return results
}

export async function fetchLcshChildren(id: string): Promise<LcshBrowseNode[]> {
  const parent = await fetchLcshNode(id)
  if (parent.narrowerIds.length === 0) return []
  const tasks = parent.narrowerIds.map((cid) => () => fetchLcshNode(cid).catch(() => null))
  const results = await pool(tasks, 10)
  return (results.filter(Boolean) as LcshBrowseNode[]).sort((a, b) =>
    a.label.localeCompare(b.label)
  )
}

// Resolve a label to its LCSH ID via the suggest API
export async function resolveLcshId(label: string): Promise<string | null> {
  const url = `${BASE}/suggest/?q=${encodeURIComponent(label)}&count=10`
  const res = await fetch(url)
  if (!res.ok) return null
  const data: [string, string[], string[], string[]] = await res.json()
  const labels = data[1] ?? []
  const uris = data[3] ?? []
  // Prefer exact match without subdivision
  for (let i = 0; i < labels.length; i++) {
    if (labels[i].toLowerCase() === label.toLowerCase() && !labels[i].includes('--')) {
      return uris[i].replace(`${BASE}/`, '')
    }
  }
  // Fall back to first non-subdivision result
  for (let i = 0; i < labels.length; i++) {
    if (!labels[i].includes('--')) return uris[i].replace(`${BASE}/`, '')
  }
  return null
}

// 25 broad academic domains — labels only, IDs resolved lazily on first expand
export const LCSH_ROOTS: string[] = [
  'Anthropology',
  'Art',
  'Astronomy',
  'Biology',
  'Chemistry',
  'Computer science',
  'Economics',
  'Education',
  'Engineering',
  'Geography',
  'Geology',
  'History',
  'Language and languages',
  'Law',
  'Literature',
  'Mathematics',
  'Medicine',
  'Music',
  'Philosophy',
  'Physics',
  'Political science',
  'Psychology',
  'Religion',
  'Sociology',
  'Technology',
]
