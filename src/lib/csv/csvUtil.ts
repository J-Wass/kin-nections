export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function toCsvRow(values: string[]): string {
  return values.map(csvEscape).join(',')
}

/** Minimal RFC4180-ish CSV parser: supports quoted fields with embedded commas,
 * newlines, and doubled-quote escaping. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += c
      i += 1
      continue
    }

    if (c === '"') {
      inQuotes = true
      i += 1
    } else if (c === ',') {
      row.push(field)
      field = ''
      i += 1
    } else if (c === '\r') {
      i += 1
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i += 1
    } else {
      field += c
      i += 1
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}
