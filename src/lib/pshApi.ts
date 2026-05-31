const API_BASE = 'https://psh.techlib.cz/api/concepts'

export interface PshNode {
  id: string
  label: string
  narrower: string[]
}

const cache = new Map<string, PshNode>()

export async function fetchPshConcept(id: string): Promise<PshNode> {
  if (cache.has(id)) return cache.get(id)!
  const res = await fetch(`${API_BASE}/${id}?format=enriched`)
  if (!res.ok) throw new Error(`PSH API error ${res.status}`)
  const data = await res.json()
  const g = data['@graph']
  const narrower: string[] = Array.isArray(g.narrower)
    ? g.narrower
    : g.narrower
    ? [g.narrower]
    : []
  const node: PshNode = {
    id: g.pshid ?? id,
    label: g.prefLabel?.en ?? g.prefLabel?.cs ?? id,
    narrower,
  }
  cache.set(id, node)
  return node
}

export async function fetchPshChildren(id: string): Promise<PshNode[]> {
  const parent = await fetchPshConcept(id)
  if (parent.narrower.length === 0) return []
  const children = await Promise.all(parent.narrower.map(fetchPshConcept))
  return children.sort((a, b) => a.label.localeCompare(b.label))
}

// 44 top-level PSH categories (hardcoded — these are the roots, broader = "")
export const PSH_TOP_LEVEL: PshNode[] = [
  { id: 'PSH13220', label: 'Agriculture', narrower: [] },
  { id: 'PSH1',     label: 'Anthropology', narrower: [] },
  { id: 'PSH116',   label: 'Architecture and Town Planning', narrower: [] },
  { id: 'PSH11591', label: 'Art', narrower: [] },
  { id: 'PSH320',   label: 'Astronomy', narrower: [] },
  { id: 'PSH573',   label: 'Biology', narrower: [] },
  { id: 'PSH5450',  label: 'Chemistry', narrower: [] },
  { id: 'PSH10355', label: 'Civil Engineering', narrower: [] },
  { id: 'PSH9759',  label: 'Communications', narrower: [] },
  { id: 'PSH12314', label: 'Computer Technology', narrower: [] },
  { id: 'PSH10067', label: 'Consumer Industry', narrower: [] },
  { id: 'PSH1217',  label: 'Economic Sciences', narrower: [] },
  { id: 'PSH1781',  label: 'Electronics', narrower: [] },
  { id: 'PSH2086',  label: 'Electrotechnics', narrower: [] },
  { id: 'PSH8613',  label: 'Food Industry', narrower: [] },
  { id: 'PSH7979',  label: 'Generalities', narrower: [] },
  { id: 'PSH4231',  label: 'Geography', narrower: [] },
  { id: 'PSH4439',  label: 'Geology', narrower: [] },
  { id: 'PSH3768',  label: 'Geophysics', narrower: [] },
  { id: 'PSH12577', label: 'Health Services', narrower: [] },
  { id: 'PSH5042',  label: 'History', narrower: [] },
  { id: 'PSH6548',  label: 'Informatics', narrower: [] },
  { id: 'PSH6445',  label: 'Information Science', narrower: [] },
  { id: 'PSH8808',  label: 'Law', narrower: [] },
  { id: 'PSH6641',  label: 'Linguistics', narrower: [] },
  { id: 'PSH6914',  label: 'Literature', narrower: [] },
  { id: 'PSH7093',  label: 'Mathematics', narrower: [] },
  { id: 'PSH10652', label: 'Mechanical Engineering', narrower: [] },
  { id: 'PSH5176',  label: 'Metallurgy', narrower: [] },
  { id: 'PSH12156', label: 'Military Affairs', narrower: [] },
  { id: 'PSH11453', label: 'Mining Engineering', narrower: [] },
  { id: 'PSH8126',  label: 'Pedagogy', narrower: [] },
  { id: 'PSH2596',  label: 'Philosophy', narrower: [] },
  { id: 'PSH2910',  label: 'Physics', narrower: [] },
  { id: 'PSH8308',  label: 'Politology', narrower: [] },
  { id: 'PSH2395',  label: 'Power Engineering', narrower: [] },
  { id: 'PSH9194',  label: 'Psychology', narrower: [] },
  { id: 'PSH7769',  label: 'Religion', narrower: [] },
  { id: 'PSH11939', label: 'Science and Technology', narrower: [] },
  { id: 'PSH9508',  label: 'Sociology', narrower: [] },
  { id: 'PSH9899',  label: 'Sport', narrower: [] },
  { id: 'PSH11322', label: 'Systems Theory', narrower: [] },
  { id: 'PSH1038',  label: 'Transport', narrower: [] },
  { id: 'PSH12008', label: 'Water Management', narrower: [] },
]
