'use client'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-fg shadow-md hover:opacity-95 active:opacity-90 shadow-inset-pri',
  secondary:
    'bg-surface-2 text-text-1 border border-border-2 shadow-sm hover:bg-surface-1',
  ghost:
    'bg-transparent text-text-2 hover:text-text-0 hover:bg-surface-2',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', type = 'button', children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  )
})
