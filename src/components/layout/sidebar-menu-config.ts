import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Receipt,
  ScanFace,
  Settings2,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SidebarNavItem = {
  icon: LucideIcon;
  label: string;
  path: string;
};

export type SidebarNavChild = {
  label: string;
  path: string;
};

export type SidebarNavGroup = SidebarNavItem & {
  children: SidebarNavChild[];
};

export type SidebarNavEntry = SidebarNavItem | SidebarNavGroup;

export function isNavGroup(entry: SidebarNavEntry): entry is SidebarNavGroup {
  return "children" in entry && Array.isArray(entry.children);
}

export const primaryNavItems: SidebarNavEntry[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: BookOpen, label: "Manage Academics", path: "/academics" },
  { icon: GraduationCap, label: "Manage Teachers", path: "/manage-teachers" },
  { icon: Users, label: "Manage Students", path: "/manage-students" },
  {
    icon: ScanFace,
    label: "Face Scanner",
    path: "/scanner",
    children: [
      { label: "Hallway Face Terminal", path: "/scanner/hallway" },
      { label: "Classroom Face Terminal", path: "/scanner/classroom" },
      { label: "Event Face Terminal", path: "/scanner/event" },
    ],
  },
  { icon: UserPlus, label: "Register Student Face", path: "/register" },
  { icon: ClipboardList, label: "Attendance", path: "/attendance" },
  {
    icon: CalendarDays,
    label: "Manage Events",
    path: "/manage-events",
    children: [
      { label: "Events", path: "/events" },
      { label: "Payments", path: "/payments" },
    ],
  },
  { icon: BarChart3, label: "Reports and Analytics", path: "/reports" },
  {
    icon: Settings2,
    label: "Settings",
    path: "/settings",
    children: [
      { label: "Face Terminal", path: "/devices" },
      { label: "Attendance Policy", path: "/attendance-policy" },
      { label: "Email Logs", path: "/email-logs" },
      { label: "Users", path: "/users" },
    ],
  },
];

export const teacherNavItems: SidebarNavEntry[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/teacher-dashboard" },
  { icon: Layers, label: "Assigned Class", path: "/teacher-assigned-class" },
  { icon: ClipboardList, label: "Attendance", path: "/teacher-attendance" },
  { icon: CalendarDays, label: "Event Attendance", path: "/teacher-event-attendance" },
  { icon: Settings2, label: "Class policies", path: "/teacher-attendance-policy" },
  // Flat link so one click navigates in all sidebar modes (expanded + icon rail).
  { icon: ScanFace, label: "Classroom Face Terminal", path: "/scanner/classroom" },
];

export const studentNavItems: SidebarNavEntry[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/student-dashboard" },
  { icon: CalendarDays, label: "My Class Schedule", path: "/my-class-schedule" },
  { icon: ClipboardList, label: "My Attendance", path: "/my-attendance" },
  { icon: Receipt, label: "Submit payment", path: "/submit-payment" },
];

export function getNavItemsByRole(roleName?: string): SidebarNavEntry[] {
  if (roleName === "Teacher") return teacherNavItems;
  if (roleName === "Student") return studentNavItems;
  return primaryNavItems;
}

export function getSettingsItemByRole(_roleName?: string): SidebarNavItem | null {
  return null;
}

export function isRouteActive(pathname: string, itemPath: string): boolean {
  const normalizedItemPath = itemPath.split("?")[0].split("#")[0] || "/";

  if (normalizedItemPath === "/") {
    return pathname === "/";
  }

  return pathname === normalizedItemPath || pathname.startsWith(`${normalizedItemPath}/`);
}
