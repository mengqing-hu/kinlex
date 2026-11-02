interface ApiErrorPayload {
  code: string
  message: string
}

interface ApiEnvelope<T> {
  data: T | null
  error: ApiErrorPayload | null
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

export async function fetchApiData<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const payload = (await response.json()) as ApiEnvelope<T>

  if (!response.ok || payload.error || payload.data === null) {
    throw new ApiClientError(
      payload.error?.message ?? 'The request failed',
      payload.error?.code ?? 'UNKNOWN',
      response.status,
    )
  }

  return payload.data
}
