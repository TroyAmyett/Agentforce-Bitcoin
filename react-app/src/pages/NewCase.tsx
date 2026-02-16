import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePortalConfig } from '../hooks/usePortalConfig';
import { CaseAPI } from '../api/salesforce';
import { Button, Input, Select, Textarea } from '@funnelists/ui';
import { ArrowLeft, Paperclip, Monitor, Upload, X, Film, Video, Square } from 'lucide-react';

const MAX_RECORD_SECONDS = 120;

const PRIORITY_OPTIONS = [
  { value: 'Low', label: 'Low' },
  { value: 'Medium', label: 'Medium' },
  { value: 'High', label: 'High' },
  { value: 'Critical', label: 'Critical' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'Select a type (optional)' },
  { value: 'Bug', label: 'Bug' },
  { value: 'Feature Request', label: 'Feature Request' },
  { value: 'Question', label: 'Question' },
  { value: 'Problem', label: 'Problem' },
];

interface PendingFile {
  name: string;
  preview?: string;
  data: string;
}

export function NewCase() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { config: portalConfig } = usePortalConfig();

  const productOptions = useMemo(() => [
    { value: '', label: 'Select a product (optional)' },
    ...portalConfig.productOptions.map((p) => ({ value: p, label: p })),
  ], [portalConfig.productOptions]);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [product, setProduct] = useState('');
  const [caseType, setCaseType] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      const isImage = file.type.startsWith('image/');
      setPendingFiles((prev) => [
        ...prev,
        {
          name: file.name,
          preview: isImage ? (reader.result as string) : undefined,
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

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(addFile);
    }
    e.target.value = '';
  }, [addFile]);

  const captureScreen = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError('Screen capture is not supported in this browser.');
      return;
    }
    setCapturing(true);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => { video.play(); resolve(); };
      });
      // Brief delay to ensure frame is rendered
      await new Promise((r) => setTimeout(r, 100));

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);
      track.stop();

      canvas.toBlob((blob) => {
        if (blob) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const file = new File([blob], `screen-capture-${timestamp}.png`, { type: 'image/png' });
          addFile(file);
        }
      }, 'image/png');
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError('Screen capture failed. Please try the file picker instead.');
      }
    }
    setCapturing(false);
  }, [addFile]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    if (recStreamRef.current) {
      recStreamRef.current.getTracks().forEach((t) => t.stop());
      recStreamRef.current = null;
    }
    if (recTimerRef.current) {
      clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
    setRecording(false);
    setRecordTime(0);
  }, []);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError('Screen recording is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      recStreamRef.current = stream;

      const chunks: Blob[] = [];
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const file = new File([blob], `screen-recording-${timestamp}.webm`, { type: mimeType });
        addFile(file);
      };

      // Auto-stop if user ends sharing via browser UI
      stream.getVideoTracks()[0].onended = () => stopRecording();

      recorder.start(1000);
      setRecording(true);
      setRecordTime(0);
      recTimerRef.current = setInterval(() => {
        setRecordTime((prev) => {
          if (prev + 1 >= MAX_RECORD_SECONDS) {
            stopRecording();
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError('Screen recording failed. Try using Browse Files to upload a video instead.');
      }
    }
  }, [addFile, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recStreamRef.current) {
        recStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (recTimerRef.current) {
        clearInterval(recTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setError('');
    setLoading(true);

    try {
      const result = await CaseAPI.createCase(user.id, subject, description, priority, product || undefined, caseType || undefined);
      if (result.success && result.data) {
        const data = result.data as { id: string };

        // Upload any pending files
        for (const file of pendingFiles) {
          await CaseAPI.uploadAttachment(user.id, data.id, file.name, file.data);
        }

        navigate(`/cases/${data.id}`);
      } else {
        setError(result.error || 'Failed to create case.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--fl-spacing-lg)' }}>
        <Link to="/cases" style={{ color: 'var(--fl-color-primary)', textDecoration: 'none', fontSize: 'var(--fl-font-size-sm)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <ArrowLeft size={14} /> Back to Cases
        </Link>
      </div>

      <div
        ref={dropRef}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          backgroundColor: 'var(--fl-color-bg-elevated)',
          border: dragOver ? '2px dashed var(--fl-color-primary)' : '1px solid var(--fl-color-border)',
          borderRadius: 'var(--fl-radius-lg)',
          padding: 'var(--fl-spacing-xl)',
          transition: 'border 0.15s ease',
        }}
      >
        <h1 style={{ fontSize: 'var(--fl-font-size-xl)', fontWeight: 'var(--fl-font-weight-bold)', margin: '0 0 var(--fl-spacing-lg)' }}>
          New Support Case
        </h1>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--fl-spacing-md)' }}>
          {error && <div className="sp-auth-card__error">{error}</div>}

          <Input
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief description of the issue"
            required
          />

          <div style={{ display: 'grid', gridTemplateColumns: (portalConfig.showProduct || portalConfig.showType) ? '1fr 1fr' : '1fr', gap: 'var(--fl-spacing-md)' }}>
            {portalConfig.showPriority && (
              <Select
                label="Priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                options={PRIORITY_OPTIONS}
              />
            )}
            {portalConfig.showProduct && (
              <Select
                label="Product"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                options={productOptions}
              />
            )}
            {portalConfig.showType && (
              <Select
                label="Type"
                value={caseType}
                onChange={(e) => setCaseType(e.target.value)}
                options={TYPE_OPTIONS}
              />
            )}
          </div>

          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide details about the issue, steps to reproduce, and any relevant information. You can paste screenshots (Ctrl+V) or drag files here."
            rows={6}
            required
          />

          {/* Attachments section */}
          <div className="sp-attachments">
            <label style={{ fontSize: 'var(--fl-font-size-sm)', fontWeight: 'var(--fl-font-weight-medium)', color: 'var(--fl-color-text-primary)' }}>
              Attachments
            </label>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,.pdf,.doc,.docx,.txt,.log,.csv,.zip"
              onChange={handleFileInput}
              style={{ display: 'none' }}
            />

            <div className="sp-attachments__toolbar">
              <button type="button" className="sp-attachments__btn" onClick={() => fileInputRef.current?.click()} disabled={recording}>
                <Upload size={15} />
                <span>Browse Files</span>
              </button>
              <button type="button" className="sp-attachments__btn" onClick={captureScreen} disabled={capturing || recording}>
                <Monitor size={15} />
                <span>{capturing ? 'Capturing...' : 'Screenshot'}</span>
              </button>
              {!recording ? (
                <button type="button" className="sp-attachments__btn" onClick={startRecording} disabled={capturing}>
                  <Video size={15} />
                  <span>Record Screen</span>
                </button>
              ) : (
                <button type="button" className="sp-attachments__btn sp-attachments__btn--recording" onClick={stopRecording}>
                  <Square size={13} />
                  <span>Stop {formatTime(recordTime)}</span>
                </button>
              )}
              <span className="sp-attachments__hint">
                <Paperclip size={12} /> Paste (Ctrl+V) or drag files here
              </span>
            </div>

            {recording && (
              <div className="sp-attachments__recording-bar">
                <span className="sp-attachments__rec-dot" />
                <span>Recording screen... ({MAX_RECORD_SECONDS - recordTime}s remaining)</span>
              </div>
            )}

            {/* File previews */}
            {pendingFiles.length > 0 && (
              <div className="sp-attachments__previews">
                {pendingFiles.map((file, idx) => (
                  <div key={idx} className="sp-attachments__file">
                    {file.preview ? (
                      <img src={file.preview} alt={file.name} className="sp-attachments__thumb" />
                    ) : (
                      <div className="sp-attachments__file-info">
                        <Film size={14} />
                        <span>{file.name}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      className="sp-attachments__remove"
                      onClick={() => removeFile(idx)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 'var(--fl-spacing-sm)', marginTop: 'var(--fl-spacing-sm)' }}>
            <Button variant="primary" type="submit" disabled={loading || recording}>
              {loading ? 'Creating...' : 'Create Case'}
            </Button>
            <Link to="/cases">
              <Button variant="secondary" type="button">Cancel</Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
