import { useCallback, useEffect, useState } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { timelogService } from '@/services/timelog.service';
import { timelogDeviceService, type TimelogDevice } from '@/services/timelog-device.service';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { Search, Download, ClipboardList, UserCheck, UserX, Filter } from 'lucide-react';
import { useClientPagination } from '@/hooks/useClientPagination';
import { TablePaginationControls } from '@/components/TablePaginationControls';

interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  type: 'check-in' | 'check-out';
  sourceType: string;
  timestamp: string;
  confidence: number;
}

function safeDateInput(value: string): Date {
  if (!value) return new Date();
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function mapTimelog(t: {
  id: string;
  student_id: string;
  log_datetime: string;
  log_type: string;
  source_type?: string;
  verification_score?: number;
  student?: { first_name?: string; last_name?: string };
}): AttendanceRecord {
  const name = t.student
    ? [t.student.first_name, t.student.last_name].filter(Boolean).join(' ')
    : 'Unknown';
  return {
    id: t.id,
    userId: String(t.student_id),
    userName: name,
    type: t.log_type === 'TIME_IN' ? 'check-in' : 'check-out',
    sourceType: t.source_type || 'UNKNOWN',
    timestamp: t.log_datetime,
    confidence: Number(t.verification_score) || 0,
  };
}

export default function Attendance() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [devices, setDevices] = useState<TimelogDevice[]>([]);
  const [filteredAttendance, setFilteredAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>(today);
  const [toDate, setToDate] = useState<string>(today);
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const loadReferenceData = useCallback(async () => {
    try {
      const devicesData = await timelogDeviceService.getDevices();
      setDevices(devicesData);
    } catch (error) {
      console.error('Error loading attendance references:', error);
    }
  }, []);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const fromDateStart = startOfDay(safeDateInput(fromDate)).toISOString();
      const toDateEnd = endOfDay(safeDateInput(toDate)).toISOString();
      const timelogsData = await timelogService.getTimelogs({
        device_id: deviceFilter !== 'all' ? deviceFilter : undefined,
        start_date: fromDateStart,
        end_date: toDateEnd,
        limit: 500,
      });
      const list = Array.isArray(timelogsData)
        ? (timelogsData as unknown[]).map((t) => mapTimelog(t as Parameters<typeof mapTimelog>[0]))
        : [];
      const sorted = list.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setAttendance(sorted);
      setFilteredAttendance(sorted);
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      setLoading(false);
    }
  }, [deviceFilter, fromDate, toDate]);

  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  useEffect(() => {
    let filtered = [...attendance];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((record) => record.userName.toLowerCase().includes(query));
    }
    if (typeFilter !== 'all') {
      filtered = filtered.filter((record) => record.type === typeFilter);
    }
    setFilteredAttendance(filtered);
  }, [searchQuery, typeFilter, attendance]);

  const pagination = useClientPagination(filteredAttendance, pageIndex, pageSize);

  useEffect(() => {
    setPageIndex(0);
  }, [searchQuery, typeFilter, deviceFilter, fromDate, toDate]);

  useEffect(() => {
    if (pageIndex !== pagination.pageIndex) setPageIndex(pagination.pageIndex);
  }, [pageIndex, pagination.pageIndex]);

  const exportToCSV = () => {
    const headers = ['Name', 'Type', 'Source Type', 'Date', 'Time', 'Confidence'];
    const rows = filteredAttendance.map((record) => [
      record.userName,
      record.type,
      record.sourceType,
      format(new Date(record.timestamp), 'yyyy-MM-dd'),
      format(new Date(record.timestamp), 'HH:mm:ss'),
      `${Math.round(record.confidence * 100)}%`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `attendance_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setFromDate(today);
    setToDate(today);
    setDeviceFilter('all');
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-4 text-muted-foreground">Loading attendance...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="section-spacing">
        <div className="space-y-2 md:space-y-3">
          <div>
            <h1 className="page-header">Attendance Log</h1>
          </div>
          <div className="flex justify-end">
            <Button onClick={exportToCSV} disabled={filteredAttendance.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Attendance Records</CardTitle>
                <CardDescription>
                  {filteredAttendance.length} of {attendance.length} records
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-5 flex flex-wrap gap-3 md:mb-6 md:gap-4">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="check-in">Check In</SelectItem>
                  <SelectItem value="check-out">Check Out</SelectItem>
                </SelectContent>
              </Select>
              <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                <SelectTrigger className="w-[210px]">
                  <SelectValue placeholder="All Devices" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Devices</SelectItem>
                  {devices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-[160px]"
              />
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-[160px]"
              />
              {(searchQuery ||
                typeFilter !== 'all' ||
                deviceFilter !== 'all' ||
                fromDate !== today ||
                toDate !== today) && (
                <Button variant="ghost" onClick={clearFilters}>
                  <Filter className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>

            {filteredAttendance.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center md:py-12">
                <ClipboardList className="h-12 w-12 text-muted-foreground/30 md:h-16 md:w-16" />
                <p className="mt-3 text-base font-medium md:mt-4 md:text-lg">
                  {attendance.length === 0 ? 'No attendance records' : 'No matching records'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {attendance.length === 0
                    ? 'Start scanning to record attendance'
                    : 'Try adjusting your filters'}
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Source Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.pageItems.map((record) => (
                      <TableRow key={`${record.id}-${record.timestamp}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                                record.type === 'check-in'
                                  ? 'bg-success/10 text-success'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {record.type === 'check-in' ? (
                                <UserCheck className="h-4 w-4" />
                              ) : (
                                <UserX className="h-4 w-4" />
                              )}
                            </div>
                            <span className="font-medium">{record.userName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={record.type === 'check-in' ? 'default' : 'secondary'}>
                            {record.type === 'check-in' ? 'Check In' : 'Check Out'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{record.sourceType}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(record.timestamp), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(record.timestamp), 'h:mm:ss a')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {Math.round(record.confidence * 100)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePaginationControls
                  pageIndex={pagination.pageIndex}
                  pageSize={pagination.pageSize}
                  totalItems={pagination.totalItems}
                  onPageIndexChange={setPageIndex}
                  onPageSizeChange={(next) => {
                    setPageSize(next);
                    setPageIndex(0);
                  }}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
