const BASE = 'https://id.loc.gov/authorities/subjects'
const NARROWER = 'http://www.w3.org/2004/02/skos/core#narrower'
const NARROWER_MADS = 'http://www.loc.gov/mads/rdf/v1#hasNarrowerAuthority'
const PREF_LABEL = 'http://www.w3.org/2004/02/skos/core#prefLabel'
const AUTH_LABEL = 'http://www.loc.gov/mads/rdf/v1#authoritativeLabel'

// LoC JSON-LD uses http:// URIs; strip either scheme
const stripBase = (uri: string) =>
  uri.replace(/^https?:\/\/id\.loc\.gov\/authorities\/subjects\//, '')

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
  return candidates.find((c) => c['@language'] === 'en')?.['@value'] ?? ''
}

function extractNarrower(concept: Record<string, unknown>): string[] {
  // LoC exposes narrower via both skos:narrower and madsrdf:hasNarrowerAuthority
  const skos = (concept[NARROWER] as { '@id'?: string }[] | undefined) ?? []
  const mads = (concept[NARROWER_MADS] as { '@id'?: string }[] | undefined) ?? []
  const seen = new Set<string>()
  const ids: string[] = []
  for (const n of [...skos, ...mads]) {
    const id = stripBase(n['@id'] ?? '')
    // Accept sh and sj prefixes (sj = children's subject headings)
    if (/^s[hj]\d+$/.test(id) && !seen.has(id)) {
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
  // LoC JSON-LD @id values use http://, so match by id suffix rather than full URI
  const concept =
    graph.find((n) => typeof n['@id'] === 'string' && (n['@id'] as string).endsWith(`/${id}`)) ??
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
      return stripBase(uris[i])
    }
  }
  // Fall back to first non-subdivision result
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
