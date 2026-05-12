type LogoProps = {
  size?: number
  className?: string
}

export function Logo({ size = 18, className }: LogoProps) {
  return (
    <svg
      role="img"
      aria-label="Prism"
      width={size}
      height={size}
      viewBox="0 0 18 18"
      className={className}
    >
      <defs>
        <clipPath id="prism-clip">
          <rect width="18" height="18" rx="5" />
        </clipPath>
      </defs>
      <g clipPath="url(#prism-clip)">
        <rect width="18" height="18" fill="#ffffff" />
        <polygon points="18,0 18,18 0,18" fill="#2a2a2a" />
      </g>
      <rect
        x="0.5"
        y="0.5"
        width="17"
        height="17"
        rx="4.5"
        fill="none"
        stroke="rgba(255,255,255,0.1)"
      />
    </svg>
  )
}
