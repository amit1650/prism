import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Prism',
  description: 'Define your project once. Export context to any LLM.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-bg text-text-0">{children}</body>
    </html>
  )
}
