import { describe, expect, it } from 'vitest'
import { render } from '@/test/render'
import { Logo } from './Logo'

describe('Logo', () => {
  it('renders an svg with a role of img and accessible label', () => {
    render(<Logo />)
    const img = document.querySelector('svg[role="img"]')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('aria-label', 'Prism')
  })

  it('respects the size prop', () => {
    const { container } = render(<Logo size={40} />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('width', '40')
    expect(svg).toHaveAttribute('height', '40')
  })
})
