import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AuthAPI } from '../api/salesforce';
import { Button, Input } from '@funnelists/ui';

export function Settings() {
  const { user, refreshUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const result = await AuthAPI.changePassword(user!.id, currentPassword, newPassword);
      if (result.success) {
        setSuccess('Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(result.error || 'Failed to change password.');
      }
    } catch {
      setError('Something went wrong.');
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="sp-page-header">
        <h1 className="sp-page-header__title">Settings</h1>
      </div>

      {/* Profile Info */}
      <div style={{
        backgroundColor: 'var(--fl-color-bg-elevated)',
        border: '1px solid var(--fl-color-border)',
        borderRadius: 'var(--fl-radius-lg)',
        padding: 'var(--fl-spacing-xl)',
        marginBottom: 'var(--fl-spacing-lg)',
        maxWidth: '640px',
      }}>
        <h2 style={{ fontSize: 'var(--fl-font-size-lg)', margin: '0 0 var(--fl-spacing-lg)' }}>Profile</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--fl-spacing-md)' }}>
          <ProfileField label="Name" value={user?.name || '-'} />
          <ProfileField label="Email" value={user?.email || user?.username || '-'} />
          <ProfileField label="Role" value={user?.role || '-'} />
          {user?.accountName && <ProfileField label="Company" value={user.accountName} />}
          {user?.lastLogin && <ProfileField label="Last Login" value={new Date(user.lastLogin).toLocaleString()} />}
        </div>
      </div>

      {/* Change Password */}
      <div style={{
        backgroundColor: 'var(--fl-color-bg-elevated)',
        border: '1px solid var(--fl-color-border)',
        borderRadius: 'var(--fl-radius-lg)',
        padding: 'var(--fl-spacing-xl)',
        maxWidth: '640px',
      }}>
        <h2 style={{ fontSize: 'var(--fl-font-size-lg)', margin: '0 0 var(--fl-spacing-lg)' }}>Change Password</h2>

        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--fl-spacing-md)' }}>
          {error && <div className="sp-auth-card__error">{error}</div>}
          {success && (
            <div style={{
              color: 'var(--fl-color-success, #22c55e)',
              fontSize: 'var(--fl-font-size-sm)',
              textAlign: 'center',
              padding: 'var(--fl-spacing-sm)',
              background: 'rgba(34, 197, 94, 0.1)',
              borderRadius: 'var(--fl-radius-md)',
            }}>
              {success}
            </div>
          )}

          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />

          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            hint="Min 8 characters, 1 number, 1 uppercase"
            required
          />

          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Change Password'}
          </Button>
        </form>
      </div>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 'var(--fl-spacing-sm)' }}>
      <div style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-muted)', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: 'var(--fl-font-size-sm)' }}>{value}</div>
    </div>
  );
}
