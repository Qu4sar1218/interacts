import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom"

import { RoleRoute } from "@/components/RoleRoute"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthProvider } from "@/contexts/auth-context"
import { isMaintenanceActive } from "@/lib/maintenance"
import { LoginPage } from "@/pages/login"
import MaintenancePage from "@/pages/maintenance"

import Dashboard from "@/pages/dashboard"
import ScannerPlaceholder from "@/pages/scanner/index"
import HallwayScanner from "@/pages/scanner/hallway"
import ClassroomScanner from "@/pages/scanner/classroom"
import EventScanner from "@/pages/scanner/event"
import Register from "@/pages/register"
import Users from "@/pages/users"
import Attendance from "@/pages/attendance"
import Reports from "@/pages/reports"
import TeacherDashboard from "@/pages/teacherDashboard"
import TeacherAssignedClass from "@/pages/teacherAssignedClass"
import TeacherAttendance from "@/pages/teacherAttendance"
import TeacherEventAttendance from "@/pages/teacherEventAttendance"
import StudentDashboard from "@/pages/studentDashboard"
import ManageAcademics from "@/pages/admin/manage-academics"
import ManageTeachers from "@/pages/admin/manage-teachers"
import ManageStudents from "@/pages/admin/manage-students"
import Events from "@/pages/admin/events"
import Devices from "@/pages/admin/devices"
import ProfilePage from "@/pages/profile"
import SubmitPaymentPage from "@/pages/student/submit-payment"
import MyClassSchedulePage from "@/pages/student/my-class-schedule"
import MyAttendancePage from "@/pages/student/my-attendance"
import AdminPayments from "@/pages/admin/payments"
import AdminAttendancePolicy from "@/pages/admin/attendance-policy"
import EmailLogs from "@/pages/admin/EmailLogs"
import TeacherAttendancePolicy from "@/pages/teacherAttendancePolicy"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
})

function MaintenanceRouteGate() {
  const location = useLocation()
  const maintenanceActive = isMaintenanceActive()
  const onMaintenancePage = location.pathname === "/maintenance"

  if (maintenanceActive && !onMaintenancePage) {
    return <Navigate to="/maintenance" replace />
  }

  if (!maintenanceActive && onMaintenancePage) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<MaintenanceRouteGate />}>
                <Route path="/maintenance" element={<MaintenancePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route element={<RoleRoute allowedRoles={["Admin", "Teacher", "Student"]} />}>
                  <Route path="/profile" element={<ProfilePage />} />
                </Route>
                <Route element={<RoleRoute allowedRoles={["Admin", "Teacher"]} />}>
                  <Route path="/scanner/classroom" element={<ClassroomScanner />} />
                </Route>
                <Route element={<RoleRoute allowedRoles={["Admin"]} />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/scanner" element={<ScannerPlaceholder />} />
                  <Route path="/scanner/hallway" element={<HallwayScanner />} />
                  <Route path="/scanner/event" element={<EventScanner />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/attendance" element={<Attendance />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/academics" element={<ManageAcademics />} />
                  <Route path="/courses" element={<Navigate to="/academics?tab=courses" replace />} />
                  <Route path="/subjects" element={<Navigate to="/academics?tab=subjects" replace />} />
                  <Route path="/departments" element={<Navigate to="/academics?tab=departments" replace />} />
                  <Route path="/manage-teachers" element={<ManageTeachers />} />
                  <Route path="/manage-students" element={<ManageStudents />} />
                  <Route path="/sections" element={<Navigate to="/academics?tab=sections" replace />} />
                  <Route path="/schedules" element={<Navigate to="/academics?tab=schedules" replace />} />
                  <Route path="/events" element={<Events />} />
                  <Route path="/devices" element={<Devices />} />
                  <Route path="/email-logs" element={<EmailLogs />} />
                  <Route path="/payments" element={<AdminPayments />} />
                  <Route path="/attendance-policy" element={<AdminAttendancePolicy />} />
                </Route>
                <Route element={<RoleRoute allowedRoles={["Teacher"]} />}>
                  <Route path="/teacher-dashboard" element={<TeacherDashboard />} />
                  <Route path="/teacher-assigned-class" element={<TeacherAssignedClass />} />
                  <Route path="/teacher-attendance" element={<TeacherAttendance />} />
                  <Route path="/teacher-event-attendance" element={<TeacherEventAttendance />} />
                  <Route path="/teacher-attendance-policy" element={<TeacherAttendancePolicy />} />
                </Route>
                <Route element={<RoleRoute allowedRoles={["Student"]} />}>
                  <Route path="/student-dashboard" element={<StudentDashboard />} />
                  <Route path="/my-class-schedule" element={<MyClassSchedulePage />} />
                  <Route path="/my-attendance" element={<MyAttendancePage />} />
                  <Route path="/submit-payment" element={<SubmitPaymentPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
