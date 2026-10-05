/**
 * Stub for error reporting (Lovable integration removed).
 * In production, replace this with a real error tracking service
 * like Sentry, LogRocket, or your own error logging endpoint.
 */

export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  // Log to console for development
  if (typeof window !== "undefined") {
    console.error("Error report:", { error, context });
  }

  // In production, send to your error tracking service:
  // Example with Sentry:
  // Sentry.captureException(error, { contexts: { custom: context } });
}
