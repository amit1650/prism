import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@/test/render'
import { makeProject } from '@/test/factories'
import { ProjectSidebar } from './ProjectSidebar'
import { NewProjectDialogProvider } from './NewProjectDialogProvider'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: vi.fn(async () => ({ error: null })) } }),
}))

function renderWithProvider(ui: React.ReactElement) {
  return render(<NewProjectDialogProvider>{ui}</NewProjectDialogProvider>)
}

describe('ProjectSidebar', () => {
  it('renders the logo, wordmark, New Project button, and sign out', () => {
    renderWithProvider(<ProjectSidebar projects={[]} />)
    expect(screen.getByLabelText('Prism')).toBeInTheDocument()
    expect(screen.getByText('Prism')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new project/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('shows empty message when no projects', () => {
    renderWithProvider(<ProjectSidebar projects={[]} />)
    expect(screen.getByText(/no projects yet/i)).toBeInTheDocument()
  })

  it('renders one ProjectRow per project', () => {
    const projects = [
      makeProject({ id: 'a', name: 'Alpha' }),
      makeProject({ id: 'b', name: 'Beta' }),
    ]
    renderWithProvider(<ProjectSidebar projects={projects} />)
    expect(screen.getByRole('link', { name: /alpha/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /beta/i })).toBeInTheDocument()
  })

  it('has a nav landmark labeled "Projects"', () => {
    renderWithProvider(<ProjectSidebar projects={[]} />)
    expect(screen.getByRole('navigation', { name: /projects/i })).toBeInTheDocument()
  })
})
