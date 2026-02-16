import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePortalConfig } from '../hooks/usePortalConfig';
import { CaseAPI, PortalConfigAPI } from '../api/salesforce';
import { hasNewActivity, initializeCaseViews } from '../utils/caseViews';
import { stripMarkdown } from '../utils/stripMarkdown';
import {
  Search,
  BookOpen,
  Bot,
  Lightbulb,
  ArrowRight,
  PenLine,
  ChevronRight,
  FileText,
  HelpCircle,
} from 'lucide-react';

interface CaseStats {
  total: number;
  open: number;
  closed: number;
  newToday: number;
}

interface CaseSummary {
  id: string;
  caseNumber: string;
  subject: string;
  status: string;
  priority: string;
  createdDate: string;
  lastModifiedDate: string;
}

// Inline KB data for search — mirrors KnowledgeBase.tsx FAQ_DATA
const KB_ENTRIES = [
  { q: 'How do I create a support case?', a: 'Navigate to "My Cases" from the top menu, then click "New Case". Fill in the subject, description, and optionally set a priority and product.', section: 'Getting Started' },
  { q: 'What products are supported?', a: 'We support all products listed in the case form. Select the relevant product when creating a case for faster routing.', section: 'Getting Started' },
  { q: 'How do I track the status of my case?', a: 'Go to "My Cases" to see all your open and closed cases. Click on any case number to view full details, comments, and attachments.', section: 'Getting Started' },
  { q: 'Can I attach files to my case?', a: 'Yes! When creating or viewing a case, you can attach files by clicking "Attach File" or by dragging files directly onto the page. You can also paste screenshots with Ctrl+V.', section: 'Getting Started' },
  { q: 'How do I change my password?', a: 'Go to Settings from the user menu (top right). Under "Change Password", enter your current password and your new password.', section: 'Account' },
  { q: 'I forgot my password. How do I reset it?', a: 'On the login page, click "Forgot password?" and enter your email address. You\'ll receive a reset link via email.', section: 'Account' },
  { q: 'My deployment failed. What should I do?', a: 'Check the deployment status for specific error messages. Common issues include expired authorization tokens, field-level security conflicts, and dependent metadata missing.', section: 'Troubleshooting' },
  { q: 'PDF exports are empty or corrupted.', a: 'This usually happens with very large data sets. Try exporting in smaller sections or using Chrome/Edge browser for best compatibility.', section: 'Troubleshooting' },
  { q: 'Data is not syncing properly.', a: 'Verify that your integration tokens haven\'t expired in Settings > Integrations. Re-authorize if needed.', section: 'Troubleshooting' },
  { q: 'The portal is loading slowly.', a: 'Try clearing your browser cache and cookies. Test on a different network or device. Check for browser extensions that might interfere.', section: 'Troubleshooting' },
  { q: 'How do I suggest a new feature?', a: 'Visit the Ideas & Feedback page from the navigation menu. You can submit new ideas, browse existing suggestions, and vote on ideas from other users.', section: 'General' },
];

// Product-focused articles shown on dashboard
const PRODUCT_ARTICLES = [
  { q: 'What is Radar and how does it aggregate content?', product: 'Radar' },
  { q: 'How do I create AI-generated images with Canvas?', product: 'Canvas' },
  { q: 'Getting started with AgentPM project management', product: 'AgentPM' },
  { q: 'How does LeadGen enrich leads from CSV files?', product: 'LeadGen' },
  { q: 'What tools are available in the Canvas creative studio?', product: 'Canvas' },
  { q: 'Using Radar for RSS feeds and AI summaries', product: 'Radar' },
  { q: 'AgentPM Forge: turning PRDs into code', product: 'AgentPM' },
  { q: 'Resolve: upcoming help desk solution overview', product: 'Resolve' },
];

