import { describe, expect, it, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/render'
import { WelcomeScreen } from './WelcomeScreen'
import { NewProjectDialogProvider } from './NewProjectDialogProvider'

vi.mock('@/lib/actions/projects', () => ({ createProjectAction: vi.fn() }))

function setup() {
  return render(
    <NewProjectDialogProvider>
      <WelcomeScreen />
    </NewProjectDialogProvider>
  )
}

describe('WelcomeScreen', () => {
  it('renders heading, three step cards, and CTA', () => {
    setup()
    expect(screen.getByRole('heading', { name: /welcome to prism/i })).toBeInTheDocument()
    expect(screen.getByText(/01 \/ describe/i)).toBeInTheDocument()
    expect(screen.getByText(/02 \/ refine/i)).toBeInTheDocument()
    expect(screen.getByText(/03 \/ export/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create your first project/i })).toBeInTheDocument()
  })

  it('opens the new-project dialog when CTA is clicked', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /create your first project/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})
