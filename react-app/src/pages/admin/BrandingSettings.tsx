import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ThemeAPI } from '../../api/salesforce';
import { Button, Input } from '@funnelists/ui';
import { ArrowLeft, Globe, Palette, RefreshCw, RotateCcw } from 'lucide-react';

interface ExtractedTheme {
  primaryColor: string;
  secondaryColor: string;
  bgColor: string;
  surfaceColor: string;
  textColor: string;
  fontFamily: string;
  logoUrl: string;
  faviconUrl: string;
  isDark: boolean;
  headerHtml?: string;
  footerHtml?: string;
  siteCssUrls?: string[];
}

export function BrandingSettings() {
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [theme, setTheme] = useState<ExtractedTheme>({
    primaryColor: '#2563eb',
    secondaryColor: '#16a34a',
    bgColor: '#f8fafc',
    surfaceColor: '#f1f5f9',
    textColor: '#0f172a',
    fontFamily: 'Inter, sans-serif',
    logoUrl: '',
    faviconUrl: '',
    isDark: false,
    headerHtml: '',
    footerHtml: '',
    siteCssUrls: [],
  });
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load existing theme on mount
  useEffect(() => {
    async function loadTheme() {
      try {
        const result = await ThemeAPI.getTheme();
        if (result.success && result.data) {
          const data = result.data as {
            themeJson: string;
            logoUrl: string;
            companyName: string;
            sourceUrl: string;
          };
          if (data.themeJson) {
            try {
              const parsed = JSON.parse(data.themeJson) as ExtractedTheme;
              setTheme(parsed);
            } catch { /* ignore parse errors */ }
          }
          if (data.logoUrl) setLogoUrl(data.logoUrl);
          if (data.companyName) setCompanyName(data.companyName);
          if (data.sourceUrl) setWebsiteUrl(data.sourceUrl);
        }
      } catch {
        // No existing theme
      }
    }
    loadTheme();
  }, []);

  const handleExtract = async () => {
    if (!websiteUrl) return;
    setError('');
    setSuccess('');
    setExtracting(true);

    try {
      const result = await ThemeAPI.fetchWebsite(websiteUrl);
      if (result.success && result.data) {
        const data = result.data as { html: string; cssContents: string[]; cssUrls: string[]; favicon: string; sourceUrl: string };
        const extracted = extractThemeFromData(data.html, data.cssContents || []);
        if (data.favicon) extracted.faviconUrl = data.favicon;
        if (data.cssUrls) extracted.siteCssUrls = data.cssUrls;
        setTheme(extracted);
        if (extracted.logoUrl) setLogoUrl(extracted.logoUrl);
        setSuccess(
          'Theme extracted!' +
          (extracted.headerHtml ? ' Header captured.' : '') +
          (extracted.footerHtml ? ' Footer captured.' : '') +
          ' Review the preview below and save when ready.'
        );
      } else {
        setError(result.error || 'Failed to fetch website.');
      }
    } catch {
      setError('Could not extract theme from this URL.');
    }
    setExtracting(false);
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const themeJson = JSON.stringify(theme);
      const result = await ThemeAPI.saveTheme(themeJson, logoUrl, companyName, websiteUrl);
      if (result.success) {
        setSuccess('Theme saved! Refresh the portal to see changes.');
      } else {
        setError(result.error || 'Failed to save theme.');
      }
    } catch {
      setError('Something went wrong.');
    }
    setSaving(false);
  };

  const handleReset = async () => {
    setError('');
    setSuccess('');
    setResetting(true);

    try {
      const result = await ThemeAPI.resetToDemo();
      if (result.success) {
        setTheme({
          primaryColor: '#2563eb',
          secondaryColor: '#16a34a',
          bgColor: '#f8fafc',
          surfaceColor: '#f1f5f9',
          textColor: '#0f172a',
          fontFamily: 'Inter, sans-serif',
          logoUrl: '',
          faviconUrl: '',
          isDark: false,
          headerHtml: '',
          footerHtml: '',
          siteCssUrls: [],
        });
        setLogoUrl('');
        setCompanyName('');
        setWebsiteUrl('');
        setConfirmReset(false);
        setSuccess('Theme reset to defaults. Refresh the portal to see changes.');
      } else {
        setError(result.error || 'Failed to reset theme.');
      }
    } catch {
      setError('Something went wrong.');
    }
    setResetting(false);
  };

  const updateThemeField = (field: keyof ExtractedTheme, value: string | boolean) => {
    setTheme((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--fl-spacing-lg)' }}>
        <Link to="/admin" style={{ color: 'var(--fl-color-primary)', textDecoration: 'none', fontSize: 'var(--fl-font-size-sm)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <ArrowLeft size={14} /> Admin Dashboard
        </Link>
      </div>

      <div className="sp-page-header">
        <h1 className="sp-page-header__title">Branding & Theme</h1>
      </div>

      {error && <div className="sp-auth-card__error" style={{ marginBottom: 'var(--fl-spacing-md)' }}>{error}</div>}
      {success && (
        <div style={{
          color: 'var(--fl-color-success)',
          fontSize: 'var(--fl-font-size-sm)',
          padding: 'var(--fl-spacing-sm) var(--fl-spacing-md)',
          background: 'rgba(22, 163, 74, 0.08)',
          borderRadius: 'var(--fl-radius-md)',
          marginBottom: 'var(--fl-spacing-md)',
        }}>
          {success}
        </div>
      )}

      {/* Website URL Extraction */}
      <div style={{
        backgroundColor: 'var(--fl-color-bg-elevated)',
        border: '1px solid var(--fl-color-border)',
        borderRadius: 'var(--fl-radius-lg)',
        padding: 'var(--fl-spacing-xl)',
        marginBottom: 'var(--fl-spacing-lg)',
      }}>
        <h2 style={{ fontSize: 'var(--fl-font-size-lg)', margin: '0 0 var(--fl-spacing-sm)', display: 'flex', alignItems: 'center', gap: 'var(--fl-spacing-sm)' }}>
          <Globe size={20} /> Extract Theme from Website
        </h2>
        <p style={{ fontSize: 'var(--fl-font-size-sm)', color: 'var(--fl-color-text-secondary)', margin: '0 0 var(--fl-spacing-md)' }}>
          Enter a website URL and we'll automatically extract colors, fonts, and logo to match the portal.
        </p>

        <div style={{ display: 'flex', gap: 'var(--fl-spacing-sm)', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <Input
              label="Website URL"
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </div>
          <Button variant="primary" onClick={handleExtract} disabled={extracting || !websiteUrl}>
            <RefreshCw size={14} className={extracting ? 'sp-spin' : ''} />
            {extracting ? 'Extracting...' : 'Extract Theme'}
          </Button>
        </div>
      </div>

      {/* Header / Footer Capture */}
      {(theme.headerHtml || theme.footerHtml) && (
        <div style={{
          backgroundColor: 'var(--fl-color-bg-elevated)',
          border: '1px solid var(--fl-color-border)',
          borderRadius: 'var(--fl-radius-lg)',
          padding: 'var(--fl-spacing-xl)',
          marginBottom: 'var(--fl-spacing-lg)',
        }}>
          <h2 style={{ fontSize: 'var(--fl-font-size-lg)', margin: '0 0 var(--fl-spacing-sm)' }}>
            Site Header & Footer
          </h2>
          <p style={{ fontSize: 'var(--fl-font-size-sm)', color: 'var(--fl-color-text-secondary)', margin: '0 0 var(--fl-spacing-md)' }}>
            The header and footer from the website will frame your portal, making it look seamless with the client&apos;s existing site.
          </p>

          {theme.headerHtml && (
            <div style={{ marginBottom: 'var(--fl-spacing-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--fl-spacing-xs)' }}>
                <span style={{ fontSize: 'var(--fl-font-size-sm)', fontWeight: 'var(--fl-font-weight-medium)' }}>Header</span>
                <button
                  onClick={() => setTheme((prev) => ({ ...prev, headerHtml: '' }))}
                  style={{ border: 'none', background: 'none', color: 'var(--fl-color-text-muted)', cursor: 'pointer', fontSize: 'var(--fl-font-size-xs)' }}
                >
                  Remove
                </button>
              </div>
              <div style={{
                border: '1px solid var(--fl-color-border)',
                borderRadius: 'var(--fl-radius-md)',
                padding: 'var(--fl-spacing-sm)',
                maxHeight: '120px',
                overflow: 'auto',
                backgroundColor: 'var(--fl-color-bg-surface)',
                fontSize: 'var(--fl-font-size-xs)',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>
                {theme.headerHtml.substring(0, 500)}{theme.headerHtml.length > 500 ? '...' : ''}
              </div>
            </div>
          )}

          {theme.footerHtml && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--fl-spacing-xs)' }}>
                <span style={{ fontSize: 'var(--fl-font-size-sm)', fontWeight: 'var(--fl-font-weight-medium)' }}>Footer</span>
                <button
                  onClick={() => setTheme((prev) => ({ ...prev, footerHtml: '' }))}
                  style={{ border: 'none', background: 'none', color: 'var(--fl-color-text-muted)', cursor: 'pointer', fontSize: 'var(--fl-font-size-xs)' }}
                >
                  Remove
                </button>
              </div>
              <div style={{
                border: '1px solid var(--fl-color-border)',
                borderRadius: 'var(--fl-radius-md)',
                padding: 'var(--fl-spacing-sm)',
                maxHeight: '120px',
                overflow: 'auto',
                backgroundColor: 'var(--fl-color-bg-surface)',
                fontSize: 'var(--fl-font-size-xs)',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>
                {theme.footerHtml.substring(0, 500)}{theme.footerHtml.length > 500 ? '...' : ''}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--fl-spacing-lg)' }}>
        {/* Theme Controls */}
        <div style={{
          backgroundColor: 'var(--fl-color-bg-elevated)',
          border: '1px solid var(--fl-color-border)',
          borderRadius: 'var(--fl-radius-lg)',
          padding: 'var(--fl-spacing-xl)',
        }}>
          <h2 style={{ fontSize: 'var(--fl-font-size-lg)', margin: '0 0 var(--fl-spacing-lg)', display: 'flex', alignItems: 'center', gap: 'var(--fl-spacing-sm)' }}>
            <Palette size={20} /> Theme Settings
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--fl-spacing-md)' }}>
            <Input
              label="Company Name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Your Company"
            />

            <Input
              label="Logo URL"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />

            <ColorField
              label="Primary Color"
              value={theme.primaryColor}
              onChange={(v) => updateThemeField('primaryColor', v)}
            />

            <ColorField
              label="Secondary Color"
              value={theme.secondaryColor}
              onChange={(v) => updateThemeField('secondaryColor', v)}
            />

            <ColorField
              label="Background Color"
              value={theme.bgColor}
              onChange={(v) => updateThemeField('bgColor', v)}
            />

            <ColorField
              label="Surface Color"
              value={theme.surfaceColor}
              onChange={(v) => updateThemeField('surfaceColor', v)}
            />

            <ColorField
              label="Text Color"
              value={theme.textColor}
              onChange={(v) => updateThemeField('textColor', v)}
            />

            <Input
              label="Font Family"
              value={theme.fontFamily}
              onChange={(e) => updateThemeField('fontFamily', e.target.value)}
              placeholder="Inter, sans-serif"
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--fl-spacing-sm)' }}>
              <input
                type="checkbox"
                id="darkMode"
                checked={theme.isDark}
                onChange={(e) => updateThemeField('isDark', e.target.checked)}
              />
              <label htmlFor="darkMode" style={{ fontSize: 'var(--fl-font-size-sm)' }}>Dark mode</label>
            </div>

            <div style={{ display: 'flex', gap: 'var(--fl-spacing-sm)' }}>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Theme'}
              </Button>
              {!confirmReset ? (
                <Button variant="secondary" onClick={() => setConfirmReset(true)}>
                  <RotateCcw size={14} />
                  Reset to Demo
                </Button>
              ) : (
                <Button variant="secondary" onClick={handleReset} disabled={resetting}
                  style={{ color: 'var(--fl-color-error)', borderColor: 'var(--fl-color-error)' }}>
                  {resetting ? 'Resetting...' : 'Confirm Reset'}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div style={{
          backgroundColor: 'var(--fl-color-bg-elevated)',
          border: '1px solid var(--fl-color-border)',
          borderRadius: 'var(--fl-radius-lg)',
          padding: 'var(--fl-spacing-xl)',
        }}>
          <h2 style={{ fontSize: 'var(--fl-font-size-lg)', margin: '0 0 var(--fl-spacing-lg)' }}>Live Preview</h2>

          <div style={{
            backgroundColor: theme.bgColor,
            color: theme.textColor,
            fontFamily: theme.fontFamily,
            borderRadius: 'var(--fl-radius-lg)',
            overflow: 'hidden',
            border: '1px solid var(--fl-color-border)',
          }}>
            {/* Preview Header */}
            <div style={{
              backgroundColor: theme.surfaceColor,
              padding: 'var(--fl-spacing-md)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--fl-spacing-sm)',
              borderBottom: `1px solid ${theme.primaryColor}22`,
            }}>
              {logoUrl && <img src={logoUrl} alt="" style={{ maxHeight: '24px' }} />}
              <span style={{ fontWeight: 600, fontSize: '14px' }}>
                {companyName || 'Support Portal'}
              </span>
            </div>

            {/* Preview Content */}
            <div style={{ padding: 'var(--fl-spacing-md)' }}>
              <h3 style={{ fontSize: '14px', margin: '0 0 8px' }}>Welcome Back</h3>
              <p style={{ fontSize: '12px', opacity: 0.7, margin: '0 0 12px' }}>Sign in to your support portal</p>

              <div style={{
                backgroundColor: theme.surfaceColor,
                borderRadius: '6px',
                padding: '8px 12px',
                marginBottom: '8px',
                fontSize: '12px',
                opacity: 0.5,
              }}>
                email@example.com
              </div>

              <div style={{
                backgroundColor: theme.primaryColor,
                color: '#fff',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '12px',
                textAlign: 'center',
                fontWeight: 600,
              }}>
                Sign In
              </div>

              <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                <div style={{
                  flex: 1,
                  backgroundColor: theme.surfaceColor,
                  borderRadius: '6px',
                  padding: '8px',
                  fontSize: '10px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontWeight: 600, fontSize: '16px', color: theme.primaryColor }}>12</div>
                  Open Cases
                </div>
                <div style={{
                  flex: 1,
                  backgroundColor: theme.surfaceColor,
                  borderRadius: '6px',
                  padding: '8px',
                  fontSize: '10px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontWeight: 600, fontSize: '16px', color: theme.secondaryColor }}>5</div>
                  Resolved
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--fl-spacing-sm)' }}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '36px', height: '36px', border: 'none', borderRadius: 'var(--fl-radius-md)', cursor: 'pointer', padding: 0, background: 'none' }}
      />
      <div style={{ flex: 1 }}>
        <Input
          label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

/**
 * Client-side theme extraction from HTML + CSS text.
 * Analyzes color frequency, font families, and logo candidates.
 */
function extractThemeFromData(html: string, cssTexts: string[]): ExtractedTheme {
  const theme: ExtractedTheme = {
    primaryColor: '#0ea5e9',
    secondaryColor: '#10b981',
    bgColor: '#ffffff',
    surfaceColor: '#f5f5f5',
    textColor: '#1f2937',
    fontFamily: 'Inter, sans-serif',
    logoUrl: '',
    faviconUrl: '',
    isDark: false,
    headerHtml: '',
    footerHtml: '',
    siteCssUrls: [],
  };

  // Parse all CSS for color extraction
  const allCss = cssTexts.join('\n');

  // Extract colors using regex
  const hexColors: Record<string, number> = {};
  const hexPattern = /#([0-9a-fA-F]{3,8})\b/g;
  let match: RegExpExecArray | null;
  while ((match = hexPattern.exec(allCss)) !== null) {
    const hex = normalizeHex(match[0]);
    if (hex && !isNeutralColor(hex)) {
      hexColors[hex] = (hexColors[hex] || 0) + 1;
    }
  }

  // RGB/RGBA colors
  const rgbPattern = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g;
  while ((match = rgbPattern.exec(allCss)) !== null) {
    const hex = rgbToHex(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]));
    if (!isNeutralColor(hex)) {
      hexColors[hex] = (hexColors[hex] || 0) + 1;
    }
  }

  // Sort by frequency, most common non-neutral color is primary
  const sortedColors = Object.entries(hexColors).sort((a, b) => b[1] - a[1]);
  if (sortedColors.length > 0) theme.primaryColor = sortedColors[0][0];
  if (sortedColors.length > 1) theme.secondaryColor = sortedColors[1][0];

  // Extract font-family from body rule
  const fontMatch = allCss.match(/body\s*\{[^}]*font-family\s*:\s*([^;]+)/i);
  if (fontMatch) {
    theme.fontFamily = fontMatch[1].trim().replace(/["']/g, '');
  }

  // Extract background color from body
  const bgMatch = allCss.match(/body\s*\{[^}]*background(?:-color)?\s*:\s*([^;]+)/i);
  if (bgMatch) {
    const bgVal = bgMatch[1].trim();
    const bgHex = cssColorToHex(bgVal);
    if (bgHex) {
      theme.bgColor = bgHex;
      theme.isDark = getLuminance(bgHex) < 0.5;
    }
  }

  // Generate surface color (slightly lighter/darker than bg)
  theme.surfaceColor = theme.isDark
    ? adjustLightness(theme.bgColor, 0.05)
    : adjustLightness(theme.bgColor, -0.03);

  // Detect text color
  if (theme.isDark) {
    theme.textColor = '#ffffff';
  } else {
    theme.textColor = '#1f2937';
  }

  // Extract logo from HTML
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const headerImgs = doc.querySelectorAll('header img, nav img, .logo img, [class*="logo"] img, a > img:first-child');
  if (headerImgs.length > 0) {
    const src = headerImgs[0].getAttribute('src');
    if (src) theme.logoUrl = src;
  }

  // Fallback: og:image
  if (!theme.logoUrl) {
    const ogImage = doc.querySelector('meta[property="og:image"]');
    if (ogImage) {
      const content = ogImage.getAttribute('content');
      if (content) theme.logoUrl = content;
    }
  }

  // Extract header and footer HTML
  const headerEl = doc.querySelector('header');
  if (headerEl) {
    theme.headerHtml = sanitizeHtml(headerEl.outerHTML);
  }

  const footerEl = doc.querySelector('footer');
  if (footerEl) {
    theme.footerHtml = sanitizeHtml(footerEl.outerHTML);
  }

  return theme;
}

/**
 * Sanitize HTML: remove scripts, event handlers, and javascript: URLs.
 * Preserves structure, classes, inline styles, and content.
 */
function sanitizeHtml(html: string): string {
  // Remove <script> tags and their contents
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove <noscript> tags
  sanitized = sanitized.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
  // Remove <iframe> tags
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  // Remove event handler attributes (onclick, onload, onerror, etc.)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>"']*/gi, '');
  // Remove javascript: URLs
  sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  return sanitized;
}

function normalizeHex(hex: string): string {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  if (hex.length === 8) hex = hex.substring(0, 6); // strip alpha
  return '#' + hex.toLowerCase();
}

function isNeutralColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const maxDiff = Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b));
  // Neutral if very close to gray/white/black
  return maxDiff < 20 || (r > 240 && g > 240 && b > 240) || (r < 15 && g < 15 && b < 15);
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function cssColorToHex(val: string): string | null {
  const hexMatch = val.match(/#[0-9a-fA-F]{3,8}/);
  if (hexMatch) return normalizeHex(hexMatch[0]);
  const rgbMatch = val.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) return rgbToHex(parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3]));
  return null;
}

function getLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function adjustLightness(hex: string, amount: number): string {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.min(255, Math.max(0, Math.round(r + 255 * amount)));
  g = Math.min(255, Math.max(0, Math.round(g + 255 * amount)));
  b = Math.min(255, Math.max(0, Math.round(b + 255 * amount)));
  return rgbToHex(r, g, b);
}
