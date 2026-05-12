import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@/test/render'
import { ProjectRow } from './ProjectRow'
import { makeProject } from '@/test/factories'

vi.mock('next/navigation', () => ({
  usePathname: () => '/project/proj-1',
}))

describe('ProjectRow', () => {
  it('renders project name, status, and link to its page', () => {
    const p = makeProject({ id: 'proj-1', name: 'Inventory', status: 'clarifying' })
    render(<ProjectRow project={p} />)
    expect(screen.getByRole('link', { name: /inventory/i })).toHaveAttribute('href', '/project/proj-1')
    expect(screen.getByLabelText(/status: clarifying/i)).toBeInTheDocument()
  })

  it('marks itself current when pathname matches', () => {
    const p = makeProject({ id: 'proj-1', name: 'Inventory' })
    render(<ProjectRow project={p} />)
    expect(screen.getByRole('link')).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark current when pathname does not match', () => {
    const p = makeProject({ id: 'proj-2', name: 'Other' })
    render(<ProjectRow project={p} />)
    expect(screen.getByRole('link')).not.toHaveAttribute('aria-current')
  })

  it('truncates long names visually (class present)', () => {
    const p = makeProject({ id: 'proj-2', name: 'A'.repeat(80) })
    render(<ProjectRow project={p} />)
    expect(screen.getByText('A'.repeat(80))).toHaveClass('truncate')
  })
})
