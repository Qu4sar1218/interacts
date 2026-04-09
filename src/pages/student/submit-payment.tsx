import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  formatPaymentStatusLabel,
  paymentService,
  type Payment,
  type PaymentStatus,
} from '@/services/payment.service';
import { eventService, type CalendarEvent } from '@/services/event.service';
import { ReceiptCameraCapture } from '@/components/payments/ReceiptCameraCapture';
import { getAvatarUrl } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2Icon, ReceiptIcon } from 'lucide-react';

function statusBadgeVariant(status: PaymentStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'verified') return 'default';
  if (status === 'rejected') return 'destructive';
  return 'secondary';
}

export default function SubmitPaymentPage() {
  const queryClient = useQueryClient();
  const [purpose, setPurpose] = useState('');
  const [eventId, setEventId] = useState('');
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [previewRow, setPreviewRow] = useState<Payment | null>(null);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments', 'me'],
    queryFn: () => paymentService.listMyPayments(),
  });
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['events', 'active-now-for-payment'],
    queryFn: () => eventService.getActiveEventsNow(),
  });
  const eventById = events.reduce<Record<string, CalendarEvent>>((acc, e) => {
    acc[e.id] = e;
    return acc;
  }, {});

  const createMutation = useMutation({
    mutationFn: () => {
      if (!capturedBlob) throw new Error('Please capture a receipt photo first');
      const file = new File([capturedBlob], 'receipt.jpg', {
        type: capturedBlob.type || 'image/jpeg',
      });
      return paymentService.createPayment({
        event_id: eventId,
        purpose: purpose.trim(),
        receipt: file,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', 'me'] });
      setPurpose('');
      setEventId('');
      setCapturedBlob(null);
      toast.success('Payment receipt submitted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCaptureBlob = useCallback((blob: Blob) => {
    setCapturedBlob(blob);
  }, []);

  const handleClearCapture = useCallback(() => {
    setCapturedBlob(null);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventId) {
      toast.error('Event is required');
      return;
    }
    if (!purpose.trim()) {
      toast.error('Purpose is required');
      return;
    }
    if (!capturedBlob) {
      toast.error('Please capture a receipt photo first');
      return;
    }
    createMutation.mutate();
  }

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="space-y-1 sm:space-y-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Submit payment</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Capture a photo of your receipt for an active event. An administrator will review and verify it.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ReceiptIcon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
              New submission
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Use your camera to take a clear photo of your receipt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid max-w-xl gap-4 sm:gap-5">
              <div className="grid gap-1.5 sm:gap-2">
                <Label htmlFor="event">Event</Label>
                <Select value={eventId} onValueChange={setEventId} disabled={eventsLoading}>
                  <SelectTrigger id="event">
                    <SelectValue
                      placeholder={eventsLoading ? 'Loading events...' : events.length ? 'Select event' : 'No active events available'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!eventsLoading && events.length === 0 && (
                  <p className="text-xs text-muted-foreground sm:text-sm">
                    There are no events in the current active window. Check back when an event is scheduled for today, or
                    ask an administrator.
                  </p>
                )}
              </div>

              <div className="grid gap-1.5 sm:gap-2">
                <Label htmlFor="purpose">Purpose</Label>
                <Textarea
                  id="purpose"
                  placeholder="e.g. Tuition — Spring term"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid gap-1.5 sm:gap-2">
                <Label>Receipt photo</Label>
                <ReceiptCameraCapture
                  onCapture={handleCaptureBlob}
                  onClear={handleClearCapture}
                  disabled={createMutation.isPending}
                />
              </div>

              <Button
                type="submit"
                disabled={createMutation.isPending || !capturedBlob}
                size="sm"
                className="text-xs sm:text-sm"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  'Submit receipt'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Your submissions</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Status and any notes from administration.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
                <Loader2Icon className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments submitted yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Receipt</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setPreviewRow(p)}
                          className="h-14 w-14 overflow-hidden rounded-md border bg-muted focus:outline-none focus:ring-2 focus:ring-ring sm:h-16 sm:w-16"
                        >
                          <img
                            src={getAvatarUrl(p.image_url)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </button>
                      </TableCell>
                      <TableCell className="max-w-[220px] whitespace-normal">
                        {p.event?.name ?? eventById[p.event_id]?.name ?? p.event_id}
                      </TableCell>
                      <TableCell className="max-w-[200px] whitespace-normal">{p.purpose}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(p.status)}>
                          {formatPaymentStatusLabel(p.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[220px] whitespace-normal text-muted-foreground text-xs sm:text-sm">
                        {p.remarks ?? '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
                        {format(new Date(p.created_at), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!previewRow} onOpenChange={(open) => !open && setPreviewRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
          </DialogHeader>
          {previewRow && (
            <img
              src={getAvatarUrl(previewRow.image_url)}
              alt="Receipt"
              className="w-full rounded-md border"
            />
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
