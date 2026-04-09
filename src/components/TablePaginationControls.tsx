import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type TablePaginationControlsProps = {
  pageIndex: number
  pageSize: number
  totalItems: number
  onPageIndexChange: (nextIndex: number) => void
  onPageSizeChange: (nextSize: number) => void
  pageSizeOptions?: readonly number[]
}

export function TablePaginationControls({
  pageIndex,
  pageSize,
  totalItems,
  onPageIndexChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 30, 40, 50],
}: TablePaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePageIndex = Math.min(Math.max(pageIndex, 0), totalPages - 1)

  const from = totalItems === 0 ? 0 : safePageIndex * pageSize + 1
  const to =
    totalItems === 0 ? 0 : Math.min((safePageIndex + 1) * pageSize, totalItems)

  const canPrev = totalItems > 0 && safePageIndex > 0
  const canNext = totalItems > 0 && safePageIndex < totalPages - 1

  return (
    <div className="mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Rows per page</span>
        <div className="w-[88px]">
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((opt) => (
                <SelectItem key={opt} value={String(opt)}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span>
          Showing {from}–{to} of {totalItems}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <div className="text-xs text-muted-foreground">
          Page {totalItems === 0 ? 0 : safePageIndex + 1} of{" "}
          {totalItems === 0 ? 0 : totalPages}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canPrev}
            onClick={() => onPageIndexChange(safePageIndex - 1)}
          >
            Prev
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canNext}
            onClick={() => onPageIndexChange(safePageIndex + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

