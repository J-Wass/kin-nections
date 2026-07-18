import type { Tree } from '../model/types'

function xref(id: string): string {
  return `@${id}@`
}

function nameLine(firstName: string, lastName: string): string {
  return `${firstName} /${lastName}/`.trim()
}

function noteLines(level: number, notes: string): string[] {
  const parts = notes.split('\n')
  const lines = [`${level} NOTE ${parts[0] ?? ''}`]
  for (const part of parts.slice(1)) lines.push(`${level + 1} CONT ${part}`)
  return lines
}

export function serializeGedcom(tree: Tree): string {
  const lines: string[] = []
  lines.push('0 HEAD')
  lines.push('1 SOUR Kin-nections')
  lines.push('1 GEDC')
  lines.push('2 VERS 5.5.1')
  lines.push('2 FORM LINEAGE-LINKED')
  lines.push('1 CHAR UTF-8')

  const familiesAsChild = new Map<string, string[]>()
  const familiesAsPartner = new Map<string, string[]>()
  for (const family of Object.values(tree.families)) {
    for (const childId of family.children) {
      if (!familiesAsChild.has(childId)) familiesAsChild.set(childId, [])
      familiesAsChild.get(childId)!.push(family.id)
    }
    for (const partner of family.partners) {
      if (!familiesAsPartner.has(partner.personId)) familiesAsPartner.set(partner.personId, [])
      familiesAsPartner.get(partner.personId)!.push(family.id)
    }
  }

  for (const person of Object.values(tree.people)) {
    lines.push(`0 ${xref(person.id)} INDI`)
    lines.push(`1 NAME ${nameLine(person.firstName, person.lastName)}`)
    if (person.nickname) lines.push(`1 NICK ${person.nickname}`)
    lines.push(`1 SEX ${person.sex === 'unknown' ? 'U' : person.sex}`)
    if (person.birthDate || person.birthPlace) {
      lines.push('1 BIRT')
      if (person.birthDate) lines.push(`2 DATE ${person.birthDate}`)
      if (person.birthPlace) lines.push(`2 PLAC ${person.birthPlace}`)
    }
    if (person.deathDate || person.isLiving === false) {
      lines.push('1 DEAT')
      if (person.deathDate) lines.push(`2 DATE ${person.deathDate}`)
    }
    if (person.notes) lines.push(...noteLines(1, person.notes))
    for (const familyId of familiesAsChild.get(person.id) ?? []) lines.push(`1 FAMC ${xref(familyId)}`)
    for (const familyId of familiesAsPartner.get(person.id) ?? []) lines.push(`1 FAMS ${xref(familyId)}`)
  }

  for (const family of Object.values(tree.families)) {
    lines.push(`0 ${xref(family.id)} FAM`)
    const [first, second] = family.partners
    if (first) lines.push(`1 HUSB ${xref(first.personId)}`)
    if (second) lines.push(`1 WIFE ${xref(second.personId)}`)
    for (const childId of family.children) lines.push(`1 CHIL ${xref(childId)}`)
    if (family.status === 'divorced') lines.push('1 DIV')
    else if (family.status === 'married' || family.status === 'partnered' || family.status === 'widowed') {
      lines.push('1 MARR')
    }
  }

  lines.push('0 TRLR')
  return lines.join('\n')
}
