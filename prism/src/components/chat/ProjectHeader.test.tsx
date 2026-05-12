import { describe, expect, it } from 'vitest'
import { render, screen } from '@/test/render'
import { ProjectHeader } from './ProjectHeader'
import { makeProject } from '@/test/factories'

describe('ProjectHeader', () => {
  it('renders the project name and status badge', () => {
    const p = makeProject({ id: 'p1', name: 'Inventory dashboard', status: 'drafting' })
    render(<ProjectHeader project={p} />)
    expect(screen.getByRole('heading', { name: /inventory dashboard/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/status: drafting/i)).toBeInTheDocument()
  })

  it('renders the "Analyse Project" link pointing to /qa', () => {
    const p = makeProject({ id: 'p1', name: 'X' })
    render(<ProjectHeader project={p} />)
    const link = screen.getByRole('link', { name: /analyse project/i })
    expect(link).toHaveAttribute('href', '/project/p1/qa')
  })
})
