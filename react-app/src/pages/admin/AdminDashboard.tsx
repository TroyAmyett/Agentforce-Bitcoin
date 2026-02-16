import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AdminAPI } from '../../api/salesforce';
import { Button } from '@funnelists/ui';
import { Users, Palette, Settings } from 'lucide-react';

interface PortalStats {
  users: { total: number; active: number; pending: number; inactive: number };
  cases: { total: number; open: number; closed: number };
}

export function AdminDashboard() {
  const [stats, setStats] = useState<PortalStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const result = await AdminAPI.getPortalStats();
        if (result.success && result.data) {
          setStats(result.data as PortalStats);
        }
      } catch {
        // Silent fail
      }
      setLoading(false);
    }
    loadStats();
  }, []);

  if (loading) {
    return <div style={{ padding: 'var(--fl-spacing-xl)', color: 'var(--fl-color-text-secondary)' }}>Loading admin dashboard...</div>;
  }

  return (
    <div>
      <div className="sp-page-header">
        <h1 className="sp-page-header__title">Admin Dashboard</h1>
      </div>

      {/* Stats Grid */}
      <div className="sp-stats-grid">
        <div className="sp-stat-card">
          <div className="sp-stat-card__label">Total Users</div>
          <div className="sp-stat-card__value">{stats?.users?.total ?? 0}</div>
        </div>
        <div className="sp-stat-card">
          <div className="sp-stat-card__label">Active Users</div>
          <div className="sp-stat-card__value">{stats?.users?.active ?? 0}</div>
        </div>
        <div className="sp-stat-card">
          <div className="sp-stat-card__label">Pending Approval</div>
          <div className="sp-stat-card__value">{stats?.users?.pending ?? 0}</div>
        </div>
        <div className="sp-stat-card">
          <div className="sp-stat-card__label">Total Cases</div>
          <div className="sp-stat-card__value">{stats?.cases?.total ?? 0}</div>
        </div>
        <div className="sp-stat-card">
          <div className="sp-stat-card__label">Open Cases</div>
          <div className="sp-stat-card__value">{stats?.cases?.open ?? 0}</div>
        </div>
        <div className="sp-stat-card">
          <div className="sp-stat-card__label">Closed Cases</div>
          <div className="sp-stat-card__value">{stats?.cases?.closed ?? 0}</div>
        </div>
      </div>

      {/* Quick Actions */}
      <h2 style={{ fontSize: 'var(--fl-font-size-lg)', marginBottom: 'var(--fl-spacing-md)' }}>Quick Actions</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--fl-spacing-md)' }}>
        <AdminActionCard
          title="User Management"
          description="View, approve, and manage portal users and their roles."
          icon={<Users size={24} />}
          to="/admin/users"
        />
        <AdminActionCard
          title="Branding & Theme"
          description="Extract website theme, customize portal colors, fonts, and logo."
          icon={<Palette size={24} />}
          to="/admin/branding"
        />
        <AdminActionCard
          title="Portal Settings"
          description="Configure case form fields, product options, and portal behavior."
          icon={<Settings size={24} />}
          to="/admin/settings"
        />
      </div>
    </div>
  );
}

function AdminActionCard({ title, description, icon, to }: {
  title: string;
  description: string;
  icon: React.ReactNode;
  to: string;
}) {
  return (
    <Link to={to} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{
        backgroundColor: 'var(--fl-color-bg-elevated)',
        border: '1px solid var(--fl-color-border)',
        borderRadius: 'var(--fl-radius-lg)',
        padding: 'var(--fl-spacing-xl)',
        cursor: 'pointer',
        transition: 'border-color var(--fl-transition-fast)',
      }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--fl-color-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--fl-color-border)')}
      >
        <div style={{ color: 'var(--fl-color-primary)', marginBottom: 'var(--fl-spacing-md)' }}>{icon}</div>
        <h3 style={{ fontSize: 'var(--fl-font-size-md)', margin: '0 0 var(--fl-spacing-xs)' }}>{title}</h3>
        <p style={{ fontSize: 'var(--fl-font-size-sm)', color: 'var(--fl-color-text-secondary)', margin: 0 }}>{description}</p>
      </div>
    </Link>
  );
}
