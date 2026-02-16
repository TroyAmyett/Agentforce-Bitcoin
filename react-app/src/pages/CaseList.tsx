import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePortalConfig } from '../hooks/usePortalConfig';
import { CaseAPI } from '../api/salesforce';
import { hasNewActivity, initializeCaseViews } from '../utils/caseViews';
import { Button, Select, Input } from '@funnelists/ui';
import { Plus, ChevronLeft, ChevronRight, Search, Download } from 'lucide-react';

interface CaseSummary {
  id: string;
  caseNumber: string;
  subject: string;
  status: string;
  priority: string;
  product?: string;
  createdDate: string;
  lastModifiedDate: string;
}

const STATUS_OPTIONS = [
  { value: 'All', label: 'All Statuses' },
  { value: 'New', label: 'New' },
  { value: 'Open', label: 'Open' },
  { value: 'Working', label: 'Working' },
  { value: 'Escalated', label: 'Escalated' },
  { value: 'Closed', label: 'Closed' },
];

export function CaseList() {
  const { user } = useAuth();
  const { config: portalConfig } = usePortalConfig();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    async function loadCases() {
      setLoading(true);
      try {
        const result = await CaseAPI.getCases(user!.id, statusFilter, page);
        if (result.success && result.data) {
          const data = result.data as { cases: CaseSummary[]; totalPages: number };
          const loaded = data.cases || [];
          setCases(loaded);
          setTotalPages(data.totalPages || 1);
          initializeCaseViews(loaded.map((c) => c.id));
        }
      } catch {
        setCases([]);
      }
      setLoading(false);
    }

    loadCases();
  }, [user, statusFilter, page]);

  const displayedCases = useMemo(() => {
    if (!searchTerm.trim()) return cases;
    const term = searchTerm.toLowerCase();
    return cases.filter(
      (c) =>
        c.subject.toLowerCase().includes(term) ||
        c.caseNumber.toLowerCase().includes(term) ||
        (c.product && c.product.toLowerCase().includes(term)),
    );
  }, [cases, searchTerm]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  const exportCSV = () => {
    const headers = ['Case #', 'Subject', 'Status', 'Priority', ...(portalConfig.showProduct ? ['Product'] : []), 'Created'];
    const rows = displayedCases.map((c) => [
      c.caseNumber,
      `"${c.subject.replace(/"/g, '""')}"`,
      c.status,
      c.priority,
      ...(portalConfig.showProduct ? [c.product || ''] : []),
      new Date(c.createdDate).toLocaleDateString(),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cases-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="sp-page-header">
        <h1 className="sp-page-header__title">My Cases</h1>
        <Link to="/cases/new">
          <Button variant="primary"><Plus size={16} /> New Case</Button>
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 'var(--fl-spacing-md)', marginBottom: 'var(--fl-spacing-md)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ width: '180px' }}>
          <Select
            label=""
            value={statusFilter}
            onChange={handleFilterChange}
            options={STATUS_OPTIONS}
          />
        </div>
        <div style={{ flex: 1, maxWidth: '300px', position: 'relative' }}>
          <Input
            label=""
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search cases..."
          />
          <Search size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--fl-color-text-muted)', pointerEvents: 'none' }} />
        </div>
        {cases.length > 0 && (
          <Button variant="secondary" onClick={exportCSV}>
            <Download size={14} /> Export CSV
          </Button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 'var(--fl-spacing-xl)', color: 'var(--fl-color-text-secondary)', textAlign: 'center' }}>
          Loading cases...
        </div>
      ) : displayedCases.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: 'var(--fl-spacing-2xl)',
          color: 'var(--fl-color-text-secondary)',
          backgroundColor: 'var(--fl-color-bg-elevated)',
          borderRadius: 'var(--fl-radius-lg)',
          border: '1px solid var(--fl-color-border)',
        }}>
          <p>{searchTerm ? `No cases matching "${searchTerm}".` : `No cases found${statusFilter !== 'All' ? ` with status "${statusFilter}"` : ''}.`}</p>
          {!searchTerm && (
            <Link to="/cases/new">
              <Button variant="primary">Create a Case</Button>
            </Link>
          )}
        </div>
      ) : (
        <>
          <table className="sp-table">
            <thead>
              <tr>
                <th>Case #</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Priority</th>
                {portalConfig.showProduct && <th>Product</th>}
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {displayedCases.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/cases/${c.id}`} className="sp-table__link">
                      {hasNewActivity(c.id, c.lastModifiedDate) && <span className="sp-unread-dot" title="New activity" />}
                      {c.caseNumber}
                    </Link>
                  </td>
                  <td>{c.subject}</td>
                  <td><CaseStatusBadge status={c.status} /></td>
                  <td>{c.priority}</td>
                  {portalConfig.showProduct && <td>{c.product || '\u2014'}</td>}
                  <td>{new Date(c.createdDate).toLocaleDateString()}</td>
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
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} /> Previous
              </Button>
              <span style={{ fontSize: 'var(--fl-font-size-sm)', color: 'var(--fl-color-text-secondary)' }}>
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight size={16} />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
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
