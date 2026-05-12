import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('pdf-parse', () => ({
  default: vi.fn(async (_buf: Buffer) => ({ text: 'pdf content' })),
}))

vi.mock('mammoth', () => ({
  extractRawText: vi.fn(async ({ buffer: _b }: { buffer: Buffer }) => ({
    value: 'docx content',
    messages: [],
  })),
}))

import { fileTypeFor, parseFile } from './parse'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fileTypeFor', () => {
  it('detects pdf', () => expect(fileTypeFor('foo.pdf')).toBe('pdf'))
  it('detects docx', () => expect(fileTypeFor('foo.docx')).toBe('docx'))
  it('detects doc as docx', () => expect(fileTypeFor('foo.doc')).toBe('docx'))
  it('detects md', () => expect(fileTypeFor('foo.md')).toBe('md'))
  it('falls back to txt for unknown', () => expect(fileTypeFor('foo')).toBe('txt'))
  it('is case-insensitive', () => expect(fileTypeFor('FOO.PDF')).toBe('pdf'))
})

describe('parseFile', () => {
  it('parses pdf via pdf-parse', async () => {
    const text = await parseFile('a.pdf', Buffer.from('binary'))
    expect(text).toBe('pdf content')
  })

  it('parses docx via mammoth', async () => {
    const text = await parseFile('a.docx', Buffer.from('binary'))
    expect(text).toBe('docx content')
  })

  it('returns plain text for .txt', async () => {
    const text = await parseFile('a.txt', Buffer.from('hello world'))
    expect(text).toBe('hello world')
  })

  it('returns plain text for .md', async () => {
    const text = await parseFile('a.md', Buffer.from('# heading\n\nbody'))
    expect(text).toBe('# heading\n\nbody')
  })

  it('wraps pdf-parse errors with a friendly message', async () => {
    const pdfParse = await import('pdf-parse')
    vi.mocked(pdfParse.default).mockRejectedValueOnce(new Error('corrupt'))
    await expect(parseFile('bad.pdf', Buffer.from('x'))).rejects.toThrow(
      /Failed to parse pdf/
    )
  })

  it('wraps mammoth errors with a friendly message', async () => {
    const mammoth = await import('mammoth')
    vi.mocked(mammoth.extractRawText).mockRejectedValueOnce(new Error('boom'))
    await expect(parseFile('bad.docx', Buffer.from('x'))).rejects.toThrow(
      /Failed to parse docx/
    )
  })
})
