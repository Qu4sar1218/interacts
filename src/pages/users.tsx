import { useEffect, useMemo, useState } from 'react';
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
import { userService, type AppUser } from '@/services/user.service';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarUrl } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Search,
  Eye,
  Users as UsersIcon,
} from 'lucide-react';

function fullName(user: AppUser): string {
  return [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ');
}

export default function Users() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);

  const loadUsers = async () => {
    try {
      const data = await userService.getUsers();
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Error', { description: 'Failed to load users.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        fullName(user).toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query) ||
        (user.role?.name ?? '').toLowerCase().includes(query) ||
        (user.email ?? '').toLowerCase().includes(query)
    );
  }, [searchQuery, users]);

  const handleViewUser = async (user: AppUser) => {
    setSelectedUser(user);
    setViewDialogOpen(true);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-4 text-muted-foreground">Loading users...</p>
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
            <h1 className="page-header">Users</h1>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>System Users</CardTitle>
                <CardDescription>{users.length} total users</CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, username, role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center md:py-12">
                <UsersIcon className="h-12 w-12 text-muted-foreground/30 md:h-16 md:w-16" />
                <p className="mt-3 text-base font-medium md:mt-4 md:text-lg">
                  {users.length === 0 ? 'No users available' : 'No users found'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {users.length === 0
                    ? 'No user records found in API response'
                    : 'Try a different search query'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 rounded-full">
                            <AvatarImage src={getAvatarUrl(user.imageUrl)} alt={fullName(user)} />
                            <AvatarFallback className="rounded-full">{fullName(user).charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{fullName(user)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.username}</Badge>
                      </TableCell>
                      <TableCell>{user.role?.name ?? '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{user.email || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={user.active ? 'default' : 'secondary'}>
                          {user.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleViewUser(user)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>User profile</DialogTitle>
              <DialogDescription>Account details</DialogDescription>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 md:gap-4">
                  <Avatar className="h-16 w-16 rounded-full md:h-20 md:w-20">
                    <AvatarImage src={getAvatarUrl(selectedUser.imageUrl)} alt={fullName(selectedUser)} />
                    <AvatarFallback className="rounded-full text-xl font-medium md:text-2xl">{fullName(selectedUser).charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-semibold md:text-xl">{fullName(selectedUser)}</h3>
                    <p className="text-muted-foreground">@{selectedUser.username}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge variant="outline">{selectedUser.role?.name ?? 'No role'}</Badge>
                      <Badge variant={selectedUser.active ? 'default' : 'secondary'}>
                        {selectedUser.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedUser.email || 'Not provided'}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedUser.phoneNumber || 'Not provided'}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">School</p>
                    <p className="font-medium">{selectedUser.school?.name || 'Not assigned'}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-medium">{selectedUser.address || 'Not provided'}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">User ID</p>
                    <p className="font-mono text-xs">{selectedUser.id}</p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
