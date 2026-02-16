import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AIAPI } from '../../api/salesforce';
import { Button, Input } from '@funnelists/ui';
import { RichContent } from '../../components/RichContent';
import { MarkdownToolbar } from '../../components/MarkdownToolbar';
import {
  ArrowLeft,
  BookOpen,
  Brain,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  Eye,
  EyeOff,
  Check,
  X,
} from 'lucide-react';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  published: boolean;
  sourceDocument?: string;
}

const CATEGORIES = [
  'Getting Started',
  'Account & Settings',
  'Products & Features',
  'Troubleshooting',
  'Billing',
  'Other',
];

export function FAQGenerator() {
  // Generate section
  const [docText, setDocText] = useState('');
  const [docName, setDocName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genResults, setGenResults] = useState<FAQ[]>([]);
  const [genError, setGenError] = useState('');

  // Manage section
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loadingFaqs, setLoadingFaqs] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ question: '', answer: '', category: '' });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const answerRef = useRef<HTMLTextAreaElement>(null);

  // Load all FAQs on mount
  useEffect(() => {
    loadFAQs();
  }, []);

  const loadFAQs = async () => {
    try {
      const result = await AIAPI.getAdminFAQs();
      const resp = result as { success?: boolean; data?: { faqs?: FAQ[] } };
      setFaqs(resp.data?.faqs || []);
    } catch {
      setError('Failed to load FAQs.');
    }
    setLoadingFaqs(false);
  };

  // Generate FAQs from document
  const handleGenerate = async () => {
    if (!docText.trim()) return;
    setGenerating(true);
    setGenError('');
    setGenResults([]);

    try {
      const result = await AIAPI.generateFAQs(docText, docName || 'Untitled Document');
      const resp = result as { success?: boolean; data?: { faqs?: FAQ[]; count?: number } };
      const genData = resp.data;
      if (genData?.faqs && genData.faqs.length > 0) {
        setGenResults(genData.faqs);
        setSuccess(`Generated ${genData.count || genData.faqs.length} FAQ(s). Review below and publish when ready.`);
        // Refresh the manage section
        loadFAQs();
      } else {
        setGenError('No FAQs were generated. Try providing more content.');
      }
    } catch {
      setGenError('Failed to generate FAQs. Check your AI provider configuration in Portal Settings.');
    }
    setGenerating(false);
  };

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setDocText(ev.target?.result as string || '');
      setDocName(file.name.replace(/\.[^.]+$/, ''));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Edit FAQ
  const startEdit = (faq: FAQ) => {
    setEditingId(faq.id);
    setEditForm({ question: faq.question, answer: faq.answer, category: faq.category });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (faq: FAQ) => {
    setSavingId(faq.id);
    try {
      await AIAPI.updateFAQ(faq.id, editForm.question, editForm.answer, editForm.category, faq.published);
      setFaqs((prev) =>
        prev.map((f) =>
          f.id === faq.id
            ? { ...f, question: editForm.question, answer: editForm.answer, category: editForm.category }
            : f,
        ),
      );
      setEditingId(null);
      setSuccess('FAQ updated.');
    } catch {
      setError('Failed to update FAQ.');
    }
    setSavingId(null);
  };

  // Toggle publish
  const togglePublish = async (faq: FAQ) => {
    setSavingId(faq.id);
    try {
      await AIAPI.updateFAQ(faq.id, faq.question, faq.answer, faq.category, !faq.published);
      setFaqs((prev) =>
        prev.map((f) => (f.id === faq.id ? { ...f, published: !f.published } : f)),
      );
    } catch {
      setError('Failed to update FAQ.');
    }
    setSavingId(null);
  };

  // Delete FAQ
  const handleDelete = async (faqId: string) => {
    setDeletingId(faqId);
    try {
      await AIAPI.deleteFAQ(faqId);
      setFaqs((prev) => prev.filter((f) => f.id !== faqId));
      setSuccess('FAQ deleted.');
    } catch {
      setError('Failed to delete FAQ.');
    }
    setDeletingId(null);
  };

  // Clear messages after 4 seconds
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(''), 4000);
      return () => clearTimeout(t);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(''), 4000);
      return () => clearTimeout(t);
    }
  }, [error]);

  const publishedCount = faqs.filter((f) => f.published).length;
  const draftCount = faqs.filter((f) => !f.published).length;

  return (
    <div>
      <div style={{ marginBottom: 'var(--fl-spacing-lg)' }}>
        <Link
          to="/admin"
          style={{
            color: 'var(--fl-color-primary)',
            textDecoration: 'none',
            fontSize: 'var(--fl-font-size-sm)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <ArrowLeft size={14} /> Admin Dashboard
        </Link>
      </div>

      <div className="sp-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Brain size={22} style={{ color: 'var(--fl-color-primary)' }} />
          <h1 className="sp-page-header__title">FAQ Manager</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', fontSize: 'var(--fl-font-size-sm)', color: 'var(--fl-color-text-secondary)' }}>
          <span style={{ color: 'var(--fl-color-success)' }}>{publishedCount} published</span>
          <span>|</span>
          <span>{draftCount} draft</span>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="sp-auth-card__error" style={{ marginBottom: 'var(--fl-spacing-md)' }}>
          {error}
        </div>
      )}
      {success && (
        <div
          style={{
            color: 'var(--fl-color-success)',
            fontSize: 'var(--fl-font-size-sm)',
            padding: 'var(--fl-spacing-sm) var(--fl-spacing-md)',
            background: 'rgba(22, 163, 74, 0.08)',
            borderRadius: 'var(--fl-radius-md)',
            marginBottom: 'var(--fl-spacing-md)',
          }}
        >
          {success}
        </div>
      )}

      {/* Generate Section */}
      <div
        style={{
          maxWidth: '900px',
          backgroundColor: 'var(--fl-color-bg-elevated)',
          border: '1px solid var(--fl-color-border)',
          borderRadius: 'var(--fl-radius-lg)',
          padding: 'var(--fl-spacing-xl)',
          marginBottom: 'var(--fl-spacing-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--fl-spacing-sm)' }}>
          <Brain size={18} style={{ color: 'var(--fl-color-primary)' }} />
          <h2 style={{ fontSize: 'var(--fl-font-size-lg)', margin: 0, fontWeight: 'var(--fl-font-weight-semibold)' }}>
            Generate FAQs with AI
          </h2>
        </div>
        <p style={{ fontSize: 'var(--fl-font-size-sm)', color: 'var(--fl-color-text-secondary)', margin: '0 0 var(--fl-spacing-lg)' }}>
          Paste documentation, product guides, or any text content. AI will generate FAQ question-and-answer pairs that you can review and publish to your Help page.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--fl-spacing-md)' }}>
          <div style={{ display: 'flex', gap: 'var(--fl-spacing-md)', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Input
                label="Document Name"
                value={docName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDocName(e.target.value)}
                placeholder="e.g. Product Overview, Getting Started Guide"
              />
            </div>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                backgroundColor: 'var(--fl-color-bg-surface)',
                border: '1px solid var(--fl-color-border)',
                borderRadius: 'var(--fl-radius-md)',
                cursor: 'pointer',
                fontSize: 'var(--fl-font-size-sm)',
                color: 'var(--fl-color-text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              <Upload size={14} />
              Upload .txt/.md
              <input
                type="file"
                accept=".txt,.md,.text,.markdown"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          <div>
            <div style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-muted)', marginBottom: '4px' }}>
              Document Content
            </div>
            <textarea
              value={docText}
              onChange={(e) => setDocText(e.target.value)}
              placeholder="Paste your documentation, product guides, release notes, or any text content here..."
              rows={10}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'var(--fl-color-bg)',
                color: 'var(--fl-color-text-primary)',
                border: '1px solid var(--fl-color-border)',
                borderRadius: 'var(--fl-radius-md)',
                fontSize: 'var(--fl-font-size-sm)',
                resize: 'vertical',
                boxSizing: 'border-box',
                lineHeight: 1.6,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--fl-spacing-sm)' }}>
              <span style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-muted)' }}>
                {docText.length > 0 ? `${docText.length.toLocaleString()} characters` : ''}
              </span>
              <Button
                variant="primary"
                onClick={handleGenerate}
                disabled={!docText.trim() || generating}
              >
                {generating ? <Loader2 size={16} className="sp-spin" /> : <Brain size={16} />}
                {generating ? 'Generating...' : 'Generate FAQs'}
              </Button>
            </div>
          </div>

          {genError && (
            <div className="sp-auth-card__error">{genError}</div>
          )}

          {/* Generated results preview */}
          {genResults.length > 0 && (
            <div style={{ borderTop: '1px solid var(--fl-color-border)', paddingTop: 'var(--fl-spacing-md)' }}>
              <div style={{ fontSize: 'var(--fl-font-size-sm)', fontWeight: 'var(--fl-font-weight-medium)', marginBottom: 'var(--fl-spacing-sm)' }}>
                Generated {genResults.length} FAQ(s) — saved as drafts
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--fl-spacing-sm)' }}>
                {genResults.map((faq, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: 'var(--fl-color-bg-surface)',
                      borderRadius: 'var(--fl-radius-md)',
                      border: '1px solid var(--fl-color-border)',
                    }}
                  >
                    <div style={{ fontSize: 'var(--fl-font-size-sm)', fontWeight: 'var(--fl-font-weight-medium)', marginBottom: '4px' }}>
                      {faq.question}
                    </div>
                    <div style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-secondary)', lineHeight: 1.5 }}>
                      {faq.answer.length > 200 ? faq.answer.slice(0, 200) + '...' : faq.answer}
                    </div>
                    <div style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-muted)', marginTop: '4px' }}>
                      {faq.category}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manage Section */}
      <div style={{ maxWidth: '900px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--fl-spacing-md)' }}>
          <BookOpen size={18} style={{ color: 'var(--fl-color-primary)' }} />
          <h2 style={{ fontSize: 'var(--fl-font-size-lg)', margin: 0, fontWeight: 'var(--fl-font-weight-semibold)' }}>
            Manage FAQs
          </h2>
        </div>

        {loadingFaqs ? (
          <div style={{ padding: 'var(--fl-spacing-xl)', color: 'var(--fl-color-text-secondary)', textAlign: 'center' }}>
            <Loader2 size={20} className="sp-spin" style={{ display: 'inline-block', marginRight: '8px' }} />
            Loading FAQs...
          </div>
        ) : faqs.length === 0 ? (
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
            <FileText size={32} style={{ color: 'var(--fl-color-text-muted)', marginBottom: '8px' }} />
            <p style={{ margin: '0 0 4px' }}>No FAQs yet.</p>
            <p style={{ fontSize: 'var(--fl-font-size-sm)', margin: 0 }}>
              Use the generator above to create AI-powered FAQ content.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--fl-spacing-sm)' }}>
            {faqs.map((faq) => (
              <div
                key={faq.id}
                style={{
                  backgroundColor: 'var(--fl-color-bg-elevated)',
                  border: `1px solid ${faq.published ? 'var(--fl-color-border)' : 'rgba(217, 119, 6, 0.2)'}`,
                  borderRadius: 'var(--fl-radius-lg)',
                  padding: 'var(--fl-spacing-md)',
                }}
              >
                {editingId === faq.id ? (
                  // Edit mode
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--fl-spacing-sm)' }}>
                    <Input
                      label="Question"
                      value={editForm.question}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setEditForm((prev) => ({ ...prev, question: e.target.value }))
                      }
                    />
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-muted)' }}>
                          Answer (Markdown)
                        </div>
                        <button
                          type="button"
                          onClick={() => setPreviewId(previewId === faq.id ? null : faq.id)}
                          style={{
                            padding: '2px 8px',
                            fontSize: 'var(--fl-font-size-xs)',
                            color: 'var(--fl-color-primary)',
                            background: 'none',
                            border: '1px solid var(--fl-color-primary)',
                            borderRadius: 'var(--fl-radius-sm)',
                            cursor: 'pointer',
                          }}
                        >
                          {previewId === faq.id ? 'Edit' : 'Preview'}
                        </button>
                      </div>
                      {previewId === faq.id ? (
                        <div className="sp-md-preview">
                          <RichContent content={editForm.answer} />
                        </div>
                      ) : (
                        <>
                          <MarkdownToolbar
                            textareaRef={answerRef}
                            value={editForm.answer}
                            onChange={(v) => setEditForm((prev) => ({ ...prev, answer: v }))}
                          />
                          <textarea
                            ref={answerRef}
                            value={editForm.answer}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, answer: e.target.value }))}
                            rows={6}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              backgroundColor: 'var(--fl-color-bg)',
                              color: 'var(--fl-color-text-primary)',
                              border: '1px solid var(--fl-color-border)',
                              borderTop: 'none',
                              borderRadius: '0 0 var(--fl-radius-md) var(--fl-radius-md)',
                              fontSize: 'var(--fl-font-size-sm)',
                              fontFamily: 'monospace',
                              resize: 'vertical',
                              boxSizing: 'border-box',
                            }}
                          />
                        </>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-muted)', marginBottom: '4px' }}>
                        Category
                      </div>
                      <select
                        value={editForm.category}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          backgroundColor: 'var(--fl-color-bg)',
                          color: 'var(--fl-color-text-primary)',
                          border: '1px solid var(--fl-color-border)',
                          borderRadius: 'var(--fl-radius-md)',
                          fontSize: 'var(--fl-font-size-sm)',
                        }}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <Button variant="secondary" onClick={cancelEdit}>
                        <X size={14} /> Cancel
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => saveEdit(faq)}
                        disabled={savingId === faq.id}
                      >
                        {savingId === faq.id ? <Loader2 size={14} className="sp-spin" /> : <Save size={14} />}
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 'var(--fl-font-size-sm)', fontWeight: 'var(--fl-font-weight-medium)', marginBottom: '4px' }}>
                          {faq.question}
                        </div>
                        <div style={{ fontSize: 'var(--fl-font-size-xs)' }}>
                          <RichContent content={faq.answer} />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-muted)' }}>
                          <span>{faq.category}</span>
                          {faq.sourceDocument && (
                            <>
                              <span>|</span>
                              <span>Source: {faq.sourceDocument}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button
                          onClick={() => togglePublish(faq)}
                          disabled={savingId === faq.id}
                          title={faq.published ? 'Unpublish' : 'Publish'}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: 'var(--fl-radius-md)',
                            border: '1px solid var(--fl-color-border)',
                            backgroundColor: faq.published ? 'rgba(22, 163, 74, 0.08)' : 'transparent',
                            color: faq.published ? 'var(--fl-color-success)' : 'var(--fl-color-text-muted)',
                            cursor: 'pointer',
                            fontSize: 'var(--fl-font-size-xs)',
                          }}
                        >
                          {savingId === faq.id ? (
                            <Loader2 size={12} className="sp-spin" />
                          ) : faq.published ? (
                            <Eye size={12} />
                          ) : (
                            <EyeOff size={12} />
                          )}
                          {faq.published ? 'Published' : 'Draft'}
                        </button>
                        <button
                          onClick={() => startEdit(faq)}
                          title="Edit"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '4px 8px',
                            borderRadius: 'var(--fl-radius-md)',
                            border: '1px solid var(--fl-color-border)',
                            backgroundColor: 'transparent',
                            color: 'var(--fl-color-text-muted)',
                            cursor: 'pointer',
                          }}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(faq.id)}
                          disabled={deletingId === faq.id}
                          title="Delete"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '4px 8px',
                            borderRadius: 'var(--fl-radius-md)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            backgroundColor: 'transparent',
                            color: 'var(--fl-color-error, #ef4444)',
                            cursor: 'pointer',
                          }}
                        >
                          {deletingId === faq.id ? <Loader2 size={12} className="sp-spin" /> : <Trash2 size={12} />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
