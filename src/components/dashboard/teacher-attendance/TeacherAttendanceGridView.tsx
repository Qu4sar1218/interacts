import type { TeacherAttendanceRow, TeacherSectionStudent, TeacherTeachingAssignment } from "@/services/dashboard.service"
import { StudentAttendanceGridCard } from "./StudentAttendanceGridCard"

export type SingleDayGridEntry = {
  student: TeacherSectionStudent
  row: TeacherAttendanceRow | null
  hasRecord: boolean
}

export interface TeacherAttendanceGridViewProps {
  entries: SingleDayGridEntry[]
  assignment: TeacherTeachingAssignment
  manualOverrideStudentId: string | null
  onToggleAttendance: (entry: SingleDayGridEntry, assignment: TeacherTeachingAssignment) => void
  onLogs: (student: TeacherSectionStudent, assignment: TeacherTeachingAssignment) => void
}

export function TeacherAttendanceGridView({
  entries,
  assignment,
  manualOverrideStudentId,
  onToggleAttendance,
  onLogs,
}: TeacherAttendanceGridViewProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-3.5 md:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
      {entries.map((entry) => {
        const { student } = entry
        const isMarking = manualOverrideStudentId === student.studentId

        return (
          <StudentAttendanceGridCard
            key={student.studentId}
            student={student}
            row={entry.row}
            hasRecord={entry.hasRecord}
            isMarking={isMarking}
            onToggle={() => onToggleAttendance(entry, assignment)}
            onLogs={() => onLogs(student, assignment)}
          />
        )
      })}
    </div>
  )
}
