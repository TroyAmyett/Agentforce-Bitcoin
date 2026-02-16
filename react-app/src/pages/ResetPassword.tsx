import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthAPI } from '../api/salesforce';
import { Button, Input } from '@funnelists/ui';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const contactId = searchParams.get('id') || '';
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const result = await AuthAPI.resetPassword(contactId, token, password);
      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || 'Reset failed.');
      }
    } catch {
      setError('Something went wrong.');
    }
    setLoading(false);
  };

  if (!contactId || !token) {
    return (
      <div className="sp-auth-page">
        <div className="sp-auth-card">
          <div className="sp-auth-card__header">
            <h1 className="sp-auth-card__title">Invalid Link</h1>
            <p className="sp-auth-card__subtitle">This reset link is invalid or has expired.</p>
          </div>
          <div className="sp-auth-card__links">
            <Link to="/forgot-password">Request a new reset link</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sp-auth-page">
      <div className="sp-auth-card">
        <div className="sp-auth-card__header">
          <h1 className="sp-auth-card__title">Set New Password</h1>
        </div>

        {!success ? (
          <form className="sp-auth-card__form" onSubmit={handleSubmit}>
            {error && <div className="sp-auth-card__error">{error}</div>}

            <Input
              label="New Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint="Min 8 characters, 1 number, 1 uppercase"
              required
            />

            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </Button>
          </form>
        ) : (
          <div style={{ textAlign: 'center', padding: 'var(--fl-spacing-lg) 0' }}>
            <p style={{ color: 'var(--fl-color-success)' }}>
              Password reset successfully!
            </p>
          </div>
        )}

        <div className="sp-auth-card__links">
          <Link to="/login">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
