import { describe, expect, it, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/render'
import { Button } from './Button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('applies primary variant by default', () => {
    render(<Button>X</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-primary')
  })

  it('applies secondary variant when requested', () => {
    render(<Button variant="secondary">X</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-surface-2')
  })

  it('applies ghost variant when requested', () => {
    render(<Button variant="ghost">X</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-transparent')
  })

  it('forwards onClick', async () => {
    const handler = vi.fn()
    render(<Button onClick={handler}>X</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('disables when disabled prop set', () => {
    render(<Button disabled>X</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('forwards type prop (default button)', () => {
    render(<Button>X</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('honors explicit type=submit', () => {
    render(<Button type="submit">X</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })
})
