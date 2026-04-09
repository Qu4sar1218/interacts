import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  timelogDeviceService,
  type TimelogDevice,
  type TimelogDeviceUpdatePayload,
} from '@/services/timelog-device.service';
import { toast } from 'sonner';
import { Search, Pencil, Monitor } from 'lucide-react';

const DEVICE_STATUS_OPTIONS: TimelogDeviceUpdatePayload['status'][] = ['Active', 'Inactive', 'Maintenance', 'Offline'];

type DeviceForm = {
  name: string;
  code: string;
  device_type_id: string;
  department_id: string;
  serial_number: string;
  mac_address: string;
  ip_address: string;
  location_name: string;
  address: string;
  latitude: string;
  longitude: string;
  timezone: string;
  is_entry_only: boolean;
  is_exit_only: boolean;
  status: TimelogDeviceUpdatePayload['status'];
  settings_json: string;
  remarks: string;
  installed_date: string;
};

const EMPTY_FORM: DeviceForm = {
  name: '',
  code: '',
  device_type_id: '',
  department_id: '',
  serial_number: '',
  mac_address: '',
  ip_address: '',
  location_name: '',
  address: '',
  latitude: '',
  longitude: '',
  timezone: 'Asia/Manila',
  is_entry_only: false,
  is_exit_only: false,
  status: 'Active',
  settings_json: '',
  remarks: '',
  installed_date: '',
};

const toNullable = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const toNullableNumber = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? NaN : parsed;
};

const buildPayload = (form: DeviceForm): TimelogDeviceUpdatePayload => {
  const latitude = toNullableNumber(form.latitude);
  const longitude = toNullableNumber(form.longitude);

  if (Number.isNaN(latitude)) throw new Error('Latitude must be a valid number');
  if (Number.isNaN(longitude)) throw new Error('Longitude must be a valid number');

  let settings: Record<string, unknown> | null = null;
  const settingsText = form.settings_json.trim();
  if (settingsText) {
    try {
      const parsed = JSON.parse(settingsText);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error();
      }
      settings = parsed as Record<string, unknown>;
    } catch {
      throw new Error('Settings must be a valid JSON object');
    }
  }

  return {
    name: form.name.trim(),
    code: form.code.trim(),
    device_type_id: form.device_type_id,
    department_id: toNullable(form.department_id),
    serial_number: toNullable(form.serial_number),
    mac_address: toNullable(form.mac_address),
    ip_address: toNullable(form.ip_address),
    location_name: toNullable(form.location_name),
    address: toNullable(form.address),
    latitude,
    longitude,
    timezone: toNullable(form.timezone),
    is_entry_only: form.is_entry_only,
    is_exit_only: form.is_exit_only,
    status: form.status,
    settings,
    remarks: toNullable(form.remarks),
    installed_date: toNullable(form.installed_date),
  };
};

const toForm = (device: TimelogDevice): DeviceForm => ({
  name: device.name ?? '',
  code: device.code ?? '',
  device_type_id: device.device_type_id ?? '',
  department_id: device.department_id ?? '',
  serial_number: device.serial_number ?? '',
  mac_address: device.mac_address ?? '',
  ip_address: device.ip_address ?? '',
  location_name: device.location_name ?? '',
  address: device.address ?? '',
  latitude: device.latitude == null ? '' : String(device.latitude),
  longitude: device.longitude == null ? '' : String(device.longitude),
  timezone: device.timezone ?? 'Asia/Manila',
  is_entry_only: Boolean(device.is_entry_only),
  is_exit_only: Boolean(device.is_exit_only),
  status: (device.status as TimelogDeviceUpdatePayload['status']) ?? 'Active',
  settings_json: device.settings ? JSON.stringify(device.settings, null, 2) : '',
  remarks: device.remarks ?? '',
  installed_date: device.installed_date ?? '',
});

