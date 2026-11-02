import { NextResponse } from 'next/server'

import type { ApiErrorCode } from '@/lib/errors'

export const CONTENT_CACHE_CONTROL = 'public, s-maxage=3600, stale-while-revalidate'

interface ApiErrorBody {
  data: null
  error: {
    code: ApiErrorCode
    message: string
  }
}

interface ApiSuccessBody<T> {
  data: T
  error: null
}

const contentHeaders = { 'Cache-Control': CONTENT_CACHE_CONTROL }
const privateHeaders = { 'Cache-Control': 'private, no-store' }

export function contentResponse<T>(data: T): NextResponse<ApiSuccessBody<T>> {
  return NextResponse.json({ data, error: null }, { headers: contentHeaders })
}

export function privateResponse<T>(data: T): NextResponse<ApiSuccessBody<T>> {
  return NextResponse.json({ data, error: null }, { headers: privateHeaders })
}

export function privateErrorResponse(
  code: ApiErrorCode,
  message: string,
  status: number,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { data: null, error: { code, message } },
    { status, headers: privateHeaders },
  )
}

export function contentErrorResponse(
  code: ApiErrorCode,
  message: string,
  status: number,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { data: null, error: { code, message } },
    { status, headers: contentHeaders },
  )
}
