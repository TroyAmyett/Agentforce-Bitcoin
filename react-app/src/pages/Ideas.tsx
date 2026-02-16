import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { IdeasAPI } from '../api/salesforce';
import { Button, Input, Textarea, Select } from '@funnelists/ui';
import {
  Lightbulb,
  ThumbsUp,
  Plus,
  ArrowLeft,
  Sparkles,
  TrendingUp,
  Clock,
  EyeOff,
  Eye,
} from 'lucide-react';

interface Idea {
  id: string;
  ideaNumber?: string;
  title: string;
  description: string;
  category: string;
  status: string;
  votes: number;
  voted: boolean;
  published?: boolean;
  product?: string;
  author: string;
  accountName?: string;
  createdDate: string;
}

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'Feature', label: 'Feature Request' },
  { value: 'Improvement', label: 'Improvement' },
  { value: 'Integration', label: 'Integration' },
  { value: 'UX', label: 'User Experience' },
  { value: 'Other', label: 'Other' },
];

const SUBMIT_CATEGORIES = CATEGORY_OPTIONS.filter((o) => o.value !== '');

const IDEA_STATUS_OPTIONS = [
  { value: 'New', label: 'New' },
  { value: 'Under Review', label: 'Under Review' },
  { value: 'Planned', label: 'Planned' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Shipped', label: 'Shipped' },
  { value: 'Declined', label: 'Declined' },
];

function IdeaStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase().replace(/\s+/g, '');
  let className = 'sp-badge ';
  if (s === 'new') className += 'sp-badge--new';
  else if (s === 'underreview') className += 'sp-badge--open';
  else if (s === 'planned' || s === 'inprogress') className += 'sp-badge--open';
  else if (s === 'shipped') className += 'sp-badge--closed';
  else if (s === 'declined') className += 'sp-badge--escalated';
  else className += 'sp-badge--new';
  return <span className={className}>{status}</span>;
}

