import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

export interface ExtractedLine {
  text: string
  x: number
  page: number
}

/** Groups items that share (roughly) the same y coordinate into a single line. */
const Y_TOLERANCE = 2

function groupIntoLines(items: TextItem[]): { text: string; x: number }[] {
  const sorted = [...items].sort((a, b) => b.transform[5] - a.transform[5])
  const lines: { y: number; items: TextItem[] }[] = []

  for (const item of sorted) {
    const y = item.transform[5]
    const line = lines.find((l) => Math.abs(l.y - y) <= Y_TOLERANCE)
    if (line) line.items.push(item)
    else lines.push({ y, items: [item] })
  }

  return lines.map((line) => {
    const ordered = [...line.items].sort((a, b) => a.transform[4] - b.transform[4])
    return {
      text: ordered
        .map((i) => i.str)
        .join('')
        .trim(),
      x: Math.min(...ordered.map((i) => i.transform[4])),
    }
  })
}

/** Extracts positioned text lines from a PDF, page by page, preserving each line's
 * left x-offset so callers can infer indentation-based structure. */
export async function extractLines(data: ArrayBuffer): Promise<ExtractedLine[]> {
  const doc = await pdfjsLib.getDocument({ data }).promise
  const results: ExtractedLine[] = []

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()
    const items = content.items.filter((item): item is TextItem => 'str' in item)
    const lines = groupIntoLines(items).filter((line) => line.text.length > 0)
    for (const line of lines) results.push({ ...line, page: pageNum })
  }

  return results
}
