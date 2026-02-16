import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Input } from '@funnelists/ui';

export function Register() {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in (must be after all hooks)
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const config = window.SP_CONFIG;
  const logoUrl = config?.logoUrl;
  const companyName = config?.companyName || 'Support Portal';
  const regMode = config?.registrationMode;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const result = await register(firstName, lastName, email, password, company);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Registration failed.');
    }
    setLoading(false);
  };

  return (
    <div className="sp-auth-page">
      <div className="sp-auth-card">
        <div className="sp-auth-card__header">
          {logoUrl && <img src={logoUrl} alt={companyName} className="sp-auth-card__logo" />}
          <h1 className="sp-auth-card__title">Create Account</h1>
          <p className="sp-auth-card__subtitle">Get started with your support portal</p>
        </div>

        <form className="sp-auth-card__form" onSubmit={handleSubmit}>
          {error && <div className="sp-auth-card__error">{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--fl-spacing-md)' }}>
            <Input
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <Input
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {regMode === 'Account_Contact' && (
            <Input
              label="Company Name"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              hint="Optional - associates your account with a company"
            />
          )}

          <Input
            label="Password"
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
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

        <div className="sp-auth-card__links">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
