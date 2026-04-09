import { useEffect, useState } from 'react';
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
  DialogDescription,
  DialogFooter,
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
import { getAvatarUrl } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2Icon, ReceiptIcon } from 'lucide-react';

const STATUS_OPTIONS: Array<PaymentStatus | 'all'> = ['all', 'pending', 'verified', 'rejected'];

function statusBadgeVariant(status: PaymentStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'verified') return 'default';
  if (status === 'rejected') return 'destructive';
  return 'secondary';
}

function formatAmount(amount: string) {
  const n = parseFloat(amount);
  if (Number.isNaN(n)) return amount;
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function studentLabel(p: Payment) {
  const s = p.student;
  if (!s) return '—';
  return `${s.first_name} ${s.last_name}`.trim();
}

export default function AdminPayments() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<PaymentStatus | 'all'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [editStatus, setEditStatus] = useState<PaymentStatus>('pending');
  const [editRemarks, setEditRemarks] = useState('');

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments', 'admin', filter],
    queryFn: () =>
      paymentService.listPayments(filter === 'all' ? undefined : { status: filter }),
  });

  useEffect(() => {
    if (selected) {
      setEditStatus(selected.status);
      setEditRemarks(selected.remarks ?? '');
    }
  }, [selected]);

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('No payment selected');
      return paymentService.updatePayment(selected.id, {
        status: editStatus,
        remarks: editRemarks.trim() === '' ? null : editRemarks.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', 'admin'] });
      toast.success('Payment updated');
      setDialogOpen(false);
      setSelected(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openReview(p: Payment) {
    setSelected(p);
    setEditStatus(p.status);
    setEditRemarks(p.remarks ?? '');
    setDialogOpen(true);
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <ReceiptIcon className="h-8 w-8" aria-hidden />
              Payments
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="status-filter" className="sr-only">
              Filter by status
            </Label>
            <Select
              value={filter}
              onValueChange={(v) => setFilter(v as PaymentStatus | 'all')}
            >
              <SelectTrigger id="status-filter" className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === 'all' ? 'All statuses' : formatPaymentStatusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Receipt submissions</CardTitle>
            <CardDescription>Click a row to open the receipt and update status or remarks.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2Icon className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments match this filter.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>ID #</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{studentLabel(p)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {p.student?.student_id_number ?? '—'}
                      </TableCell>
                      <TableCell>{formatAmount(p.amount)}</TableCell>
                      <TableCell className="max-w-[200px] whitespace-normal">{p.purpose}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(p.status)}>
                          {formatPaymentStatusLabel(p.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {format(new Date(p.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => openReview(p)}>
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review payment</DialogTitle>
            <DialogDescription>
              Amount and purpose are read-only. Update status and remarks for the student.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="grid gap-4">
              <div className="rounded-md border overflow-hidden bg-muted">
                <img
                  src={getAvatarUrl(selected.image_url)}
                  alt="Receipt"
                  className="w-full max-h-[320px] object-contain"
                />
              </div>
              <div className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">{formatAmount(selected.amount)}</span>
              </div>
              <div className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Purpose</span>
                <span className="whitespace-pre-wrap">{selected.purpose}</span>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pay-status">Status</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as PaymentStatus)}>
                  <SelectTrigger id="pay-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="verified">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pay-remarks">Remarks (visible to student)</Label>
                <Textarea
                  id="pay-remarks"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  rows={4}
                  placeholder="Optional note — e.g. reason for rejection or confirmation details"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending || !selected}>
              {updateMutation.isPending ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
