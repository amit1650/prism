import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, userEvent } from '@/test/render'

vi.mock('@/lib/actions/projects', () => ({
  createProjectAction: vi.fn(),
}))

import { createProjectAction } from '@/lib/actions/projects'
import { NewProjectDialogProvider } from './NewProjectDialogProvider'
import { NewProjectButton } from './NewProjectButton'

const mocked = vi.mocked(createProjectAction)

beforeEach(() => {
  mocked.mockReset()
})

function setup() {
  return render(
    <NewProjectDialogProvider>
      <NewProjectButton />
    </NewProjectDialogProvider>
  )
}

describe('NewProjectDialog', () => {
  it('opens when the trigger button is clicked', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /new project/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/project name/i)).toHaveFocus()
  })

  it('disables submit when name is empty', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /new project/i }))
    const submit = screen.getByRole('button', { name: /create & start/i })
    expect(submit).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/project name/i), 'X')
    expect(submit).toBeEnabled()
  })

  it('calls createProjectAction with name and optional description', async () => {
    mocked.mockImplementation(() => { throw new Error('NEXT_REDIRECT:/project/abc') })
    setup()
    await userEvent.click(screen.getByRole('button', { name: /new project/i }))
    await userEvent.type(screen.getByLabelText(/project name/i), 'Inventory')
    await userEvent.type(screen.getByLabelText(/description/i), 'tracking stuff')
    await userEvent.click(screen.getByRole('button', { name: /create & start/i }))
    expect(mocked).toHaveBeenCalledWith({
      name: 'Inventory',
      description: 'tracking stuff',
    })
  })

  it('shows inline error when action throws non-redirect', async () => {
    mocked.mockRejectedValue(new Error('permission denied'))
    setup()
    await userEvent.click(screen.getByRole('button', { name: /new project/i }))
    await userEvent.type(screen.getByLabelText(/project name/i), 'X')
    await userEvent.click(screen.getByRole('button', { name: /create & start/i }))
    expect(await screen.findByText(/couldn't create project/i)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('closes on cancel', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /new project/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