export default function Devices() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TimelogDevice | null>(null);
  const [form, setForm] = useState<DeviceForm>(EMPTY_FORM);

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['timelog-devices'],
    queryFn: () => timelogDeviceService.getDevices(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TimelogDeviceUpdatePayload }) =>
      timelogDeviceService.updateDevice(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timelog-devices'] });
      toast.success('Device updated successfully');
      closeDialog();
    },
    onError: (error: Error) => toast.error('Failed to update device', { description: error.message }),
  });

  const filteredDevices = devices.filter((device) => {
    const q = search.toLowerCase();
    return (
      device.name.toLowerCase().includes(q) ||
      device.code.toLowerCase().includes(q) ||
      (device.location_name ?? '').toLowerCase().includes(q) ||
      (device.status ?? '').toLowerCase().includes(q)
    );
  });

  const departmentMap = new Map<string, string>();
  devices.forEach((device) => {
    if (device.department?.id && device.department?.name) {
      departmentMap.set(device.department.id, device.department.name);
    }
  });
  const departmentOptions = Array.from(departmentMap.entries()).map(([id, name]) => ({ id, name }));

  const deviceTypeMap = new Map<string, string>();
  devices.forEach((device) => {
    if (device.device_type?.id && device.device_type?.name) {
      deviceTypeMap.set(device.device_type.id, device.device_type.name);
    }
  });
  const deviceTypeOptions = Array.from(deviceTypeMap.entries()).map(([id, name]) => ({ id, name }));

  const openEdit = (device: TimelogDevice) => {
    setEditing(device);
    setForm(toForm(device));
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      const payload = buildPayload(form);
      updateMutation.mutate({ id: editing.id, payload });
    } catch (error) {
      toast.error('Invalid device data', { description: (error as Error).message });
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-4 text-muted-foreground">Loading devices...</p>
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
            <h1 className="page-header">Device Management</h1>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>All Devices</CardTitle>
                <CardDescription>{devices.length} device{devices.length !== 1 ? 's' : ''}</CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, code, status..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredDevices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Monitor className="h-12 w-12 text-muted-foreground/30" />
                <p className="mt-3 text-base font-medium">
                  {devices.length === 0 ? 'No devices available' : 'No devices found'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {devices.length === 0 ? 'Run device seeders first' : 'Try a different search'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDevices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell className="font-medium">{device.name}</TableCell>
                      <TableCell><Badge variant="outline">{device.code}</Badge></TableCell>
                      <TableCell>{device.device_type?.name ?? '-'}</TableCell>
                      <TableCell>{device.location_name ?? '-'}</TableCell>
                      <TableCell>
                        <Badge variant={device.status === 'Active' ? 'default' : 'secondary'}>
                          {device.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(device)}>
                          <Pencil className="h-4 w-4" />
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

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Timelog Device</DialogTitle>
            <DialogDescription>Update the selected timelog device details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input id="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deviceType">Device Type</Label>
                <Select value={form.device_type_id} onValueChange={(value) => setForm({ ...form, device_type_id: value })}>
                  <SelectTrigger id="deviceType"><SelectValue placeholder="Select device type" /></SelectTrigger>
                  <SelectContent>
                    {deviceTypeOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Select value={form.department_id || '__none__'} onValueChange={(value) => setForm({ ...form, department_id: value === '__none__' ? '' : value })}>
                  <SelectTrigger id="department"><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {departmentOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="serialNumber">Serial Number</Label>
                <Input id="serialNumber" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="macAddress">MAC Address</Label>
                <Input id="macAddress" value={form.mac_address} onChange={(e) => setForm({ ...form, mac_address: e.target.value })} placeholder="00:1A:2B:3C:4D:5E" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ipAddress">IP Address</Label>
                <Input id="ipAddress" value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} placeholder="192.168.1.101" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="locationName">Location Name</Label>
                <Input id="locationName" value={form.location_name} onChange={(e) => setForm({ ...form, location_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input id="latitude" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input id="longitude" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input id="timezone" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as TimelogDeviceUpdatePayload['status'] })}>
                  <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEVICE_STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="installedDate">Installed Date</Label>
                <Input id="installedDate" type="date" value={form.installed_date} onChange={(e) => setForm({ ...form, installed_date: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="settingsJson">Settings (JSON object)</Label>
              <Textarea
                id="settingsJson"
                value={form.settings_json}
                onChange={(e) => setForm({ ...form, settings_json: e.target.value })}
                className="font-mono text-xs"
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea id="remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <Switch id="is_entry_only" checked={form.is_entry_only} onCheckedChange={(checked) => setForm({ ...form, is_entry_only: checked })} />
                <Label htmlFor="is_entry_only">Entry Only</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="is_exit_only" checked={form.is_exit_only} onCheckedChange={(checked) => setForm({ ...form, is_exit_only: checked })} />
                <Label htmlFor="is_exit_only">Exit Only</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
