type AnalyticsPayload = {
  event: string
  props?: Record<string, any>
}

const BE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export async function track(event: string, props: Record<string, any> = {}) {
  const payload: AnalyticsPayload = { event, props }
  // Try sendBeacon first
  try {
    const url = `${BE_URL}/api/analytics`
    const body = JSON.stringify(payload)
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      try {
        (navigator as any).sendBeacon(url, new Blob([body], { type: 'application/json' }))
        return
      } catch (e) {
        // fallthrough to fetch
      }
    }
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    })
  } catch (error) {
    // Best effort: log locally
    // eslint-disable-next-line no-console
    console.warn('Analytics track failed', event, error)
  }
}

export default { track }
