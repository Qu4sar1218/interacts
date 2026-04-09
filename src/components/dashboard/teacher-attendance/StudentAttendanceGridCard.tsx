import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { TeacherAttendanceRow, TeacherSectionStudent } from "@/services/dashboard.service"
import { cn, getAvatarUrl } from "@/lib/utils"
import { Check, ListTree, X } from "lucide-react"

export type GridCardVisualKind = "present" | "late" | "absent" | "excused"

function getNameInitials(name: string | null | undefined): string {
  const safeName = (name || "").trim()
  if (!safeName) return "S"
  return safeName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function resolveGridCardVisual(
  hasRecord: boolean,
  row: TeacherAttendanceRow | null
): GridCardVisualKind {
  if (!hasRecord || !row) return "absent"
  if (row.status === "EXCUSED") return "excused"
  if (row.status === "ABSENT") return "absent"
  if (row.status === "LATE") return "late"
  return "present"
}

const cardShell: Record<GridCardVisualKind, string> = {
  present:
    "border-emerald-500/40 bg-emerald-50/90 dark:border-emerald-500/35 dark:bg-emerald-950/35",
  late: "border-emerald-500/40 bg-emerald-50/90 dark:border-emerald-500/35 dark:bg-emerald-950/35",
  absent: "border-border/80 bg-muted/30 dark:bg-muted/20",
  excused: "border-sky-400/45 bg-sky-50/80 dark:border-sky-500/40 dark:bg-sky-950/35",
}

const statusLabel: Record<GridCardVisualKind, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  excused: "Excused",
}

const statusLabelClass: Record<GridCardVisualKind, string> = {
  present: "text-emerald-700 dark:text-emerald-400",
  late: "text-emerald-700 dark:text-emerald-400",
  absent: "text-muted-foreground",
  excused: "text-sky-700 dark:text-sky-400",
}

const badgeClass: Record<GridCardVisualKind, string> = {
  present: "bg-emerald-600 text-white ring-background",
  late: "bg-emerald-600 text-white ring-background",
  absent: "bg-muted-foreground/80 text-background ring-background",
  excused: "bg-sky-600 text-white ring-background",
}

export interface StudentAttendanceGridCardProps {
  student: TeacherSectionStudent
  hasRecord: boolean
  row: TeacherAttendanceRow | null
  isMarking: boolean
  onToggle: () => void
  onLogs: () => void
}

export function StudentAttendanceGridCard({
  student,
  hasRecord,
  row,
  isMarking,
  onToggle,
  onLogs,
}: StudentAttendanceGridCardProps) {
  const visual = resolveGridCardVisual(hasRecord, row)
  const showCheck = visual === "present" || visual === "late" || visual === "excused"

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "flex min-h-[148px] flex-col rounded-xl border p-3 shadow-xs transition-[box-shadow,transform] outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "hover:shadow-md active:scale-[0.99]",
        cardShell[visual],
        isMarking && "pointer-events-none opacity-70"
      )}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onToggle()
        }
      }}
      aria-label={`${student.fullName ?? "Student"}: ${statusLabel[visual]}. Click to change attendance.`}
    >
      <div className="flex flex-1 flex-col items-center gap-2">
        <div className="relative">
          <Avatar size="lg" className="size-14">
            <AvatarImage src={getAvatarUrl(student.imageUrl)} alt="" />
            <AvatarFallback
              className={cn(
                "border-0 bg-linear-to-br from-violet-500 via-purple-500 to-blue-600 text-sm font-semibold text-white",
                "after:border-0"
              )}
            >
              {getNameInitials(student.fullName)}
            </AvatarFallback>
            <AvatarBadge className={cn("size-5 ring-2 [&>svg]:size-3", badgeClass[visual])}>
              {showCheck ? <Check strokeWidth={3} /> : <X strokeWidth={3} />}
            </AvatarBadge>
          </Avatar>
        </div>
        <p className="w-full truncate text-center text-sm font-semibold leading-tight text-foreground">
          {student.fullName}
        </p>
        <p className={cn("text-sm font-medium", statusLabelClass[visual])}>{statusLabel[visual]}</p>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-2 w-full gap-1.5 text-xs"
        onClick={(e) => {
          e.stopPropagation()
          onLogs()
        }}
      >
        <ListTree className="h-3.5 w-3.5" />
        Logs
      </Button>
    </div>
  )
}
