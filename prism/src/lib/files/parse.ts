export type FileType = 'pdf' | 'docx' | 'md' | 'txt'

export function fileTypeFor(filename: string): FileType {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx' || ext === 'doc') return 'docx'
  if (ext === 'md') return 'md'
  return 'txt'
}

export async function parseFile(filename: string, buffer: Buffer): Promise<string> {
  const type = fileTypeFor(filename)
  try {
    if (type === 'pdf') {
      const pdfParse = (await import('pdf-parse')).default
      const result = await pdfParse(buffer)
      return result.text
    }
    if (type === 'docx') {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      return result.value
    }
    // txt or md
    return buffer.toString('utf-8')
  } catch (err) {
    throw new Error(`Failed to parse ${type}: ${(err as Error).message}`)
  }
}
