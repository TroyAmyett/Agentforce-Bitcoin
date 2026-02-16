import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Input } from '@funnelists/ui';

export function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const config = window.SP_CONFIG;
  const logoUrl = config?.logoUrl;
  const companyName = config?.companyName || 'Support Portal';

  // Redirect if already logged in (use Navigate component, not navigate() during render)
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Login failed.');
    }
    setLoading(false);
  };

  return (
    <div className="sp-auth-page">
      <div className="sp-auth-card">
        <div className="sp-auth-card__header">
          {logoUrl && <img src={logoUrl} alt={companyName} className="sp-auth-card__logo" />}
          <h1 className="sp-auth-card__title">Welcome Back</h1>
          <p className="sp-auth-card__subtitle">Sign in to your support portal</p>
        </div>

        <form className="sp-auth-card__form" onSubmit={handleSubmit}>
          {error && <div className="sp-auth-card__error">{error}</div>}

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button
            variant="primary"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="sp-auth-card__links">
          <Link to="/forgot-password">Forgot password?</Link>
          <span style={{ margin: '0 8px' }}>|</span>
          <Link to="/register">Create account</Link>
        </div>
      </div>
    </div>
  );
}
