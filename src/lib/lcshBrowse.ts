const BASE = 'https://id.loc.gov/authorities/subjects'
const NARROWER = 'http://www.w3.org/2004/02/skos/core#narrower'
const NARROWER_MADS = 'http://www.loc.gov/mads/rdf/v1#hasNarrowerAuthority'
const PREF_LABEL = 'http://www.w3.org/2004/02/skos/core#prefLabel'
const AUTH_LABEL = 'http://www.loc.gov/mads/rdf/v1#authoritativeLabel'

// Strip either http:// or https:// base and any #fragment
const stripBase = (uri: string) =>
  uri
    .replace(/^https?:\/\/id\.loc\.gov\/authorities\/subjects\//, '')
    .replace(/#.*$/, '')

const isValidId = (id: string) => /^s[hj]\d+$/.test(id)

export interface LcshBrowseNode {
  id: string
  label: string
  narrowerIds: string[]
}

const cache = new Map<string, LcshBrowseNode>()

function extractLabel(concept: Record<string, unknown>): string {
  const candidates = [
    ...((concept[PREF_LABEL] as { '@language'?: string; '@value'?: string }[] | undefined) ?? []),
    ...((concept[AUTH_LABEL] as { '@language'?: string; '@value'?: string }[] | undefined) ?? []),
  ]
  const en = candidates.find((c) => c['@language'] === 'en')?.['@value']
  if (en) return en
  if (typeof concept['label'] === 'string') return concept['label'] as string
  return ''
}

function extractNarrower(concept: Record<string, unknown>): string[] {
  const skos = (concept[NARROWER] as { '@id'?: string }[] | undefined) ?? []
  const mads = (concept[NARROWER_MADS] as { '@id'?: string }[] | undefined) ?? []
  const seen = new Set<string>()
  const ids: string[] = []
  for (const n of [...skos, ...mads]) {
    const id = stripBase(n['@id'] ?? '')
    if (isValidId(id) && !seen.has(id)) { seen.add(id); ids.push(id) }
  }
  return ids
}

export async function fetchLcshNode(id: string): Promise<LcshBrowseNode> {
  if (cache.has(id)) return cache.get(id)!
  const res = await fetch(`${BASE}/${id}.json`)
  if (!res.ok) throw new Error(`LCSH ${res.status} for ${id}`)
  const graph: Record<string, unknown>[] = await res.json()
  const concept =
    graph.find((n) => typeof n['@id'] === 'string' && (n['@id'] as string).endsWith(`/${id}`)) ??
    graph.find((n) => typeof n['@id'] === 'string' && (n['@id'] as string).includes(`/${id}#`)) ??
    graph.find((n) => Array.isArray(n['@type'])) ??
    graph[0]
  const node: LcshBrowseNode = {
    id,
    label: extractLabel(concept),
    narrowerIds: extractNarrower(concept),
  }
  cache.set(id, node)
  return node
}

// Parse N-Triples to get ALL narrower IDs — LoC .nt files are complete unlike JSON-LD
async function fetchNarrowerFromNTriples(id: string): Promise<string[]> {
  try {
    const res = await fetch(`${BASE}/${id}.nt`)
    if (!res.ok) return []
    const text = await res.text()
    const ids: string[] = []
    const seen = new Set<string>()
    for (const line of text.split('\n')) {
      if (!line.includes(id)) continue
      if (!line.includes('narrower') && !line.includes('hasNarrowerAuthority')) continue
      // N-Triple: <subject> <predicate> <object> .
      const m = line.match(/<([^>]+)>\s+<[^>]+(?:narrower|hasNarrowerAuthority)[^>]*>\s+<([^>]+)>/)
      if (!m) continue
      if (!m[1].includes(`/${id}`)) continue // subject must be our concept
      const narrowerId = stripBase(m[2])
      if (isValidId(narrowerId) && !seen.has(narrowerId)) {
        seen.add(narrowerId)
        ids.push(narrowerId)
      }
    }
    return ids
  } catch {
    return []
  }
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
  // Strategy 1: N-Triples — complete narrower list, no truncation
  const ntIds = await fetchNarrowerFromNTriples(id)
  if (ntIds.length > 0) {
    const tasks = ntIds.map((cid) => () => fetchLcshNode(cid).catch(() => null))
    const results = await pool(tasks, 10)
    return (results.filter(Boolean) as LcshBrowseNode[]).sort((a, b) =>
      a.label.localeCompare(b.label)
    )
  }

  // Strategy 2: JSON-LD inline narrower list (works for smaller concepts)
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
  for (let i = 0; i < labels.length; i++) {
    if (labels[i].toLowerCase() === label.toLowerCase() && !labels[i].includes('--')) {
      return stripBase(uris[i])
    }
  }
  for (let i = 0; i < labels.length; i++) {
    if (!labels[i].includes('--')) return stripBase(uris[i])
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
