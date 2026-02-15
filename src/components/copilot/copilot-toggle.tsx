'use client'

import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CopilotToggleProps {
  open: boolean
  onClick: () => void
}

export function CopilotToggle({ open, onClick }: CopilotToggleProps) {
  if (open) return null

  return (
    <Button
      size="icon"
      className="fixed right-4 bottom-4 z-50 h-12 w-12 rounded-full shadow-lg"
      onClick={onClick}
      title="Open AI Assistant"
      data-testid="copilot-toggle"
    >
      <MessageSquare className="h-5 w-5" />
    </Button>
  )
}
