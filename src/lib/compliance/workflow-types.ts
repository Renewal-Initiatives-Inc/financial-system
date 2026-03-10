export type WorkflowState = 'not_started' | 'checklist' | 'scan' | 'draft' | 'delivered'
export type WorkflowStep = 'checklist' | 'scan' | 'draft' | 'delivery'

export interface AutoCheck {
  id: string
  label: string
  check: () => Promise<boolean>
}

export interface ManualCheck {
  id: string
  label: string
  requiresExplanation: boolean
}

export interface Citation {
  label: string
  url?: string
}

export interface WorkflowConfig {
  workflowType: string
  displayName: string
  cluster: 'A' | 'B' | 'C' | 'D' | 'E'
  requiresWarningDialog: boolean
  simplified?: boolean
  steps: {
    checklist: {
      autoChecks: AutoCheck[]
      manualChecks: ManualCheck[]
    }
    scan: {
      reportSlugs: string[]
      aiPromptTemplate: string
      citations: Citation[]
    }
    draft: {
      artifactType: 'pdf' | 'docx' | 'csv'
      templateId?: string
      generatorFn: string
    }
    delivery: {
      blobPrefix: string
      notifyRoles?: string[]
    }
  }
}

// State persisted in DB and passed to pipeline as props
export interface WorkflowStateData {
  deadlineId: number
  currentState: WorkflowState
  checklistResponses?: Record<string, { checked: boolean; explanation?: string }>
  scanAcknowledged?: boolean
  draftAccepted?: boolean
  artifactUrl?: string
  artifactFileName?: string
}

// What the pipeline passes up to its host when state changes
export interface WorkflowStateChange {
  newState: WorkflowState
  logEntry: {
    step: WorkflowStep
    action: string
    data: Record<string, unknown>
  }
}
