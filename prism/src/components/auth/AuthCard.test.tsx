import { describe, expect, it } from 'vitest'
import { render, screen } from '@/test/render'
import { AuthCard } from './AuthCard'

describe('AuthCard', () => {
  it('renders the logo, wordmark, title, subtitle, and children', () => {
    render(
      <AuthCard title="Welcome back" subtitle="Sign in to your workspace">
        <div data-testid="form">form contents</div>
      </AuthCard>
    )
    expect(screen.getByLabelText('Prism')).toBeInTheDocument()
    expect(screen.getByText('Prism')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(screen.getByText(/sign in to your workspace/i)).toBeInTheDocument()
    expect(screen.getByTestId('form')).toBeInTheDocument()
  })
})
