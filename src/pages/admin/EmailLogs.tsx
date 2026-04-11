import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  emailLogService,
  type EmailLogRecord,
  type EmailLogType,
  type EmailLogStatus,
} from '@/services/email-log.service';
import { Eye, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

function studentDisplayName(row: EmailLogRecord): string {
  const s = row.student;
  if (!s) return '—';
  return [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ');
}

function formatDt(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function emailTypeLabel(value: EmailLogType): string {
  if (value === 'HALLWAY_CHECKOUT') return 'Hallway Checkout';
  if (value === 'EVENT_SCAN_TIME_IN') return 'Event Scan In';
  if (value === 'EVENT_SCAN_TIME_OUT') return 'Event Scan Out';
  return value;
}


export default function EmailLogs() {
  const [page, setPage] = useState(1);
  const limit = 20;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmailLogStatus | 'all'>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<EmailLogRecord | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, dateFilter]);

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      search: debouncedSearch || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      attendance_date: dateFilter || undefined,
    }),
    [page, limit, debouncedSearch, statusFilter, dateFilter]
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['email-logs', queryParams],
    queryFn: () => emailLogService.getEmailLogs(queryParams),
  });

  const rows = data?.rows ?? [];
  const totalPages = data?.totalPages ?? 1;

  useEffect(() => {
    if (isError && error instanceof Error) {
      toast.error(error.message);
    }
  }, [isError, error]);

  const openDetail = (row: EmailLogRecord) => {
    setSelected(row);
    setDetailOpen(true);
  };

  const decodeHtml = (html: string): string => {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  };


  return (
    <MainLayout>
      <div className="section-spacing">
        <div className="space-y-2 md:space-y-3">
          <div>
            <h1 className="page-header">Email Logs</h1>
            <p className="text-muted-foreground">
              Hallway and event scan notifications with delivery status
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle>Notification history</CardTitle>
                <CardDescription>
                  {data?.count ?? 0} total records
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search email, subject, error…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Input
                  type="date"
                  className="w-full sm:w-44"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as EmailLogStatus | 'all')}
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="SENT">Sent</SelectItem>
                    <SelectItem value="FAILED">Failed</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="py-8 text-center text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-base font-medium">No email logs</p>
                <p className="text-sm text-muted-foreground">
                  Logs appear when hallway or event scanner emails are sent or fail.
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Attendance date</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Email type</TableHead>
                      <TableHead>Guardian email</TableHead>
                      <TableHead>Hallway in</TableHead>
                      <TableHead>Hallway out</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent at</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap">
                          {row.attendanceDate}
                        </TableCell>
                        <TableCell className="font-medium">
                          {studentDisplayName(row)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {emailTypeLabel(row.emailType)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {row.recipientEmail}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatDt(row.hallwayTimeIn)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatDt(row.hallwayTimeOut)}
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate" title={row.subject}>
                          {row.subject}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              row.status === 'SENT'
                                ? 'default'
                                : row.status === 'FAILED'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatDt(row.sentAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            onClick={() => openDetail(row)}
                            aria-label="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Prev
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email log detail</DialogTitle>
            <DialogDescription>
              {selected?.subject}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">Student</span>
                  <p className="font-medium">{studentDisplayName(selected)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Recipient</span>
                  <p className="font-medium break-all">{selected.recipientEmail}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Email type</span>
                  <p>{emailTypeLabel(selected.emailType)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Attendance date</span>
                  <p>{selected.attendanceDate}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p>
                    <Badge
                      variant={
                        selected.status === 'SENT'
                          ? 'default'
                          : selected.status === 'FAILED'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {selected.status}
                    </Badge>
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Hallway time-in</span>
                  <p>{formatDt(selected.hallwayTimeIn)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Hallway time-out</span>
                  <p>{formatDt(selected.hallwayTimeOut)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Message ID</span>
                  <p className="break-all">{selected.messageId || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Sent at</span>
                  <p>{formatDt(selected.sentAt)}</p>
                </div>
              </div>

              {selected.errorMessage && (
                <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3">
                  <p className="font-medium text-destructive">Error</p>
                  <p className="mt-1 whitespace-pre-wrap break-words">{selected.errorMessage}</p>
                </div>
              )}

              {selected.smtpResponse && (
                <div>
                  <p className="text-muted-foreground">SMTP response</p>
                  <pre className="mt-1 max-h-32 overflow-auto rounded-md bg-muted p-2 text-xs">
                    {selected.smtpResponse}
                  </pre>
                </div>
              )}

              {selected.emailContent && (
                <div>
                  <p className="mb-2 text-muted-foreground">Email body (HTML)</p>
                  <div
                    className="max-h-[min(420px,50vh)] bg-white  overflow-auto rounded-md border text-black p-4 text-sm [&_table]:border-collapse [&_table]:w-full [&_th]:bg-slate-100 [&_th]:text-slate-900 [&_th]:font-semibold [&_th]:border  [&_th]:border-slate-300 [&_td]:border [&_td]:border-slate-300"
                   dangerouslySetInnerHTML={{
                    __html: decodeHtml(selected.emailContent),
                  }}
                  />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
