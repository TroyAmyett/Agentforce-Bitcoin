import { useState, useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  Lightbulb,
  BookOpen,
  Menu,
  X,
} from 'lucide-react';
import { UserDropdown } from './UserDropdown';
import { AgentforceChat } from './AgentforceChat';
import { FunnelistsLogo } from './FunnelistsLogo';
import { PortalConfigAPI } from '../api/salesforce';
import { useAuth } from '../context/AuthContext';

/* ── Site chrome (header/footer) from theme JSON ── */
interface SiteChrome {
  headerHtml: string;
  footerHtml: string;
  siteCssUrls: string[];
}

function parseSiteChrome(): SiteChrome {
  const empty: SiteChrome = { headerHtml: '', footerHtml: '', siteCssUrls: [] };
  try {
    const raw = window.SP_CONFIG?.themeJson;
    if (!raw || raw === '{}') return empty;
    const parsed = JSON.parse(raw);
    return {
      headerHtml: parsed.headerHtml || '',
      footerHtml: parsed.footerHtml || '',
      siteCssUrls: Array.isArray(parsed.siteCssUrls) ? parsed.siteCssUrls : [],
    };
  } catch {
    return empty;
  }
}

/** Inject external site CSS stylesheets so header/footer render correctly */
function useSiteCss(urls: string[]) {
  useEffect(() => {
    if (!urls.length) return;
    const links: HTMLLinkElement[] = [];
    for (const url of urls) {
      // Skip if already loaded
      if (document.querySelector(`link[href="${url}"]`)) continue;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.dataset.siteChrome = 'true';
      document.head.appendChild(link);
      links.push(link);
    }
    return () => {
      links.forEach((l) => l.remove());
    };
  }, [urls]);
}

interface AgentforceCfg {
  enabled: boolean;
  mode: string;
  scriptUrl?: string;
  orgId?: string;
  deploymentName?: string;
  siteUrl?: string;
  scrtUrl?: string;
}

function loadMessagingForWeb(cfg: AgentforceCfg) {
  if ((window as any).embeddedservice_bootstrap) return;
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = cfg.scriptUrl!;
  script.onload = () => {
    try {
      const esw = (window as any).embeddedservice_bootstrap;
      esw.settings.language = 'en_US';
      esw.init(cfg.orgId, cfg.deploymentName, cfg.siteUrl, {
        scrt2URL: cfg.scrtUrl,
      });
    } catch (err) {
      console.error('Agentforce Messaging init failed:', err);
    }
  };
  document.body.appendChild(script);
}

export function PortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [afMode, setAfMode] = useState<string | null>(null);

  const config = window.SP_CONFIG;
  const companyName = config?.companyName || 'Support Portal';
  const logoUrl = config?.logoUrl;
  const supportEmail = config?.supportEmail;
  const supportPhone = config?.supportPhone;

  // Site chrome: header/footer extracted from client's website
  const siteChrome = useMemo(() => parseSiteChrome(), []);
  useSiteCss(siteChrome.siteCssUrls);

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/cases', label: 'My Cases', icon: FileText },
    { path: '/cases/new', label: 'New Case', icon: PlusCircle },
    { path: '/ideas', label: 'Ideas', icon: Lightbulb },
    { path: '/kb', label: 'Help', icon: BookOpen },
  ];

  const isActive = (path: string) => {
    if (path === '/cases' && location.pathname.startsWith('/cases') && location.pathname !== '/cases/new') {
      return true;
    }
    if (path === '/admin' && location.pathname === '/admin') return true;
    return location.pathname === path;
  };

  // Fetch real agentforce config from DB via RemoteAction (bypasses VF merge fields)
  // Only load agent features for admin users
  useEffect(() => {
    if (!isAdmin) {
      setAfMode('disabled');
      return;
    }
    PortalConfigAPI.getPortalConfig()
      .then((res) => {
        if (res.success && res.data) {
          try {
            const portalCfg = JSON.parse(
              (res.data as Record<string, string>).portalConfigJson || '{}'
            );
            const af = portalCfg.agentforce;
            if (af && af.enabled) {
              const cfg: AgentforceCfg = {
                enabled: true,
                mode: af.mode || 'builtin',
                scriptUrl: af.scriptUrl,
                orgId: af.orgId,
                deploymentName: af.deploymentName,
                siteUrl: af.siteUrl,
                scrtUrl: af.scrtUrl,
              };
              setAfMode(cfg.mode);
              if (cfg.mode === 'messaging' && cfg.scriptUrl) {
                loadMessagingForWeb(cfg);
              }
            } else {
              setAfMode('disabled');
            }
          } catch {
            setAfMode('disabled');
          }
        }
      })
      .catch(() => setAfMode('disabled'));
  }, [isAdmin]);

  const handleNav = (path: string) => {
    setMobileOpen(false);
    navigate(path);
  };

  return (
    <div className="sp-layout">
      {/* Injected site header (from client website) */}
      {siteChrome.headerHtml && (
        <div
          className="sp-site-header"
          dangerouslySetInnerHTML={{ __html: siteChrome.headerHtml }}
        />
      )}

      {/* Top Navigation */}
      <header className="sp-topnav">
        <div className="sp-topnav__container">
          {/* Brand */}
          <div className="sp-topnav__brand" onClick={() => handleNav('/dashboard')}>
            {logoUrl ? (
              <img src={logoUrl} alt={companyName} className="sp-topnav__logo" />
            ) : (
              <FunnelistsLogo size={30} />
            )}
            <span className="sp-topnav__title">{companyName}</span>
          </div>

          {/* Desktop Nav */}
          <nav className="sp-topnav__nav">
            {navItems.map((item) => (
              <button
                key={item.path}
                className={`sp-topnav__link ${isActive(item.path) ? 'sp-topnav__link--active' : ''}`}
                onClick={() => handleNav(item.path)}
              >
                <item.icon size={16} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* User Dropdown (desktop) */}
          <div className="sp-topnav__right">
            <UserDropdown />
          </div>

          {/* Hamburger (mobile) */}
          <button
            className="sp-topnav__hamburger"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileOpen && (
        <div className="sp-mobile-menu">
          {navItems.map((item) => (
            <button
              key={item.path}
              className={`sp-mobile-menu__item ${isActive(item.path) ? 'sp-mobile-menu__item--active' : ''}`}
              onClick={() => handleNav(item.path)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
          <div className="sp-mobile-menu__divider" />
          <UserDropdown />
        </div>
      )}

      {/* Main Content */}
      <main className="sp-main">
        <div className="sp-main__container">
          <Outlet />
        </div>
      </main>

      {/* Agentforce Chat — only available to Portal Admin / Super Admin */}
      {isAdmin && (afMode === 'builtin' || afMode === 'ai-assistant') && (
        <AgentforceChat assistantMode={afMode as 'builtin' | 'ai-assistant'} />
      )}

      {/* Footer */}
      <footer className="sp-footer">
        <div className="sp-footer__container">
          <span className="sp-footer__powered">Powered by Funnelists</span>
          {(supportEmail || supportPhone) && (
            <span className="sp-footer__contact">
              {supportEmail && <a href={`mailto:${supportEmail}`}>{supportEmail}</a>}
              {supportEmail && supportPhone && <span className="sp-footer__sep">|</span>}
              {supportPhone && <span>{supportPhone}</span>}
            </span>
          )}
        </div>
      </footer>

      {/* Injected site footer (from client website) */}
      {siteChrome.footerHtml && (
        <div
          className="sp-site-footer"
          dangerouslySetInnerHTML={{ __html: siteChrome.footerHtml }}
        />
      )}
    </div>
  );
}
