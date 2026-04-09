import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MainLayout } from "@/components/layout/MainLayout"
import { useAuth } from "@/contexts/auth-context"

export default function TeacherDashboard() {
  const { user } = useAuth()
  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : "Teacher"

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Teacher Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome, {displayName}. You are signed in as Teacher.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Teacher Module</CardTitle>
            <CardDescription>Teacher-specific modules are coming soon.</CardDescription>
          </CardHeader>
          <CardContent>
            You currently have access to your dashboard while role-based modules are being prepared.
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
