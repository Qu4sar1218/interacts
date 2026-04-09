import * as React from "react"

function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max)
}

export type ClientPaginationResult<T> = {
  totalItems: number
  totalPages: number
  pageIndex: number
  pageSize: number
  pageItems: T[]
  from: number
  to: number
  clampPageIndex: (nextIndex: number) => number
}

export function useClientPagination<T>(
  items: readonly T[],
  pageIndex: number,
  pageSize: number
): ClientPaginationResult<T> {
  return React.useMemo(() => {
    const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 10
    const totalItems = items.length
    const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize))
    const clampedPageIndex = clamp(pageIndex, 0, totalPages - 1)

    const start = clampedPageIndex * safePageSize
    const endExclusive = Math.min(start + safePageSize, totalItems)
    const pageItems = items.slice(start, endExclusive)

    const from = totalItems === 0 ? 0 : start + 1
    const to = totalItems === 0 ? 0 : endExclusive

    return {
      totalItems,
      totalPages,
      pageIndex: clampedPageIndex,
      pageSize: safePageSize,
      pageItems,
      from,
      to,
      clampPageIndex: (nextIndex: number) => clamp(nextIndex, 0, totalPages - 1),
    }
  }, [items, pageIndex, pageSize])
}

