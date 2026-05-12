import { describe, expect, it } from 'vitest'
import { render, screen } from '@/test/render'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders the headline and helper text', () => {
    render(<EmptyState />)
    expect(screen.getByText(/select a project/i)).toBeInTheDocument()
    expect(screen.getByText(/export to any llm/i)).toBeInTheDocument()
  })

  it('renders the optional error banner when prop is set', () => {
    render(<EmptyState error="Couldn't load" />)
    expect(screen.getByText(/couldn't load/i)).toBeInTheDocument()
  })
})
