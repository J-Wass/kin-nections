import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Tree } from '../src/lib/model/types'
import { measureLayout } from '../src/lib/layout/layoutBenchmark'

const baselineFlag = process.argv.indexOf('--baseline')
const positionalArgs = process.argv.slice(2).filter((_, index) => index !== baselineFlag - 2 && index !== baselineFlag - 1)
const datasetPath = resolve(positionalArgs[0] ?? 'merged-wasserman-feitlowitz.json')
const tree = JSON.parse(await readFile(datasetPath, 'utf8')) as Tree
const metrics = measureLayout(tree)
let acceptance: Record<string, boolean> | undefined
if (baselineFlag >= 0 && process.argv[baselineFlag + 1]) {
  const baseline = JSON.parse(await readFile(resolve(process.argv[baselineFlag + 1]), 'utf8')) as ReturnType<typeof measureLayout>
  acceptance = {
    peoplePreserved: metrics.people === baseline.people,
    familiesPreserved: metrics.families === baseline.families,
    crossingsImproved: metrics.crossings < baseline.crossings,
    siblingDispersionImproved: metrics.siblingGapMean < baseline.siblingGapMean,
    edgeCardIntersectionsNotWorse: metrics.edgeCardIntersections <= baseline.edgeCardIntersections,
  }
  if (!Object.values(acceptance).every(Boolean)) process.exitCode = 1
}
console.log(JSON.stringify({ dataset: datasetPath, ...metrics, acceptance }, null, 2))
