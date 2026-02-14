'use client'

import { CircleHelp } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getHelpTerm } from '@/lib/help/terms'

interface HelpTooltipProps {
  term: string
  className?: string
}

/**
 * Inline help tooltip that shows a `?` icon with contextual help text.
 * Looks up the term from the static terms dictionary.
 * Returns null for unknown terms.
 */
export function HelpTooltip({ term, className }: HelpTooltipProps) {
  const text = getHelpTerm(term)
  if (!text) return null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <CircleHelp
            className={`inline-block h-4 w-4 text-muted-foreground cursor-help ${className ?? ''}`}
            data-testid={`help-tooltip-${term}`}
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-sm">
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
