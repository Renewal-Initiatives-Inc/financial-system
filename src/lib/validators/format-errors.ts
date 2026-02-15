import { ZodError } from 'zod'

/**
 * Transforms Zod validation errors into a flat Record<string, string>
 * suitable for displaying inline field-level error messages in forms.
 *
 * Picks the first error message for each field path, using the custom
 * `.message()` from the schema if provided.
 */
export function formatValidationErrors(
  error: ZodError
): Record<string, string> {
  const fieldErrors: Record<string, string> = {}

  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (path && !fieldErrors[path]) {
      fieldErrors[path] = friendlyMessage(issue.message, path)
    }
  }

  return fieldErrors
}

/**
 * Maps common Zod default error strings to user-friendly messages.
 * If the schema already provides a custom `.message()`, returns it as-is.
 */
function friendlyMessage(raw: string, field: string): string {
  const label = humanizeField(field)

  // Zod default messages that should be rewritten
  if (raw === 'Required') return `${label} is required`
  if (raw.startsWith('Invalid input: expected') && raw.includes(', received'))
    return `${label} has an invalid format`
  if (raw === 'Invalid email address') return 'Please enter a valid email address'
  if (raw === 'Invalid date') return 'Please enter a valid date'
  if (raw.startsWith('Too small') && raw.includes('string'))
    return `${label} is required`
  if (raw.startsWith('Too small') && raw.includes('number'))
    return `${label} must be a positive number`

  // Custom message from schema — return as-is
  return raw
}

/**
 * Converts a field path like "glAccountId" or "lines.0.amount" to
 * a human-readable label like "GL account" or "Line 1 amount".
 */
function humanizeField(path: string): string {
  return path
    .replace(/\./g, ' ')
    .replace(/(\d+)/g, (_, n) => String(Number(n) + 1))
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/Id$/, '')
    .replace(/^./, (c) => c.toUpperCase())
    .trim()
}
