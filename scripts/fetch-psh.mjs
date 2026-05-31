// Fetches all PSH taxonomy concepts and writes src/data/psh-taxonomy.json
// Run once: node scripts/fetch-psh.mjs
import { writeFileSync, mkdirSync } from 'fs'

const API = 'https://psh.techlib.cz/api/concepts'
const out = []

const firstRes = await fetch(`${API}?format=enriched&page=1`)
const firstData = await firstRes.json()
const totalPages = firstData.info?.['Max results page'] ?? 142
console.log(`Total pages: ${totalPages}`)

function processConcepts(concepts) {
  for (const c of concepts) {
    const label = c.prefLabel?.en ?? c.prefLabel?.cs ?? ''
    if (!label || !c.pshid) continue
    const broader = typeof c.broader === 'string' ? c.broader.trim() : ''
    out.push({ id: c.pshid, l: label, b: broader })
  }
}

processConcepts(firstData['@graph'] ?? [])
console.log(`Page 1/${totalPages} — ${out.length} concepts`)

// Fetch remaining pages in batches of 10 for speed
const BATCH = 10
for (let start = 2; start <= totalPages; start += BATCH) {
  const pages = []
  for (let p = start; p < start + BATCH && p <= totalPages; p++) pages.push(p)
  const results = await Promise.all(
    pages.map((p) => fetch(`${API}?format=enriched&page=${p}`).then((r) => r.json()))
  )
  for (const data of results) processConcepts(data['@graph'] ?? [])
  console.log(`Page ${Math.min(start + BATCH - 1, totalPages)}/${totalPages} — ${out.length} concepts`)
}

mkdirSync('src/data', { recursive: true })
writeFileSync('src/data/psh-taxonomy.json', JSON.stringify(out))
console.log(`\nDone! ${out.length} concepts → src/data/psh-taxonomy.json`)
