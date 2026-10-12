import { ArrowLeft } from 'lucide-react'

export const HUB_URL = 'https://kayco-reporting.pages.dev'

interface HubBackLinkProps {
  /** Dark chrome (launcher, builder header, manager sidebar) vs light headers. */
  dark?: boolean
  /** Thin vertical rule after the link, for use beside the app title in a header row. */
  divider?: boolean
  className?: string
}

/**
 * "All reports" link back to the Kayco reporting hub. One component, placed once
 * at the far left of each shell's top chrome and on the role launcher.
 */
export function HubBackLink({ dark = false, divider = false, className = '' }: HubBackLinkProps) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <a
        href={HUB_URL}
        className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium whitespace-nowrap transition-colors ${
          dark ? 'text-[#777] hover:text-white' : 'text-[#888] hover:text-[#171717]'
        }`}
      >
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
        All reports
      </a>
      {divider && (
        <span
          aria-hidden="true"
          className={`h-4 w-px ${dark ? 'bg-white/[0.12]' : 'bg-[#e5e5e5]'}`}
        />
      )}
    </span>
  )
}
