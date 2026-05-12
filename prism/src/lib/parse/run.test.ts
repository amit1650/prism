import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('./extract')
vi.mock('./conflicts')
vi.mock('./assumptions')
vi.mock('./gaps')

import { extractEntities } from './extract'
import { detectConflicts } from './conflicts'
import { surfaceAssumptions } from './assumptions'
import { analyseGaps } from './gaps'
import { runPipeline } from './run'

const mExtract = vi.mocked(extractEntities)
const mConflicts = vi.mocked(detectConflicts)
const mAssumptions = vi.mocked(surfaceAssumptions)
const mGaps = vi.mocked(analyseGaps)

beforeEach(() => {
  mExtract.mockReset()
  mConflicts.mockReset()
  mAssumptions.mockReset()
  mGaps.mockReset()
})

function defaultExtraction() {
  return {
    project_type: 'web_app',
    summary: 'A test project.',
    confirmed: { foo: 'bar' },
    inferred: { baz: 'qux' },
    tentative: {},
    non_goals: ['not a mobile app'],
    decisions: [],
    tradeoffs: [],
    domain_language: {},
  }
}

describe('runPipeline', () => {
  it('runs all 4 stages when 2+ sources present', async () => {
    mExtract.mockResolvedValue(defaultExtraction())
    mConflicts.mockResolvedValue({ conflicts: [{ topic: 't', source_a: 'a', value_a: 'v', source_b: 'b', value_b: 'w', resolved: false }] })
    mAssumptions.mockResolvedValue({ assumptions: ['has internet'] })
    mGaps.mockResolvedValue({
      open_questions: [{ topic: 'auth', priority: 'high' }],
    })

    const sources = [
      { label: 'Chat session', content: 'chat text' },
      { label: 'spec.pdf', content: 'doc text' },
    ]

    const fragment = await runPipeline({
      allContent: 'combined content',
      sources,
    })

    expect(mExtract).toHaveBeenCalledWith('combined content')
    expect(mConflicts).toHaveBeenCalledWith(sources)
    expect(mAssumptions).toHaveBeenCalledWith('combined content')
    expect(mGaps).toHaveBeenCalledWith(
      { foo: 'bar', baz: 'qux' },
      'web_app'
    )

    expect(fragment.project_type).toBe('web_app')
    expect(fragment.summary).toBe('A test project.')
    expect(fragment.confirmed_facts).toEqual({ foo: 'bar' })
    expect(fragment.inferred_facts).toEqual({ baz: 'qux' })
    expect(fragment.non_goals).toEqual(['not a mobile app'])
    expect(fragment.conflicts).toHaveLength(1)
    expect(fragment.assumptions).toEqual(['has internet'])
    expect(fragment.open_questions).toHaveLength(1)
  })

  it('skips conflict detection when sources.length < 2', async () => {
    mExtract.mockResolvedValue(defaultExtraction())
    mAssumptions.mockResolvedValue({ assumptions: [] })
    mGaps.mockResolvedValue({ open_questions: [] })

    const fragment = await runPipeline({
      allContent: 'just chat',
      sources: [{ label: 'Chat session', content: 'just chat' }],
    })

    expect(mConflicts).not.toHaveBeenCalled()
    expect(fragment.conflicts).toEqual([])
  })

  it('propagates errors from any stage', async () => {
    mExtract.mockRejectedValue(new Error('extraction failed'))
    await expect(
      runPipeline({ allContent: 'x', sources: [{ label: 'a', content: 'a' }] })
    ).rejects.toThrow(/extraction failed/)
  })
})
