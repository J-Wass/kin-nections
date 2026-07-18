import type { Family, FamilyStatus, Person, Sex, Tree } from '../model/types'
import { createEmptyTree } from '../model/types'

interface GedcomLine {
  level: number
  xref?: string
  tag: string
  value?: string
}

interface GedcomNode {
  tag: string
  xref?: string
  value?: string
  children: GedcomNode[]
}

const LINE_RE = /^(\d+)\s+(?:@([^@]+)@\s+)?([A-Za-z0-9_]+)(?:\s(.*))?$/

function parseLines(text: string): GedcomLine[] {
  return text
    .split(/\r?\n/)
    .map((raw) => raw.trim())
    .filter((line) => line.length > 0)
    .map((line): GedcomLine | null => {
      const match = LINE_RE.exec(line)
      if (!match) return null
      const [, levelStr, xref, tag, value] = match
      return { level: Number(levelStr), xref, tag, value }
    })
    .filter((line): line is GedcomLine => line !== null)
}

function buildTree(lines: GedcomLine[]): GedcomNode[] {
  const roots: GedcomNode[] = []
  const stack: { level: number; node: GedcomNode }[] = []

  for (const line of lines) {
    const node: GedcomNode = { tag: line.tag, xref: line.xref, value: line.value, children: [] }
    while (stack.length > 0 && stack[stack.length - 1].level >= line.level) stack.pop()
    if (stack.length === 0) {
      roots.push(node)
    } else {
      stack[stack.length - 1].node.children.push(node)
    }
    stack.push({ level: line.level, node })
  }
  return roots
}

function child(node: GedcomNode, tag: string): GedcomNode | undefined {
  return node.children.find((c) => c.tag === tag)
}

function childrenOf(node: GedcomNode, tag: string): GedcomNode[] {
  return node.children.filter((c) => c.tag === tag)
}

function noteText(node: GedcomNode): string {
  const lines: string[] = []
  if (node.value) lines.push(node.value)
  for (const sub of node.children) {
    if (sub.tag === 'CONT') lines.push(sub.value ?? '')
    else if (sub.tag === 'CONC' && lines.length > 0) lines[lines.length - 1] += sub.value ?? ''
  }
  return lines.join('\n')
}

function parseSex(value: string | undefined): Sex {
  if (value === 'M') return 'M'
  if (value === 'F') return 'F'
  return 'unknown'
}

function parsePerson(node: GedcomNode): Person {
  const id = node.xref ?? ''
  const nameNode = child(node, 'NAME')
  let firstName = ''
  let lastName = ''
  if (nameNode?.value) {
    const match = /^([^/]*)\/([^/]*)\/?/.exec(nameNode.value)
    if (match) {
      firstName = match[1].trim()
      lastName = match[2].trim()
    } else {
      firstName = nameNode.value.trim()
    }
  }

  const birt = child(node, 'BIRT')
  const deat = child(node, 'DEAT')
  const noteNode = child(node, 'NOTE')

  return {
    id,
    firstName,
    lastName,
    nickname: child(node, 'NICK')?.value,
    sex: parseSex(child(node, 'SEX')?.value),
    birthDate: birt ? child(birt, 'DATE')?.value : undefined,
    birthPlace: birt ? child(birt, 'PLAC')?.value : undefined,
    deathDate: deat ? child(deat, 'DATE')?.value : undefined,
    isLiving: !deat,
    notes: noteNode ? noteText(noteNode) : '',
  }
}

function parseFamilyStatus(node: GedcomNode): FamilyStatus {
  if (child(node, 'DIV')) return 'divorced'
  if (child(node, 'MARR')) return 'married'
  return 'unknown'
}

function stripPointer(value: string | undefined): string | undefined {
  return value?.replace(/^@|@$/g, '')
}

function parseFamily(node: GedcomNode): Family {
  const id = node.xref ?? ''
  const husb = stripPointer(child(node, 'HUSB')?.value)
  const wife = stripPointer(child(node, 'WIFE')?.value)
  const partners: Family['partners'] = []
  if (husb) partners.push({ personId: husb, role: 'spouse' })
  if (wife) partners.push({ personId: wife, role: 'spouse' })

  const children = childrenOf(node, 'CHIL')
    .map((c) => stripPointer(c.value))
    .filter((v): v is string => Boolean(v))

  return { id, partners, status: parseFamilyStatus(node), children }
}

export function parseGedcom(text: string, treeName = 'Imported tree'): Tree {
  const nodes = buildTree(parseLines(text))
  const tree = createEmptyTree(`tree_${Date.now()}`, treeName)

  for (const node of nodes) {
    if (node.tag === 'INDI' && node.xref) {
      const person = parsePerson(node)
      tree.people[person.id] = person
    } else if (node.tag === 'FAM' && node.xref) {
      const family = parseFamily(node)
      tree.families[family.id] = family
    }
  }

  return tree
}
