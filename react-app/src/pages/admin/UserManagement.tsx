import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AdminAPI } from '../../api/salesforce';
import { Button, Input, Select } from '@funnelists/ui';
import { ArrowLeft, ChevronLeft, ChevronRight, Search } from 'lucide-react';

interface PortalUser {
  id: string;
  name: string;
  username: string;
  status: string;
  role: string;
  enabled: boolean;
  lastLogin?: string;
  registrationDate?: string;
  accountName?: string;
}

const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
  { value: 'Pending', label: 'Pending' },
];

const ROLE_OPTIONS = [
  { value: 'User', label: 'User' },
  { value: 'Portal Admin', label: 'Portal Admin' },
  { value: 'Super Admin', label: 'Super Admin' },
];

export function UserManagement() {
  const { isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await AdminAPI.getPortalUsers(page, searchTerm);
      if (result.success && result.data) {
        const data = result.data as { users: PortalUser[]; totalPages: number };
        setUsers(data.users || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch {
      setUsers([]);
    }
    setLoading(false);
  }, [page, searchTerm]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadUsers();
  };

  const handleStatusChange = async (userId: string, status: string) => {
    try {
      const result = await AdminAPI.updateUserStatus(userId, status);
      if (result.success) {
        setUsers((prev) => prev.map((u) =>
          u.id === userId ? { ...u, status, enabled: status === 'Active' } : u
        ));
      }
    } catch {
      // Silent fail
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      const result = await AdminAPI.updateUserRole(userId, role);
      if (result.success) {
        setUsers((prev) => prev.map((u) =>
          u.id === userId ? { ...u, role } : u
        ));
      }
    } catch {
      // Silent fail
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--fl-spacing-lg)' }}>
        <Link to="/admin" style={{ color: 'var(--fl-color-primary)', textDecoration: 'none', fontSize: 'var(--fl-font-size-sm)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <ArrowLeft size={14} /> Admin Dashboard
        </Link>
      </div>

      <div className="sp-page-header">
        <h1 className="sp-page-header__title">User Management</h1>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 'var(--fl-spacing-sm)', marginBottom: 'var(--fl-spacing-lg)', maxWidth: '400px' }}>
        <Input
          label=""
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name or email..."
        />
        <Button variant="secondary" type="submit">
          <Search size={16} />
        </Button>
      </form>

      {loading ? (
        <div style={{ padding: 'var(--fl-spacing-xl)', color: 'var(--fl-color-text-secondary)', textAlign: 'center' }}>
          Loading users...
        </div>
      ) : users.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: 'var(--fl-spacing-2xl)',
          color: 'var(--fl-color-text-secondary)',
          backgroundColor: 'var(--fl-color-bg-elevated)',
          borderRadius: 'var(--fl-radius-lg)',
          border: '1px solid var(--fl-color-border)',
        }}>
          No users found{searchTerm ? ` matching "${searchTerm}"` : ''}.
        </div>
      ) : (
        <>
          <table className="sp-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Role</th>
                <th>Last Login</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td style={{ fontSize: 'var(--fl-font-size-xs)' }}>{u.username}</td>
                  <td>
                    <Select
                      label=""
                      value={u.status}
                      onChange={(e) => handleStatusChange(u.id, e.target.value)}
                      options={STATUS_OPTIONS}
                    />
                  </td>
                  <td>
                    {isSuperAdmin ? (
                      <Select
                        label=""
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        options={ROLE_OPTIONS}
                      />
                    ) : (
                      <span>{u.role}</span>
                    )}
                  </td>
                  <td style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-muted)' }}>
                    {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--fl-spacing-md)',
              marginTop: 'var(--fl-spacing-lg)',
            }}>
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft size={16} /> Previous
              </Button>
              <span style={{ fontSize: 'var(--fl-font-size-sm)', color: 'var(--fl-color-text-secondary)' }}>
                Page {page} of {totalPages}
              </span>
              <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight size={16} />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
