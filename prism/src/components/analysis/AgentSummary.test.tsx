import { describe, expect, it } from 'vitest'
import { render, screen } from '@/test/render'
import { AgentSummary } from './AgentSummary'
import { makeKnowledgeGraph } from '@/test/factories'

describe('AgentSummary', () => {
  it('renders summary text and a heading for each populated section', () => {
    const graph = makeKnowledgeGraph({
      summary: 'A CRM tool for small e-commerce shops.',
      confirmed_facts: { name: 'CRM', audience: 'e-commerce' },
      inferred_facts: { storage: 'postgres' },
      open_questions: [{ topic: 'auth provider', priority: 'high' }],
      conflicts: [],
    })

    render(<AgentSummary graph={graph} projectId="p1" />)

    expect(screen.getByText(/A CRM tool/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /confirmed facts \(2\)/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /inferred \(1\)/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /open questions \(1\)/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /conflicts/i })).not.toBeInTheDocument()
  })

  it('shows the conflicts section when count > 0', () => {
    const graph = makeKnowledgeGraph({
      conflicts: [{ topic: 'audience', source_a: 'a', value_a: 'b2b', source_b: 'b', value_b: 'b2c', resolved: false }],
    })
    render(<AgentSummary graph={graph} projectId="p1" />)
    expect(screen.getByRole('heading', { name: /conflicts \(1\)/i })).toBeInTheDocument()
  })

  it('renders "Proceed to Q&A" link with correct href', () => {
    const graph = makeKnowledgeGraph()
    render(<AgentSummary graph={graph} projectId="abc-123" />)
    const link = screen.getByRole('link', { name: /proceed to q&a/i })
    expect(link).toHaveAttribute('href', '/project/abc-123/qa/wizard')
  })
})
