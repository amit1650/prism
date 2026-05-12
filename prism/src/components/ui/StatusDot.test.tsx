import { describe, expect, it } from 'vitest'
import { render, screen } from '@/test/render'
import { StatusDot } from './StatusDot'
import type { ProjectStatus } from '@/types/project'

const STATUSES: ProjectStatus[] = ['drafting', 'clarifying', 'compiling', 'ready', 'exported']

describe('StatusDot', () => {
  it.each(STATUSES)('renders %s with accessible label', (status) => {
    render(<StatusDot status={status} />)
    expect(screen.getByLabelText(new RegExp(`status: ${status}`, 'i'))).toBeInTheDocument()
  })

  it('applies ready glow class', () => {
    const { container } = render(<StatusDot status="ready" />)
    const dot = container.firstChild as HTMLElement
    expect(dot.className).toContain('shadow')
  })
})
