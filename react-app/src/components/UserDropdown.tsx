import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePortalConfig } from '../hooks/usePortalConfig';
import {
  ChevronDown,
  Shield,
  Users,
  Palette,
  LogOut,
  Settings as SettingsIcon,
  Sliders,
  BookOpen,
} from 'lucide-react';

export function UserDropdown() {
  const { user, isAdmin, isSuperAdmin, logout } = useAuth();
  const { config: portalConfig } = usePortalConfig();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleNav = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <div className="sp-user-dropdown" ref={ref}>
      <button
        className="sp-user-dropdown__trigger"
        onClick={() => setOpen(!open)}
      >
        <div className="sp-user-dropdown__avatar">
          {user?.firstName?.[0] || user?.name?.[0] || '?'}
        </div>
        <div className="sp-user-dropdown__info">
          <span className="sp-user-dropdown__name">{user?.name}</span>
          <span className="sp-user-dropdown__role">{user?.role}</span>
        </div>
        <ChevronDown size={14} className={`sp-user-dropdown__chevron ${open ? 'sp-user-dropdown__chevron--open' : ''}`} />
      </button>

      {open && (
        <div className="sp-user-dropdown__menu">
          <button className="sp-user-dropdown__item" onClick={() => handleNav('/settings')}>
            <SettingsIcon size={15} />
            <span>Settings</span>
          </button>

          {isAdmin && (
            <>
              <div className="sp-user-dropdown__divider" />
              <div className="sp-user-dropdown__label">Admin</div>
              {portalConfig.showAdminInPortal && (
                <>
                  <button className="sp-user-dropdown__item" onClick={() => handleNav('/admin')}>
                    <Shield size={15} />
                    <span>Admin Dashboard</span>
                  </button>
                  <button className="sp-user-dropdown__item" onClick={() => handleNav('/admin/users')}>
                    <Users size={15} />
                    <span>User Management</span>
                  </button>
                  <button className="sp-user-dropdown__item" onClick={() => handleNav('/admin/faqs')}>
                    <BookOpen size={15} />
                    <span>FAQ Manager</span>
                  </button>
                </>
              )}
              {isSuperAdmin && (
                <>
                  <button className="sp-user-dropdown__item" onClick={() => handleNav('/admin/branding')}>
                    <Palette size={15} />
                    <span>Branding</span>
                  </button>
                  {portalConfig.showAdminInPortal && (
                    <button className="sp-user-dropdown__item" onClick={() => handleNav('/admin/settings')}>
                      <Sliders size={15} />
                      <span>Portal Settings</span>
                    </button>
                  )}
                </>
              )}
            </>
          )}

          <div className="sp-user-dropdown__divider" />
          <button className="sp-user-dropdown__item sp-user-dropdown__item--danger" onClick={handleLogout}>
            <LogOut size={15} />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
}