export function Ideas() {
  const { user, isAdmin } = useAuth();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [filter, setFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Feature');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadIdeas = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const result = await IdeasAPI.getIdeas(user.id, filter || 'All', page);
      if (result.success && result.data) {
        const data = result.data as Record<string, unknown>;
        setIdeas((data.ideas as Idea[]) || []);
        setTotalPages((data.totalPages as number) || 1);
      }
    } catch {
      // Silent fail - ideas will show empty
    }
    setLoading(false);
  }, [user?.id, filter, page]);

  useEffect(() => {
    loadIdeas();
  }, [loadIdeas]);

  const handleVote = async (ideaId: string) => {
    if (!user?.id) return;
    // Optimistic update
    setIdeas((prev) =>
      prev.map((idea) =>
        idea.id === ideaId
          ? {
              ...idea,
              votes: idea.voted ? idea.votes - 1 : idea.votes + 1,
              voted: !idea.voted,
            }
          : idea,
      ),
    );

    try {
      const result = await IdeasAPI.voteForIdea(user.id, ideaId);
      if (result.success && result.data) {
        const data = result.data as { voted: boolean; votes: number };
        setIdeas((prev) =>
          prev.map((idea) =>
            idea.id === ideaId
              ? { ...idea, votes: data.votes, voted: data.voted }
              : idea,
          ),
        );
      }
    } catch {
      // Revert on failure
      loadIdeas();
    }
  };

  const handleStatusChange = async (ideaId: string, newStatus: string) => {
    // Optimistic update
    setIdeas((prev) =>
      prev.map((idea) =>
        idea.id === ideaId ? { ...idea, status: newStatus } : idea,
      ),
    );
    try {
      const result = await IdeasAPI.updateIdeaStatus(ideaId, newStatus);
      if (!result.success) {
        loadIdeas(); // Revert on failure
      }
    } catch {
      loadIdeas();
    }
  };

  const handleTogglePublished = async (ideaId: string, currentlyPublished: boolean) => {
    const newVal = !currentlyPublished;
    setIdeas((prev) =>
      prev.map((idea) =>
        idea.id === ideaId ? { ...idea, published: newVal } : idea,
      ),
    );
    try {
      const result = await IdeasAPI.toggleIdeaPublished(ideaId, newVal);
      if (!result.success) {
        loadIdeas();
      }
    } catch {
      loadIdeas();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setSubmitting(true);

    try {
      const result = await IdeasAPI.createIdea(user.id, title, description, category);
      if (result.success) {
        setTitle('');
        setDescription('');
        setCategory('Feature');
        setSubmitted(true);
        setTimeout(() => {
          setSubmitted(false);
          setShowForm(false);
          loadIdeas();
        }, 2000);
      }
    } catch {
      // Silent fail
    }
    setSubmitting(false);
  };

  return (
    <div>
      {/* Header */}
      <div className="sp-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Lightbulb size={22} style={{ color: '#8b5cf6' }} />
          <h1 className="sp-page-header__title">Ideas & Feedback</h1>
        </div>
        <Button variant="primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? (
            <>
              <ArrowLeft size={16} /> Back to Ideas
            </>
          ) : (
            <>
              <Plus size={16} /> Share an Idea
            </>
          )}
        </Button>
      </div>

      {/* Encouragement banner */}
      <div className="sp-ideas-banner">
        <Sparkles size={18} />
        <p>
          Your ideas shape the product. Whether it&apos;s a small tweak or a big
          feature &mdash; we want to hear it. Vote on existing ideas or share
          your own.
        </p>
      </div>

      {/* Submit Form */}
      {showForm && (
        <div
          className="sp-ideas-form"
          style={{
            backgroundColor: 'var(--fl-color-bg-elevated)',
            border: '1px solid var(--fl-color-border)',
            borderRadius: 'var(--fl-radius-lg)',
            padding: 'var(--fl-spacing-xl)',
            marginBottom: 'var(--fl-spacing-xl)',
            maxWidth: '640px',
          }}
        >
          <h2
            style={{
              fontSize: 'var(--fl-font-size-lg)',
              fontWeight: 'var(--fl-font-weight-semibold)',
              margin: '0 0 var(--fl-spacing-md)',
            }}
          >
            I wish I could...
          </h2>
          <p
            style={{
              fontSize: 'var(--fl-font-size-sm)',
              color: 'var(--fl-color-text-secondary)',
              margin: '0 0 var(--fl-spacing-lg)',
            }}
          >
            Finish the sentence. What would make your experience better?
          </p>

          {submitted ? (
            <div
              style={{
                textAlign: 'center',
                padding: 'var(--fl-spacing-xl)',
                color: 'var(--fl-color-success)',
              }}
            >
              <ThumbsUp size={32} style={{ marginBottom: '8px' }} />
              <p
                style={{
                  fontWeight: 'var(--fl-font-weight-semibold)',
                  fontSize: 'var(--fl-font-size-md)',
                }}
              >
                Thanks for sharing your idea!
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--fl-spacing-md)',
              }}
            >
              <Input
                label="What's your idea?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. I wish I could export cases to a spreadsheet"
                required
              />
              <Select
                label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                options={SUBMIT_CATEGORIES}
              />
              <Textarea
                label="Tell us more (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Any extra context, use case, or details that help us understand your idea..."
                rows={4}
              />
              <div style={{ display: 'flex', gap: 'var(--fl-spacing-sm)' }}>
                <Button variant="primary" type="submit" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Idea'}
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Filter */}
      {!showForm && (
        <>
          <div
            style={{
              display: 'flex',
              gap: 'var(--fl-spacing-sm)',
              marginBottom: 'var(--fl-spacing-lg)',
              flexWrap: 'wrap',
            }}
          >
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat.value}
                className={`sp-topnav__link ${filter === cat.value ? 'sp-topnav__link--active' : ''}`}
                onClick={() => { setFilter(cat.value); setPage(1); }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Ideas List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 'var(--fl-spacing-2xl)', color: 'var(--fl-color-text-secondary)' }}>
              Loading ideas...
            </div>
          ) : (
            <div className="sp-ideas-list">
              {ideas.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: 'var(--fl-spacing-2xl)',
                    color: 'var(--fl-color-text-secondary)',
                    backgroundColor: 'var(--fl-color-bg-elevated)',
                    borderRadius: 'var(--fl-radius-lg)',
                    border: '1px solid var(--fl-color-border)',
                  }}
                >
                  <p>No ideas in this category yet. Be the first!</p>
                  <Button variant="primary" onClick={() => setShowForm(true)}>
                    <Plus size={16} /> Share an Idea
                  </Button>
                </div>
              ) : (
                ideas.map((idea) => (
                  <div key={idea.id} className={`sp-idea-card ${idea.published === false ? 'sp-idea-card--hidden' : ''}`}>
                    <button
                      className={`sp-idea-card__vote ${idea.voted ? 'sp-idea-card__vote--voted' : ''}`}
                      onClick={() => handleVote(idea.id)}
                      aria-label={`Vote for ${idea.title}`}
                    >
                      <TrendingUp size={16} />
                      <span className="sp-idea-card__vote-count">
                        {idea.votes}
                      </span>
                    </button>
                    <div className="sp-idea-card__content">
                      <div className="sp-idea-card__header">
                        <h3 className="sp-idea-card__title">{idea.title}</h3>
                        {isAdmin ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <select
                              className="sp-idea-card__status-select"
                              value={idea.status}
                              onChange={(e) => handleStatusChange(idea.id, e.target.value)}
                            >
                              {IDEA_STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            <button
                              className={`sp-idea-card__moderate ${idea.published === false ? 'sp-idea-card__moderate--hidden' : ''}`}
                              onClick={() => handleTogglePublished(idea.id, idea.published !== false)}
                              title={idea.published === false ? 'Republish idea' : 'Hide idea'}
                            >
                              {idea.published === false ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                          </div>
                        ) : (
                          <IdeaStatusBadge status={idea.status} />
                        )}
                      </div>
                      <p className="sp-idea-card__desc">{idea.description}</p>
                      <div className="sp-idea-card__meta">
                        <span>{idea.author}</span>
                        <span>&middot;</span>
                        <span>{idea.category}</span>
                        {idea.product && (
                          <>
                            <span>&middot;</span>
                            <span>{idea.product}</span>
                          </>
                        )}
                        <span>&middot;</span>
                        <Clock size={12} />
                        <span>
                          {new Date(idea.createdDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--fl-spacing-sm)', marginTop: 'var(--fl-spacing-lg)' }}>
                  <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <span style={{ display: 'flex', alignItems: 'center', fontSize: 'var(--fl-font-size-sm)', color: 'var(--fl-color-text-secondary)' }}>
                    Page {page} of {totalPages}
                  </span>
                  <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
