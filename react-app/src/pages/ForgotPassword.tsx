import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthAPI } from '../api/salesforce';
import { Button, Input } from '@funnelists/ui';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await AuthAPI.resetPasswordRequest(email);
      if (result.success) {
        setSent(true);
      } else {
        setError(result.error || 'Something went wrong.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="sp-auth-page">
      <div className="sp-auth-card">
        <div className="sp-auth-card__header">
          <h1 className="sp-auth-card__title">Reset Password</h1>
          <p className="sp-auth-card__subtitle">
            {sent
              ? 'Check your email for a reset link.'
              : 'Enter your email to receive a password reset link.'}
          </p>
        </div>

        {!sent ? (
          <form className="sp-auth-card__form" onSubmit={handleSubmit}>
            {error && <div className="sp-auth-card__error">{error}</div>}

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>
        ) : (
          <div style={{ textAlign: 'center', padding: 'var(--fl-spacing-lg) 0' }}>
            <p style={{ color: 'var(--fl-color-success)' }}>
              If an account with that email exists, a reset link has been sent.
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
