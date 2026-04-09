import { useCallback, useEffect, useState } from "react"
import { MainLayout } from "@/components/layout/MainLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  attendancePolicyService,
  type AttendancePolicyPayload,
  type TeacherAssignmentPolicyRow,
} from "@/services/attendance-policy.service"
import { getApiErrorMessage } from "@/services/api"
import { toast } from "sonner"

function rowToForm(row: TeacherAssignmentPolicyRow): AttendancePolicyPayload {
  return {
    on_time_grace_minutes: row.effectivePolicy.on_time_grace_minutes,
    late_until_minutes: row.effectivePolicy.late_until_minutes,
    absent_after_late_window: row.effectivePolicy.absent_after_late_window,
    early_arrival_allowance_minutes: row.effectivePolicy.early_arrival_allowance_minutes,
    late_checkout_grace_minutes: row.effectivePolicy.late_checkout_grace_minutes ?? 20,
  }
}

export default function TeacherAttendancePolicy() {
  const [rows, setRows] = useState<TeacherAssignmentPolicyRow[]>([])
  const [schoolDefault, setSchoolDefault] = useState<AttendancePolicyPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assignmentId, setAssignmentId] = useState("")
  const [forms, setForms] = useState<Record<string, AttendancePolicyPayload>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await attendancePolicyService.getMyAssignments()
      const list = data.assignments ?? []
      setRows(list)
      setSchoolDefault(data.schoolDefault ?? null)
      const next: Record<string, AttendancePolicyPayload> = {}
      for (const r of list) {
        next[r.assignmentId] = rowToForm(r)
      }
      setForms(next)
      if (list.length > 0) {
        setAssignmentId((prev) => (prev && list.some((x) => x.assignmentId === prev) ? prev : list[0].assignmentId))
      }
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to load policies."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const updateForm = (id: string, patch: Partial<AttendancePolicyPayload>) => {
    setForms((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }))
  }

  const save = async (id: string) => {
    const payload = forms[id]
    if (!payload) return
    setSavingId(id)
    try {
      await attendancePolicyService.putAssignmentPolicy(id, payload)
      toast.success("Policy saved for this class.")
      await load()
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Save failed."))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="space-y-1 sm:space-y-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Class attendance policies</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Set rules for your assigned sections and subjects. Scans outside the allowed window are blocked at the
            classroom terminal.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : rows.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No assignments</CardTitle>
              <CardDescription>You have no active section–subject assignments yet.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">Per-class overrides</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Values below apply to this class only. School defaults are shown for reference.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              {schoolDefault ? (
                <div className="rounded-md border bg-muted/30 p-2.5 text-[11px] text-muted-foreground sm:p-3 sm:text-xs">
                  School defaults: grace {schoolDefault.on_time_grace_minutes}m · late window{" "}
                  {schoolDefault.late_until_minutes}m · early allowance {schoolDefault.early_arrival_allowance_minutes}
                  m · late check-out {schoolDefault.late_checkout_grace_minutes ?? 20}m
                </div>
              ) : null}

              <div className="md:hidden">
                <Label className="mb-2 block">Class</Label>
                <Select value={assignmentId} onValueChange={setAssignmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {rows.map((r) => (
                      <SelectItem key={r.assignmentId} value={r.assignmentId}>
                        {(r.sectionName || "Section") + " · " + (r.subjectName || "Subject")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Tabs value={assignmentId} onValueChange={setAssignmentId} className="space-y-3 sm:space-y-4">
                <TabsList className="hidden h-auto w-full flex-wrap justify-start gap-1 md:flex">
                  {rows.map((r) => (
                    <TabsTrigger
                      key={r.assignmentId}
                      value={r.assignmentId}
                      className="max-w-[14rem] shrink-0 truncate"
                    >
                      {r.sectionName || "Section"} · {r.subjectName || "Subject"}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {rows.map((r) => {
                  const f = forms[r.assignmentId]
                  if (!f) return null
                  return (
                    <TabsContent key={r.assignmentId} value={r.assignmentId} className="space-y-3 sm:space-y-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {r.hasAssignmentOverride ? (
                          <span className="rounded bg-primary/10 px-2 py-0.5 text-primary">Custom override</span>
                        ) : (
                          <span>Using school default until you save</span>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                        <div className="space-y-1.5 sm:space-y-2">
                          <Label>On-time grace (minutes)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={f.on_time_grace_minutes}
                            onChange={(e) => updateForm(r.assignmentId, { on_time_grace_minutes: Number(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-1.5 sm:space-y-2">
                          <Label>Late window (minutes)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={f.late_until_minutes}
                            onChange={(e) => updateForm(r.assignmentId, { late_until_minutes: Number(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-1.5 sm:space-y-2">
                          <Label>Early arrival allowance (minutes)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={f.early_arrival_allowance_minutes}
                            onChange={(e) =>
                              updateForm(r.assignmentId, {
                                early_arrival_allowance_minutes: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2 sm:space-y-2">
                          <Label>Late check-out grace (minutes after class end)</Label>
                          <p className="text-[11px] text-muted-foreground sm:text-xs">
                            Allows face check-out for this many minutes after the scheduled end; also used when the
                            next class starts immediately after.
                          </p>
                          <Input
                            type="number"
                            min={0}
                            value={f.late_checkout_grace_minutes}
                            onChange={(e) =>
                              updateForm(r.assignmentId, {
                                late_checkout_grace_minutes: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
                          <Label>Absent after late window</Label>
                          <Switch
                            checked={f.absent_after_late_window}
                            onCheckedChange={(v) => updateForm(r.assignmentId, { absent_after_late_window: v })}
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        onClick={() => save(r.assignmentId)}
                        disabled={savingId === r.assignmentId}
                        size="sm"
                        className="text-xs sm:text-sm"
                      >
                        {savingId === r.assignmentId ? "Saving…" : "Save for this class"}
                      </Button>
                    </TabsContent>
                  )
                })}
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}
