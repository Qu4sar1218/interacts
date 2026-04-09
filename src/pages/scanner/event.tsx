import { useCallback, useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { FaceScannerTerminal } from '@/components/scanner/FaceScannerTerminal';
import { scannerService } from '@/services/scanner.service';
import type { CalendarEvent } from '@/services/event.service';
import type { ScannerAttendancePayload, ScannerTerminalDevice } from '@/services/scanner.service';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, CalendarDays, AlertCircle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

export default function EventScanner() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [, setDeviceLine] = useState('Loading device…');

  const handleTerminalContext = useCallback(
    (result: { device: ScannerTerminalDevice } | { error: string }) => {
      if ('device' in result) {
        setDeviceLine(`${result.device.name} (${result.device.code})`);
      } else {
        setDeviceLine('Terminal unavailable');
      }
    },
    []
  );

  useEffect(() => {
    scannerService
      .getActiveEvents()
      .then((list) => {
        setEvents(list);
        if (list.length === 1) setSelectedEventId(list[0].id);
      })
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  }, []);

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  const handleRecordAttendance = (payload: ScannerAttendancePayload) => {
    return scannerService.recordEventAttendance({ ...payload, event_id: selectedEventId });
  };

  return (
    <MainLayout>
      <div className="section-spacing safe-top safe-bottom">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="mt-0.5 shrink-0">
            <Link to="/" aria-label="Back to dashboard">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Event Face Terminal</h1>
            </div>
          </div>
        </div>

        {/* Event selector */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" />
              Select Active Event
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {eventsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading active events...
              </div>
            ) : events.length === 0 ? (
              <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/5 p-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <div>
                  <p className="font-medium text-warning">No Active Events Today</p>
                  <p className="text-sm text-muted-foreground">
                    There are no events scheduled for today. Create an event in the Events section first.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an event..." />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedEvent && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
                    <Badge variant="default" className="bg-success">Active</Badge>
                    <span className="font-medium">{selectedEvent.name}</span>
                    <span className="text-muted-foreground">
                      {format(new Date(selectedEvent.startDate), 'MMM d')}
                      {selectedEvent.startDate !== selectedEvent.endDate && (
                        <> &ndash; {format(new Date(selectedEvent.endDate), 'MMM d, yyyy')}</>
                      )}
                    </span>
                    <span className="text-muted-foreground">
                      {selectedEvent.timeStart.slice(0, 5)} &ndash; {selectedEvent.timeEnd.slice(0, 5)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scanner — only shown when an event is selected */}
        {selectedEventId ? (
          <FaceScannerTerminal
            terminalType="event"
            title="Event Terminal"
            subtitle={selectedEvent ? `Event: ${selectedEvent.name}` : 'Event attendance scanner'}
            eventId={selectedEventId}
            onRecordAttendance={handleRecordAttendance}
            onTerminalContext={handleTerminalContext}
          />
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="font-medium text-muted-foreground">Select an event above to start scanning</p>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
