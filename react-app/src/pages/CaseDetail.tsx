import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePortalConfig } from '../hooks/usePortalConfig';
import { CaseAPI } from '../api/salesforce';
import { markCaseViewed } from '../utils/caseViews';
import { Button, Textarea } from '@funnelists/ui';
import { ArrowLeft, CheckCircle, Paperclip, Send, Image, X, Download as DownloadIcon, ExternalLink } from 'lucide-react';

interface CaseRecord {
  id: string;
  caseNumber: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  createdDate: string;
  lastModifiedDate: string;
  closedDate?: string;
  origin?: string;
  type?: string;
  product?: string;
  isClosed: boolean;
  contactName?: string;
  accountName?: string;
}

interface CaseComment {
  id: string;
  body: string;
  createdDate: string;
  author?: string;
}

interface Attachment {
  id: string;
  title: string;
  extension: string;
  size: number;
  createdDate: string;
}

interface PendingFile {
  name: string;
  preview?: string;
  data: string;
}

export function CaseDetail() {
  const { caseId } = useParams<{ caseId: string }>();
  const { user } = useAuth();
  const { config: portalConfig } = usePortalConfig();
  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [comments, setComments] = useState<CaseComment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [downloadingAtt, setDownloadingAtt] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || !caseId) return;

    async function loadCase() {
      try {
        const result = await CaseAPI.getCaseDetail(user!.id, caseId!);
        if (result.success && result.data) {
          const data = result.data as Record<string, unknown>;
          setCaseRecord(data.case as CaseRecord);
          setComments((data.comments as CaseComment[]) || []);
          setAttachments((data.attachments as Attachment[]) || []);
          // Mark this case as viewed so unread dot clears on the list
          markCaseViewed(caseId!);
        } else {
          setError(result.error || 'Could not load case.');
        }
      } catch {
        setError('Failed to load case details.');
      }
      setLoading(false);
    }

    loadCase();
  }, [user, caseId]);

  const addFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      const isMedia = file.type.startsWith('image/') || file.type.startsWith('video/');
      setPendingFiles((prev) => [
        ...prev,
        {
          name: file.name,
          preview: isMedia ? (reader.result as string) : undefined,
          data: base64,
        },
      ]);
    };
    reader.readAsDataURL(file);
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const renamed = new File([file], `screenshot-${timestamp}.png`, { type: file.type });
          addFile(renamed);
        }
      }
    }
  }, [addFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer?.files;
    if (files) {
      Array.from(files).forEach(addFile);
    }
  }, [addFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const removeFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadPendingFiles = async () => {
    if (!user?.id || !caseId || pendingFiles.length === 0) return;
    setUploading(true);
    for (const file of pendingFiles) {
      await CaseAPI.uploadAttachment(user.id, caseId, file.name, file.data);
    }
    setPendingFiles([]);
    // Refresh attachments
    const result = await CaseAPI.getCaseDetail(user.id, caseId);
    if (result.success && result.data) {
      const data = result.data as Record<string, unknown>;
      setAttachments((data.attachments as Attachment[]) || []);
    }
    setUploading(false);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user?.id || !caseId) return;

    setSubmitting(true);

    // Upload any pending screenshots along with the comment
    if (pendingFiles.length > 0) {
      await uploadPendingFiles();
    }

    try {
      const result = await CaseAPI.addComment(user.id, caseId, newComment.trim());
      if (result.success) {
        const commentData = result.data as CaseComment;
        setComments((prev) => [
          ...prev,
          {
            id: commentData?.id || String(Date.now()),
            body: commentData?.body || newComment.trim(),
            createdDate: commentData?.createdDate || new Date().toISOString(),
            author: commentData?.author || user.name || 'You',
          },
        ]);
        setNewComment('');
      }
    } catch {
      // Silent fail
    }
    setSubmitting(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id || !caseId) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        await CaseAPI.uploadAttachment(user!.id, caseId!, file.name, base64);
        const result = await CaseAPI.getCaseDetail(user!.id, caseId!);
        if (result.success && result.data) {
          const data = result.data as Record<string, unknown>;
          setAttachments((data.attachments as Attachment[]) || []);
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
  };

  const handleCloseCase = async () => {
    if (!user?.id || !caseId || closing) return;
    if (!confirm('Are you sure you want to close this case?')) return;

    setClosing(true);
    try {
      const result = await CaseAPI.closeCase(user.id, caseId);
      if (result.success) {
        setCaseRecord((prev) => prev ? {
          ...prev,
          status: 'Closed',
          isClosed: true,
          closedDate: new Date().toISOString(),
        } : prev);
      }
    } catch {
      // Silent fail
    }
    setClosing(false);
  };

  const handleViewAttachment = async (att: Attachment) => {
    if (!user?.id || downloadingAtt) return;
    setDownloadingAtt(att.id);
    try {
      const result = await CaseAPI.getAttachmentContent(user.id, att.id);
      if (result.success && result.data) {
        const data = result.data as { base64Data: string; title: string; extension: string };
        const mimeType = getMimeType(data.extension);
        const binary = atob(data.base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mimeType });
        const url = URL.createObjectURL(blob);

        const viewable = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'video/mp4', 'video/webm'].includes(mimeType);
        if (viewable) {
          window.open(url, '_blank');
        } else {
          const a = document.createElement('a');
          a.href = url;
          a.download = `${data.title}${data.extension ? '.' + data.extension : ''}`;
          a.click();
        }
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
    } catch {
      // Silent fail
    }
    setDownloadingAtt(null);
  };

  if (loading) {
    return <div style={{ padding: 'var(--fl-spacing-xl)', color: 'var(--fl-color-text-secondary)' }}>Loading case...</div>;
  }

  if (error || !caseRecord) {
    return (
      <div style={{ padding: 'var(--fl-spacing-xl)' }}>
        <div className="sp-auth-card__error" style={{ marginBottom: 'var(--fl-spacing-md)' }}>{error || 'Case not found.'}</div>
        <Link to="/cases"><Button variant="secondary"><ArrowLeft size={16} /> Back to Cases</Button></Link>
      </div>
    );
  }

  return (
    <div
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div style={{ marginBottom: 'var(--fl-spacing-lg)' }}>
        <Link to="/cases" style={{ color: 'var(--fl-color-primary)', textDecoration: 'none', fontSize: 'var(--fl-font-size-sm)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <ArrowLeft size={14} /> Back to Cases
        </Link>
      </div>

      {/* Drag overlay hint */}
      {dragOver && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.3)', pointerEvents: 'none',
        }}>
          <div style={{
            padding: '24px 48px', borderRadius: '12px', backgroundColor: 'var(--fl-color-bg-elevated)',
            border: '2px dashed var(--fl-color-primary)', fontSize: 'var(--fl-font-size-lg)',
          }}>
            Drop files to attach
          </div>
        </div>
      )}

      {/* Case Header */}
      <div style={{
        backgroundColor: 'var(--fl-color-bg-elevated)',
        border: '1px solid var(--fl-color-border)',
        borderRadius: 'var(--fl-radius-lg)',
        padding: 'var(--fl-spacing-xl)',
        marginBottom: 'var(--fl-spacing-lg)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--fl-spacing-md)' }}>
          <div>
            <span style={{ fontSize: 'var(--fl-font-size-sm)', color: 'var(--fl-color-text-muted)' }}>
              {caseRecord.caseNumber}
            </span>
            <h1 style={{ fontSize: 'var(--fl-font-size-xl)', margin: 'var(--fl-spacing-xs) 0 0' }}>
              {caseRecord.subject}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--fl-spacing-sm)' }}>
            <CaseStatusBadge status={caseRecord.status} />
            {!caseRecord.isClosed && (
              <Button variant="secondary" onClick={handleCloseCase} disabled={closing}>
                <CheckCircle size={14} /> {closing ? 'Closing...' : 'Close Case'}
              </Button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--fl-spacing-md)' }}>
          {portalConfig.showPriority && <DetailField label="Priority" value={caseRecord.priority} />}
          {portalConfig.showProduct && caseRecord.product && <DetailField label="Product" value={caseRecord.product} />}
          {caseRecord.type && portalConfig.showType && <DetailField label="Type" value={caseRecord.type} />}
          <DetailField label="Created" value={new Date(caseRecord.createdDate).toLocaleDateString()} />
          {caseRecord.closedDate && <DetailField label="Closed" value={new Date(caseRecord.closedDate).toLocaleDateString()} />}
          {caseRecord.contactName && <DetailField label="Contact" value={caseRecord.contactName} />}
        </div>

        {caseRecord.description && (
          <div style={{ marginTop: 'var(--fl-spacing-lg)', paddingTop: 'var(--fl-spacing-lg)', borderTop: '1px solid var(--fl-color-border)' }}>
            <h3 style={{ fontSize: 'var(--fl-font-size-sm)', color: 'var(--fl-color-text-muted)', marginBottom: 'var(--fl-spacing-sm)' }}>
              Description
            </h3>
            <p style={{ fontSize: 'var(--fl-font-size-sm)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
              {caseRecord.description}
            </p>
          </div>
        )}
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div style={{
          backgroundColor: 'var(--fl-color-bg-elevated)',
          border: '1px solid var(--fl-color-border)',
          borderRadius: 'var(--fl-radius-lg)',
          padding: 'var(--fl-spacing-lg)',
          marginBottom: 'var(--fl-spacing-lg)',
        }}>
          <h2 style={{ fontSize: 'var(--fl-font-size-md)', marginBottom: 'var(--fl-spacing-md)', margin: '0 0 var(--fl-spacing-md)' }}>
            Attachments ({attachments.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--fl-spacing-sm)' }}>
            {attachments.map((att) => {
              const fileName = att.title + (att.extension && !att.title.endsWith('.' + att.extension) ? '.' + att.extension : '');
              const isViewable = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'txt', 'mp4', 'webm'].includes(att.extension?.toLowerCase());
              return (
                <div
                  key={att.id}
                  onClick={() => handleViewAttachment(att)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--fl-spacing-sm)',
                    padding: 'var(--fl-spacing-sm) var(--fl-spacing-md)',
                    backgroundColor: 'var(--fl-color-bg-surface)',
                    borderRadius: 'var(--fl-radius-md)',
                    fontSize: 'var(--fl-font-size-sm)',
                    cursor: downloadingAtt ? 'wait' : 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'var(--fl-color-bg-hover, rgba(0,0,0,0.05))'; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'var(--fl-color-bg-surface)'; }}
                >
                  <Paperclip size={14} style={{ flexShrink: 0 }} />
                  <span style={{ color: 'var(--fl-color-primary)', flex: 1 }}>{fileName}</span>
                  <span style={{ color: 'var(--fl-color-text-muted)', fontSize: 'var(--fl-font-size-xs)', whiteSpace: 'nowrap' }}>
                    {downloadingAtt === att.id ? 'Loading...' : formatFileSize(att.size)}
                  </span>
                  {isViewable ? <ExternalLink size={13} style={{ color: 'var(--fl-color-text-muted)', flexShrink: 0 }} /> : <DownloadIcon size={13} style={{ color: 'var(--fl-color-text-muted)', flexShrink: 0 }} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Comments */}
      <div style={{
        backgroundColor: 'var(--fl-color-bg-elevated)',
        border: '1px solid var(--fl-color-border)',
        borderRadius: 'var(--fl-radius-lg)',
        padding: 'var(--fl-spacing-lg)',
      }}>
        <h2 style={{ fontSize: 'var(--fl-font-size-md)', margin: '0 0 var(--fl-spacing-md)' }}>
          Comments ({comments.length})
        </h2>

        {comments.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--fl-spacing-md)', marginBottom: 'var(--fl-spacing-lg)' }}>
            {comments.map((comment) => (
              <div key={comment.id} style={{
                padding: 'var(--fl-spacing-md)',
                backgroundColor: 'var(--fl-color-bg-surface)',
                borderRadius: 'var(--fl-radius-md)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--fl-spacing-xs)' }}>
                  <span style={{ fontSize: 'var(--fl-font-size-sm)', fontWeight: 'var(--fl-font-weight-medium)' }}>
                    {comment.author || 'Unknown'}
                  </span>
                  <span style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-muted)' }}>
                    {new Date(comment.createdDate).toLocaleString()}
                  </span>
                </div>
                <p style={{ fontSize: 'var(--fl-font-size-sm)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {comment.body}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--fl-color-text-secondary)', fontSize: 'var(--fl-font-size-sm)', marginBottom: 'var(--fl-spacing-lg)' }}>
            No comments yet.
          </p>
        )}

        {/* Add Comment Form */}
        {caseRecord.isClosed ? (
          <div style={{
            borderTop: '1px solid var(--fl-color-border)',
            paddingTop: 'var(--fl-spacing-md)',
            color: 'var(--fl-color-text-muted)',
            fontSize: 'var(--fl-font-size-sm)',
            textAlign: 'center',
          }}>
            This case is closed. Reopen the case to add comments.
          </div>
        ) : (
          <form onSubmit={handleAddComment} style={{ borderTop: '1px solid var(--fl-color-border)', paddingTop: 'var(--fl-spacing-md)' }}>
            <Textarea
              label=""
              placeholder="Add a comment... (paste screenshots with Ctrl+V)"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
            />

            {/* Pending screenshot previews */}
            {pendingFiles.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--fl-spacing-sm)', marginTop: 'var(--fl-spacing-sm)' }}>
                {pendingFiles.map((file, idx) => (
                  <div key={idx} style={{
                    position: 'relative',
                    border: '1px solid var(--fl-color-border)',
                    borderRadius: 'var(--fl-radius-md)',
                    padding: '4px',
                    backgroundColor: 'var(--fl-color-bg-surface)',
                  }}>
                    {file.preview && file.name.match(/\.(mp4|webm|mov)$/i) ? (
                      <video src={file.preview} style={{ maxWidth: '100px', maxHeight: '60px', borderRadius: '4px', display: 'block' }} muted />
                    ) : file.preview ? (
                      <img src={file.preview} alt={file.name} style={{ maxWidth: '100px', maxHeight: '60px', borderRadius: '4px', display: 'block' }} />
                    ) : (
                      <div style={{ padding: '6px 10px', fontSize: 'var(--fl-font-size-xs)', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      style={{
                        position: 'absolute', top: '-6px', right: '-6px',
                        width: '18px', height: '18px', borderRadius: '50%',
                        backgroundColor: 'var(--fl-color-danger, #ef4444)', color: '#fff',
                        border: 'none', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', padding: 0,
                      }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--fl-spacing-sm)', marginTop: 'var(--fl-spacing-sm)', alignItems: 'center' }}>
              <Button variant="primary" type="submit" disabled={submitting || (!newComment.trim() && pendingFiles.length === 0)}>
                <Send size={14} /> {submitting ? 'Sending...' : 'Add Comment'}
              </Button>
              <label style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 16px',
                borderRadius: 'var(--fl-radius-md)',
                border: '1px solid var(--fl-color-border)',
                cursor: 'pointer',
                fontSize: 'var(--fl-font-size-sm)',
                color: 'var(--fl-color-text-secondary)',
              }}>
                <Paperclip size={14} /> {uploading ? 'Uploading...' : 'Attach File'}
                <input type="file" accept="image/*,video/*,.pdf,.doc,.docx,.txt,.csv,.log,.zip" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploading} />
              </label>
              <span style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Image size={12} /> Paste screenshots (Ctrl+V) or attach images &amp; videos
              </span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-muted)', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: 'var(--fl-font-size-sm)' }}>{value}</div>
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getMimeType(ext: string): string {
  const types: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf',
    txt: 'text/plain', csv: 'text/csv', log: 'text/plain',
    doc: 'application/msword', zip: 'application/zip',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    webm: 'video/webm', mp4: 'video/mp4',
  };
  return types[ext?.toLowerCase()] || 'application/octet-stream';
}
