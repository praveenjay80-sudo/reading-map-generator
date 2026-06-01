const BASE = 'https://id.loc.gov/authorities/subjects'
const NARROWER = 'http://www.w3.org/2004/02/skos/core#narrower'
const NARROWER_MADS = 'http://www.loc.gov/mads/rdf/v1#hasNarrowerAuthority'
const PREF_LABEL = 'http://www.w3.org/2004/02/skos/core#prefLabel'
const AUTH_LABEL = 'http://www.loc.gov/mads/rdf/v1#authoritativeLabel'

// Strip either http:// or https:// base and any #concept fragment
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
  // plain string label (search result format)
  if (typeof concept['label'] === 'string') return concept['label']
  return ''
}

function extractNarrower(concept: Record<string, unknown>): string[] {
  const skos = (concept[NARROWER] as { '@id'?: string }[] | undefined) ?? []
  const mads = (concept[NARROWER_MADS] as { '@id'?: string }[] | undefined) ?? []
  const seen = new Set<string>()
  const ids: string[] = []
  for (const n of [...skos, ...mads]) {
    const id = stripBase(n['@id'] ?? '')
    if (isValidId(id) && !seen.has(id)) {
      seen.add(id)
      ids.push(id)
    }
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

// Search-based children: queries LoC Solr for all concepts with this broader URI.
// Used as primary source because the JSON-LD files truncate large narrower lists.
async function fetchNarrowerBySearch(id: string): Promise<LcshBrowseNode[] | null> {
  try {
    const broaderUri = `http://id.loc.gov/authorities/subjects/${id}`
    const url = `${BASE}.json?q=broader%3A%22${encodeURIComponent(broaderUri)}%22&count=200`
    const res = await fetch(url)
    if (!res.ok) return null
    const data: unknown = await res.json()
    // LoC returns a JSON-LD array for list queries
    const list: Record<string, unknown>[] = Array.isArray(data) ? data : []
    const nodes: LcshBrowseNode[] = []
    for (const item of list) {
      const rawId =
        typeof item['@id'] === 'string'
          ? stripBase(item['@id'])
          : typeof item['uri'] === 'string'
          ? stripBase(item['uri'] as string)
          : ''
      if (!isValidId(rawId)) continue
      const label = extractLabel(item)
      if (!label) continue
      nodes.push({ id: rawId, label, narrowerIds: [] })
    }
    return nodes.length > 0 ? nodes.sort((a, b) => a.label.localeCompare(b.label)) : null
  } catch {
    return null
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
  // Try search-based approach first (handles broad subjects with many children)
  const searchResults = await fetchNarrowerBySearch(id)
  if (searchResults && searchResults.length > 0) return searchResults

  // Fall back to JSON-LD inline narrower list
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
