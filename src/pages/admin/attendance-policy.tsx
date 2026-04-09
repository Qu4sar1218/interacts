import { useEffect, useState } from "react"
import { MainLayout } from "@/components/layout/MainLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  attendancePolicyService,
  type AttendancePolicyPayload,
  type AttendancePolicyRecord,
} from "@/services/attendance-policy.service"
import { getApiErrorMessage } from "@/services/api"
import { toast } from "sonner"

function recordToForm(p: AttendancePolicyRecord | null): AttendancePolicyPayload {
  if (!p) {
    return {
      on_time_grace_minutes: 10,
      late_until_minutes: 30,
      absent_after_late_window: true,
      early_arrival_allowance_minutes: 0,
      late_checkout_grace_minutes: 20,
    }
  }
  return {
    on_time_grace_minutes: p.on_time_grace_minutes,
    late_until_minutes: p.late_until_minutes,
    absent_after_late_window: p.absent_after_late_window,
    early_arrival_allowance_minutes: p.early_arrival_allowance_minutes ?? 0,
    late_checkout_grace_minutes: p.late_checkout_grace_minutes ?? 20,
  }
}

export default function AdminAttendancePolicy() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<AttendancePolicyPayload>(recordToForm(null))

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await attendancePolicyService.getSchoolDefault()
        if (!mounted) return
        setForm(recordToForm(res.policy))
      } catch (e) {
        if (!mounted) return
        setError(getApiErrorMessage(e, "Failed to load policy."))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await attendancePolicyService.putSchoolDefault(form)
      toast.success("School attendance policy saved.")
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Save failed."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance policy</h1>
          <p className="text-muted-foreground">
            School-wide defaults for late / absent rules, how early students may scan before class start, and how
            long after class end a check-out scan is accepted. Teachers can override per class.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>School default</CardTitle>
            <CardDescription>
              Applies when a class has no per-assignment policy. Used by the classroom face terminal for eligibility
              and status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="grace">On-time grace (minutes after start)</Label>
                    <Input
                      id="grace"
                      type="number"
                      min={0}
                      value={form.on_time_grace_minutes}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, on_time_grace_minutes: Number(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="late">Late window (minutes after start)</Label>
                    <Input
                      id="late"
                      type="number"
                      min={0}
                      value={form.late_until_minutes}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, late_until_minutes: Number(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="early">Early arrival allowance (minutes before start)</Label>
                    <Input
                      id="early"
                      type="number"
                      min={0}
                      value={form.early_arrival_allowance_minutes}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          early_arrival_allowance_minutes: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="late-checkout">Late check-out grace (minutes after class end)</Label>
                    <p className="text-xs text-muted-foreground">
                      Face check-out is allowed until this many minutes after the scheduled end time (also used when
                      resolving back-to-back classes).
                    </p>
                    <Input
                      id="late-checkout"
                      type="number"
                      min={0}
                      value={form.late_checkout_grace_minutes}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          late_checkout_grace_minutes: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="absent">Absent after late window</Label>
                      <p className="text-xs text-muted-foreground">
                        If off, scans stay &quot;late&quot; instead of absent after the late window.
                      </p>
                    </div>
                    <Switch
                      id="absent"
                      checked={form.absent_after_late_window}
                      onCheckedChange={(v) =>
                        setForm((f) => ({ ...f, absent_after_late_window: v }))
                      }
                    />
                  </div>
                </div>
                <Button onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Save school policy"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
