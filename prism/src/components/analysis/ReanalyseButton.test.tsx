import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, userEvent } from '@/test/render'

const refreshMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

import { ReanalyseButton } from './ReanalyseButton'

beforeEach(() => {
  vi.restoreAllMocks()
  refreshMock.mockReset()
})

describe('ReanalyseButton', () => {
  it('opens a confirm dialog when clicked', async () => {
    render(<ReanalyseButton projectId="p1" currentVersion={3} />)
    await userEvent.click(screen.getByRole('button', { name: /re-analyse/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/replace v3/i)).toBeInTheDocument()
  })

  it('POSTs /api/parse on confirm and refreshes the router', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ graph: {} }), { status: 200 })
      )

    render(<ReanalyseButton projectId="p1" currentVersion={3} />)
    await userEvent.click(screen.getByRole('button', { name: /re-analyse/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/parse',
      expect.objectContaining({ method: 'POST' })
    )
    await screen.findByRole('button', { name: /re-analyse/i })
    expect(refreshMock).toHaveBeenCalled()
  })
})
