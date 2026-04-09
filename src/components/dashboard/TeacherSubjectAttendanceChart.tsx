import { useMemo } from "react"
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import type { TeacherAttendanceMetricsAssignment } from "@/services/dashboard.service"

type Props = {
  assignments: TeacherAttendanceMetricsAssignment[]
}

const TICK_MAX = 14

const chartConfig = {
  presentPct: {
    label: "Present",
    color: "var(--color-success)",
  },
  latePct: {
    label: "Late",
    color: "var(--color-warning)",
  },
  absentPct: {
    label: "Absent",
    color: "var(--color-destructive)",
  },
  excusedPct: {
    label: "Excused",
    color: "var(--color-muted-foreground)",
  },
} satisfies ChartConfig

type RadarRow = {
  /** Stable unique key so polar spokes never collide when labels truncate the same */
  spokeKey: string
  name: string
  nameShort: string
  enrolled: number
  presentPct: number
  latePct: number
  absentPct: number
  excusedPct: number
}

function labelFor(a: TeacherAttendanceMetricsAssignment): string {
  const section = (a.sectionName || "").trim()
  const subject = (a.subjectName || "").trim()
  if (section && subject) return `${section} · ${subject}`
  return subject || section || a.assignmentId
}

function shortLabel(full: string): string {
  if (full.length <= TICK_MAX) return full
  return `${full.slice(0, TICK_MAX)}…`
}

function pctOf(count: number, denom: number): number {
  if (denom <= 0) return 0
  return Math.round((count / denom) * 100)
}

export function TeacherSubjectAttendanceChart({ assignments }: Props) {
  const data = useMemo(() => {
    return (assignments || []).map((a) => {
      const enrolled = a.enrolledTotal || 0
      const expectedSlots = a.expectedSlots ?? 0
      const name = labelFor(a)
      return {
        spokeKey: a.assignmentId,
        name,
        nameShort: shortLabel(name),
        enrolled,
        presentPct:
          expectedSlots > 0
            ? pctOf(a.presentSlots ?? 0, expectedSlots)
            : pctOf(a.presentDistinct || 0, enrolled),
        latePct:
          expectedSlots > 0 ? pctOf(a.lateSlots ?? 0, expectedSlots) : pctOf(a.lateDistinct || 0, enrolled),
        absentPct:
          expectedSlots > 0
            ? pctOf(a.absentSlots ?? 0, expectedSlots)
            : pctOf(a.absentDistinct || 0, enrolled),
        excusedPct:
          expectedSlots > 0
            ? pctOf(a.excusedSlots ?? 0, expectedSlots)
            : pctOf(a.excusedDistinct || 0, enrolled),
      } satisfies RadarRow
    })
  }, [assignments])

  const hasAttendanceSignal = useMemo(() => {
    return data.some(
      (row) =>
        row.presentPct > 0 ||
        row.latePct > 0 ||
        row.absentPct > 0 ||
        row.excusedPct > 0
    )
  }, [data])

  if (!assignments || assignments.length === 0) {
    return <p className="text-sm text-muted-foreground">No assignments available.</p>
  }

  return (
    <div className="w-full space-y-2">
      {!hasAttendanceSignal ? (
        <p className="text-sm text-muted-foreground">
          No attendance recorded for this period (all shares are 0%). Try a wider range (Week / Month) or
          record attendance — the radar needs non-zero counts to show a visible shape.
        </p>
      ) : null}
      <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[320px] w-full">
        <RadarChart data={data} margin={{ top: 10, right: 18, bottom: 10, left: 18 }}>
          <ChartTooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const row = payload[0].payload as RadarRow
              return (
                <div className="grid min-w-36 gap-1.5 rounded-none border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                  <div className="font-medium leading-tight">{row.name}</div>
                  <div className="text-muted-foreground">
                    Enrolled: {row.enrolled.toLocaleString()}
                  </div>
                  <div className="mt-0.5 grid gap-1 border-t border-border/50 pt-1.5">
                    {payload
                      .filter((item) => item.type !== "none")
                      .map((item) => {
                        const dk = String(item.dataKey ?? "")
                        const label =
                          dk in chartConfig
                            ? chartConfig[dk as keyof typeof chartConfig].label
                            : item.name != null
                              ? String(item.name)
                              : dk
                        const v = item.value
                        const num = typeof v === "number" ? v : Number(v)
                        return (
                          <div
                            key={String(item.dataKey ?? item.name)}
                            className="flex w-full flex-wrap items-center justify-between gap-2 leading-none"
                          >
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-mono font-medium tabular-nums text-foreground">
                              {Number.isNaN(num) ? "—" : `${num}%`}
                            </span>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )
            }}
          />
          <PolarAngleAxis
            dataKey="spokeKey"
            tick={{ fontSize: 10 }}
            tickLine={false}
            tickFormatter={(value) => {
              const row = data.find((d) => d.spokeKey === value)
              return row?.nameShort ?? String(value)
            }}
          />
          <PolarGrid />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tickCount={5} tick={{ fontSize: 10 }} />
          <Radar
            name="Present"
            dataKey="presentPct"
            isAnimationActive={false}
            fill="var(--color-presentPct)"
            fillOpacity={0.35}
            stroke="var(--color-presentPct)"
            strokeWidth={1.5}
            dot={{ r: 4, fillOpacity: 1, strokeWidth: 0 }}
          />
          <Radar
            name="Late"
            dataKey="latePct"
            isAnimationActive={false}
            fill="var(--color-latePct)"
            fillOpacity={0.35}
            stroke="var(--color-latePct)"
            strokeWidth={1.5}
            dot={{ r: 4, fillOpacity: 1, strokeWidth: 0 }}
          />
          <Radar
            name="Absent"
            dataKey="absentPct"
            isAnimationActive={false}
            fill="var(--color-absentPct)"
            fillOpacity={0.35}
            stroke="var(--color-absentPct)"
            strokeWidth={1.5}
            dot={{ r: 4, fillOpacity: 1, strokeWidth: 0 }}
          />
          <Radar
            name="Excused"
            dataKey="excusedPct"
            isAnimationActive={false}
            fill="var(--color-excusedPct)"
            fillOpacity={0.35}
            stroke="var(--color-excusedPct)"
            strokeWidth={1.5}
            dot={{ r: 4, fillOpacity: 1, strokeWidth: 0 }}
          />
          <ChartLegend
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{
              width: "100%",
              maxWidth: "100%",
              left: 0,
              right: 0,
              paddingTop: 10,
            }}
            content={
              <ChartLegendContent className="grid w-full grid-cols-2 justify-items-center gap-x-4 gap-y-2.5 sm:grid-cols-4 sm:gap-x-3 sm:gap-y-0" />
            }
          />
        </RadarChart>
      </ChartContainer>
    </div>
  )
}