export function Dashboard() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { config: portalConfig } = usePortalConfig();
  const [stats, setStats] = useState<CaseStats>({ total: 0, open: 0, closed: 0, newToday: 0 });
  const [recentCases, setRecentCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [afMode, setAfMode] = useState<string>('builtin');

  useEffect(() => {
    if (!user?.id) return;

    async function loadDashboard() {
      try {
        const result = await CaseAPI.getCases(user!.id, 'All', 1);
        if (result.success && result.data) {
          const data = result.data as { cases: CaseSummary[]; stats: CaseStats };
          const loaded = data.cases || [];
          setStats(data.stats || { total: 0, open: 0, closed: 0, newToday: 0 });
          setRecentCases(loaded.slice(0, 3));
          initializeCaseViews(loaded.map((c) => c.id));
        }
      } catch {
        // Silent fail
      }
      setLoading(false);
    }

    loadDashboard();
  }, [user]);

  // Detect Agentforce mode (only for admin users)
  useEffect(() => {
    if (!isAdmin) {
      setAfMode('disabled');
      return;
    }
    PortalConfigAPI.getPortalConfig()
      .then((res) => {
        if (res.success && res.data) {
          try {
            const raw = JSON.parse(
              (res.data as Record<string, string>).portalConfigJson || '{}',
            );
            const af = raw.agentforce;
            if (af?.enabled) {
              setAfMode(af.mode || 'builtin');
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

  const searchResults = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (term.length < 2) return [];
    return KB_ENTRIES.filter(
      (e) => e.q.toLowerCase().includes(term) || stripMarkdown(e.a).toLowerCase().includes(term),
    ).slice(0, 5);
  }, [searchTerm]);

  const showResults = searchFocused && searchTerm.trim().length >= 2;
  const firstName = user?.name?.split(' ')[0] || 'there';

  // Build product topics from portal config (dynamic, not hardcoded)
  const productTopics = useMemo(() => {
    return portalConfig.productOptions.map((name) => ({
      name,
      color: getProductColor(name),
    }));
  }, [portalConfig.productOptions]);

  const [articleFilter, setArticleFilter] = useState<string>('All');

  const filteredArticles = useMemo(() => {
    const available = portalConfig.showProduct
      ? PRODUCT_ARTICLES.filter((a) => portalConfig.productOptions.includes(a.product))
      : PRODUCT_ARTICLES;
    if (articleFilter === 'All') return available.slice(0, 4);
    return available.filter((a) => a.product === articleFilter).slice(0, 4);
  }, [articleFilter, portalConfig.showProduct, portalConfig.productOptions]);

  const handleOpenAgentforce = () => {
    // Works for both builtin (clicks the FAB) and messaging (Salesforce widget)
    const fab = document.querySelector('.sp-af-fab') as HTMLButtonElement;
    if (fab) {
      fab.click();
    } else {
      // If messaging mode, try to open the Salesforce embedded service
      const eswBtn = document.querySelector('.embeddedServiceHelpButton .helpButton button') as HTMLButtonElement;
      if (eswBtn) eswBtn.click();
    }
  };

  if (loading) {
    return <div style={{ padding: 'var(--fl-spacing-xl)', color: 'var(--fl-color-text-secondary)' }}>Loading...</div>;
  }

  return (
    <div className="sp-hub">
      {/* ── Hero: Welcome + Search ── */}
      <div className="sp-hub__hero">
        <h1 className="sp-hub__greeting">
          Welcome back, {firstName}
        </h1>
        <p className="sp-hub__subtitle">
          How can we help you today?
        </p>

        <div className="sp-hub__search-wrap">
          <Search size={18} className="sp-hub__search-icon" />
          <input
            type="text"
            className="sp-hub__search"
            placeholder="Search for answers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
          />
          {searchTerm && (
            <button
              className="sp-hub__search-clear"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
            >
              &times;
            </button>
          )}

          {showResults && (
            <div className="sp-hub__results">
              {searchResults.length === 0 ? (
                <div className="sp-hub__results-empty">
                  <p>No articles found for &ldquo;{searchTerm}&rdquo;</p>
                  <button className="sp-hub__results-link" onClick={() => navigate('/kb')}>
                    Browse all Help articles <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <>
                  {searchResults.map((r, i) => (
                    <button key={i} className="sp-hub__result-item" onClick={() => { setSearchTerm(''); navigate('/kb'); }}>
                      <div className="sp-hub__result-q">
                        <BookOpen size={14} />
                        <span>{r.q}</span>
                      </div>
                      <p className="sp-hub__result-a">{r.a}</p>
                      <span className="sp-hub__result-section">{r.section}</span>
                    </button>
                  ))}
                  <button className="sp-hub__results-footer" onClick={() => navigate('/kb')}>
                    View all Help articles <ArrowRight size={14} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 4 Equal Action Cards (2x2) ── */}
      <div className="sp-hub__actions">
        <button className="sp-hub__action sp-hub__action--kb" onClick={() => navigate('/kb')}>
          <div className="sp-hub__action-icon sp-hub__action-icon--kb">
            <BookOpen size={24} />
          </div>
          <h3>Help</h3>
          <p>Browse articles and FAQs</p>
        </button>

        {afMode !== 'disabled' && (
          <button className="sp-hub__action sp-hub__action--agent" onClick={handleOpenAgentforce}>
            <div className="sp-hub__action-icon sp-hub__action-icon--agent">
              <Bot size={24} />
            </div>
            <h3>AI Assistant</h3>
            <p>Chat with Agentforce</p>
          </button>
        )}

        <button className="sp-hub__action sp-hub__action--case" onClick={() => navigate('/cases/new')}>
          <div className="sp-hub__action-icon sp-hub__action-icon--case">
            <PenLine size={24} />
          </div>
          <h3>Create a Case</h3>
          <p>Submit a support request</p>
        </button>

        <button className="sp-hub__action sp-hub__action--ideas" onClick={() => navigate('/ideas')}>
          <div className="sp-hub__action-icon sp-hub__action-icon--ideas">
            <Lightbulb size={24} />
          </div>
          <h3>Ideas &amp; Feedback</h3>
          <p>Suggest or vote on features</p>
        </button>
      </div>

      {/* ── Product Topics (from portal config) ── */}
      {productTopics.length > 0 && (
        <div className="sp-hub__section">
          <h2 className="sp-hub__section-title">Browse by Product</h2>
          <div className="sp-hub__products">
            {productTopics.map((t) => (
              <button key={t.name} className="sp-hub__product" onClick={() => navigate('/kb')}>
                <div className="sp-hub__product-dot" style={{ backgroundColor: t.color }} />
                <span className="sp-hub__product-name">{t.name}</span>
                <ChevronRight size={14} className="sp-hub__product-arrow" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Popular Articles ── */}
      <div className="sp-hub__section">
        <div className="sp-hub__section-header">
          <h2 className="sp-hub__section-title">
            <BookOpen size={18} />
            Popular Articles
          </h2>
          <Link to="/kb" className="sp-hub__view-all">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        {portalConfig.showProduct && productTopics.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: 'var(--fl-spacing-sm)', flexWrap: 'wrap' }}>
            <button
              className={`sp-hub__filter-pill${articleFilter === 'All' ? ' sp-hub__filter-pill--active' : ''}`}
              onClick={() => setArticleFilter('All')}
            >All</button>
            {productTopics.map((t) => (
              <button
                key={t.name}
                className={`sp-hub__filter-pill${articleFilter === t.name ? ' sp-hub__filter-pill--active' : ''}`}
                onClick={() => setArticleFilter(t.name)}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: t.color, display: 'inline-block' }} />
                {t.name}
              </button>
            ))}
          </div>
        )}
        <div className="sp-hub__articles">
          {filteredArticles.map((a, i) => (
            <button key={i} className="sp-hub__article" onClick={() => navigate('/kb')}>
              <BookOpen size={14} className="sp-hub__article-icon" />
              <span className="sp-hub__article-title">{a.q}</span>
              <span className="sp-hub__article-section">{a.product}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Your Cases (returning users) ── */}
      {stats.total > 0 && (
        <div className="sp-hub__section">
          <div className="sp-hub__section-header">
            <h2 className="sp-hub__section-title">
              <FileText size={18} />
              Your Cases
              {stats.open > 0 && (
                <span className="sp-hub__badge">{stats.open} open</span>
              )}
            </h2>
            <Link to="/cases" className="sp-hub__view-all">
              View all <ArrowRight size={14} />
            </Link>
          </div>

          <div className="sp-hub__mini-stats">
            <div className="sp-hub__mini-stat">
              <span className="sp-hub__mini-stat-val">{stats.total}</span>
              <span className="sp-hub__mini-stat-lbl">Total</span>
            </div>
            <div className="sp-hub__mini-stat">
              <span className="sp-hub__mini-stat-val" style={{ color: 'var(--fl-color-warning)' }}>{stats.open}</span>
              <span className="sp-hub__mini-stat-lbl">Open</span>
            </div>
            <div className="sp-hub__mini-stat">
              <span className="sp-hub__mini-stat-val" style={{ color: 'var(--fl-color-success)' }}>{stats.closed}</span>
              <span className="sp-hub__mini-stat-lbl">Closed</span>
            </div>
            {stats.newToday > 0 && (
              <div className="sp-hub__mini-stat">
                <span className="sp-hub__mini-stat-val" style={{ color: 'var(--fl-color-primary)' }}>{stats.newToday}</span>
                <span className="sp-hub__mini-stat-lbl">Today</span>
              </div>
            )}
          </div>

          {recentCases.length > 0 && (
            <div className="sp-hub__cases">
              {recentCases.map((c) => (
                <Link key={c.id} to={`/cases/${c.id}`} className="sp-hub__case-row">
                  <span className="sp-hub__case-num">
                    {hasNewActivity(c.id, c.lastModifiedDate) && <span className="sp-unread-dot" />}
                    {c.caseNumber}
                  </span>
                  <span className="sp-hub__case-subj">{c.subject}</span>
                  <CaseStatusBadge status={c.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Assign a consistent color to each product name */
function getProductColor(name: string): string {
  const COLORS = ['#2563eb', '#8b5cf6', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#c026d3', '#4f46e5'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function CaseStatusBadge({ status }: { status: string }) {
  const normalized = status?.toLowerCase().replace(/\s+/g, '') || '';
  let variant = '';
  if (normalized === 'new') variant = 'new';
  else if (normalized === 'open' || normalized === 'working' || normalized === 'inprogress') variant = 'open';
  else if (normalized.includes('closed') || normalized.includes('resolved')) variant = 'closed';
  else if (normalized.includes('escalat')) variant = 'escalated';
  else variant = 'open';

  return <span className={`sp-badge sp-badge--${variant}`}>{status}</span>;
}
