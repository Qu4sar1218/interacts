import { useEffect, useState } from "react"
import { MainLayout } from "@/components/layout/MainLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  dashboardService,
  type TeacherAssignedSection,
  type TeacherSectionStudent,
} from "@/services/dashboard.service"
import { getApiErrorMessage } from "@/services/api"
import { getAvatarUrl } from "@/lib/utils"

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

function getStatusVariant(status: TeacherSectionStudent["status"]): "default" | "secondary" | "outline" {
  if (status === "enrolled") return "default"
  if (status === "dropped") return "secondary"
  return "outline"
}

function getStatusLabel(status: TeacherSectionStudent["status"]): string {
  if (!status) return "Unknown"
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export default function TeacherAssignedClass() {
  const [assignedSections, setAssignedSections] = useState<TeacherAssignedSection[]>([])
  const [loadingAssignedSections, setLoadingAssignedSections] = useState(true)
  const [assignedSectionsError, setAssignedSectionsError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    const loadAssignedSections = async () => {
      setLoadingAssignedSections(true)
      setAssignedSectionsError(null)
      try {
        const payload = await dashboardService.getTeacherAssignedSections()
        if (!isMounted) return
        setAssignedSections(payload.sections ?? [])
      } catch (error) {
        if (!isMounted) return
        setAssignedSectionsError(getApiErrorMessage(error, "Failed to load your assigned class list."))
      } finally {
        if (isMounted) {
          setLoadingAssignedSections(false)
        }
      }
    }

    loadAssignedSections()
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="space-y-1 sm:space-y-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Assigned Class</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            View your handled classes and students from regular enrollment plus irregular overrides.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Assigned Class</CardTitle>
            <CardDescription>
              Select a class tab to view merged student rosters for your teaching context.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 sm:space-y-3">
            {loadingAssignedSections ? (
              <p className="text-sm text-muted-foreground">Loading assigned class...</p>
            ) : assignedSectionsError ? (
              <p className="text-sm text-destructive">{assignedSectionsError}</p>
            ) : assignedSections.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No assigned class found for your account.
              </p>
            ) : (
              <Tabs defaultValue={assignedSections[0].sectionId} className="space-y-2.5 sm:space-y-3">
                <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto whitespace-nowrap rounded-md p-0.5">
                  {assignedSections.map((section) => (
                    <TabsTrigger key={section.sectionId} value={section.sectionId} className="px-2 py-1.5 text-xs sm:text-sm">
                      {section.sectionName || "Class"}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {assignedSections.map((section) => (
                  <TabsContent key={section.sectionId} value={section.sectionId} className="mt-1.5 sm:mt-2">
                    <div className="mb-1.5 flex items-center justify-between sm:mb-2">
                      <p className="text-xs font-medium sm:text-sm">
                        {section.sectionName || "Class"} {section.sectionCode ? `(${section.sectionCode})` : ""}
                      </p>
                      <Badge variant="outline" className="text-[11px] sm:text-xs">{section.students.length} students</Badge>
                    </div>

                    {section.students.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No students enrolled in this class yet.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Student</TableHead>
                              <TableHead>Student ID</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {section.students.map((student) => (
                              <TableRow key={student.studentId}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Avatar size="sm">
                                      <AvatarImage src={getAvatarUrl(student.imageUrl)} alt={student.fullName} />
                                      <AvatarFallback>{getNameInitials(student.fullName)}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs font-medium sm:text-sm">{student.fullName}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-[11px] sm:text-xs">{student.studentIdNumber || "-"}</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={getStatusVariant(student.status)} className="text-[11px] sm:text-xs">{getStatusLabel(student.status)}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
