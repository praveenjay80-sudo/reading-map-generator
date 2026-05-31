// Crawls the full PSH taxonomy via individual concept lookups (BFS from 44 root IDs).
// The /api/concepts list endpoint always returns the same first 100 records —
// we must fetch each concept individually starting from known roots.
// Run: node scripts/fetch-psh.mjs
import { writeFileSync, mkdirSync } from 'fs'

const API = 'https://psh.techlib.cz/api/concepts'
const CONCURRENCY = 20

const ROOT_IDS = [
  'PSH13220','PSH1','PSH116','PSH11591','PSH320','PSH573','PSH5450',
  'PSH10355','PSH9759','PSH12314','PSH10067','PSH1217','PSH1781','PSH2086',
  'PSH8613','PSH7979','PSH4231','PSH4439','PSH3768','PSH12577','PSH5042',
  'PSH6548','PSH6445','PSH8808','PSH6641','PSH6914','PSH7093','PSH10652',
  'PSH5176','PSH12156','PSH11453','PSH8126','PSH2596','PSH2910','PSH8308',
  'PSH2395','PSH9194','PSH7769','PSH11939','PSH9508','PSH9899','PSH11322',
  'PSH1038','PSH12008',
]

async function fetchConcept(id) {
  const res = await fetch(`${API}/${id}?format=enriched`)
  if (!res.ok) throw new Error(`${res.status} for ${id}`)
  const data = await res.json()
  const g = data['@graph']
  const label = g.prefLabel?.en ?? g.prefLabel?.cs ?? id
  const narrower = Array.isArray(g.narrower) ? g.narrower
    : g.narrower ? [g.narrower] : []
  const broader = typeof g.broader === 'string' ? g.broader.trim() : ''
  return { id, l: label, b: broader, narrower }
}

async function runPool(ids, worker, concurrency) {
  const queue = [...ids]
  const results = []
  async function next() {
    while (queue.length) {
      const id = queue.shift()
      try { results.push(await worker(id)) }
      catch (e) { console.error(`  skip ${id}: ${e.message}`) }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next))
  return results
}

// BFS
const visited = new Set()
const out = []
let frontier = [...ROOT_IDS]

while (frontier.length) {
  const toFetch = frontier.filter((id) => !visited.has(id))
  for (const id of toFetch) visited.add(id)
  if (!toFetch.length) break

  console.log(`Fetching ${toFetch.length} concepts (total so far: ${out.length})...`)
  const results = await runPool(toFetch, fetchConcept, CONCURRENCY)

  const nextFrontier = []
  for (const node of results) {
    out.push({ id: node.id, l: node.l, b: node.b })
    for (const child of node.narrower) {
      if (!visited.has(child)) nextFrontier.push(child)
    }
  }
  frontier = nextFrontier
}

mkdirSync('src/data', { recursive: true })
writeFileSync('src/data/psh-taxonomy.json', JSON.stringify(out))
console.log(`\nDone! ${out.length} unique concepts → src/data/psh-taxonomy.json`)
