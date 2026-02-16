/**
 * Theme Extraction Engine
 *
 * Parses HTML and CSS text (fetched via Apex HTTP proxy) to extract
 * design tokens: colors, fonts, logo, and light/dark mode detection.
 * Maps extracted values to @funnelists/ui CSS variable overrides.
 */

export interface PortalTheme {
  primaryColor: string;
  primaryHover: string;
  secondaryColor: string;
  bgColor: string;
  surfaceColor: string;
  elevatedColor: string;
  textColor: string;
  textSecondary: string;
  borderColor: string;
  fontFamily: string;
  logoUrl: string;
  faviconUrl: string;
  isDark: boolean;
}

/**
 * Extracts a full theme from raw HTML and CSS text arrays.
 */
export function extractTheme(html: string, cssTexts: string[]): PortalTheme {
  const allCss = cssTexts.join('\n');
  const colors = analyzeColors(allCss);
  const fontFamily = extractFontFamily(allCss);
  const bgColor = extractBackgroundColor(allCss);
  const isDark = bgColor ? getLuminance(bgColor) < 0.5 : false;
  const logoUrl = extractLogoUrl(html);
  const faviconUrl = extractFaviconUrl(html);

  const primary = colors[0] || '#0ea5e9';
  const secondary = colors[1] || '#10b981';

  return {
    primaryColor: primary,
    primaryHover: adjustLightness(primary, isDark ? 0.08 : -0.1),
    secondaryColor: secondary,
    bgColor: bgColor || (isDark ? '#0a0a0f' : '#ffffff'),
    surfaceColor: isDark
      ? adjustLightness(bgColor || '#0a0a0f', 0.05)
      : adjustLightness(bgColor || '#ffffff', -0.03),
    elevatedColor: isDark
      ? adjustLightness(bgColor || '#0a0a0f', 0.08)
      : adjustLightness(bgColor || '#ffffff', -0.05),
    textColor: isDark ? '#ffffff' : '#1f2937',
    textSecondary: isDark ? '#a1a1aa' : '#6b7280',
    borderColor: isDark ? '#2a2a3a' : '#e5e7eb',
    fontFamily: fontFamily || 'Inter, -apple-system, sans-serif',
    logoUrl: logoUrl || '',
    faviconUrl: faviconUrl || '',
    isDark,
  };
}

/**
 * Converts a PortalTheme into CSS variable override declarations.
 * These map directly to @funnelists/ui design tokens.
 */
export function themeToCssVariables(theme: PortalTheme): string {
  return `
:root {
  --fl-color-primary: ${theme.primaryColor};
  --fl-color-primary-hover: ${theme.primaryHover};
  --fl-color-secondary: ${theme.secondaryColor};
  --fl-color-bg-base: ${theme.bgColor};
  --fl-color-bg-surface: ${theme.surfaceColor};
  --fl-color-bg-elevated: ${theme.elevatedColor};
  --fl-color-text-primary: ${theme.textColor};
  --fl-color-text-secondary: ${theme.textSecondary};
  --fl-color-border: ${theme.borderColor};
  --fl-color-border-focus: ${theme.primaryColor};
  --fl-font-family: ${theme.fontFamily};
}`.trim();
}

// ─── Color Analysis ─────────────────────────────────────────────

function analyzeColors(css: string): string[] {
  const colorCounts: Record<string, number> = {};

  // Hex colors
  const hexPattern = /#([0-9a-fA-F]{3,8})\b/g;
  let match: RegExpExecArray | null;
  while ((match = hexPattern.exec(css)) !== null) {
    const hex = normalizeHex(match[0]);
    if (!isNeutralColor(hex)) {
      colorCounts[hex] = (colorCounts[hex] || 0) + 1;
    }
  }

  // RGB/RGBA colors
  const rgbPattern = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g;
  while ((match = rgbPattern.exec(css)) !== null) {
    const hex = rgbToHex(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]));
    if (!isNeutralColor(hex)) {
      colorCounts[hex] = (colorCounts[hex] || 0) + 1;
    }
  }

  // HSL colors
  const hslPattern = /hsla?\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%/g;
  while ((match = hslPattern.exec(css)) !== null) {
    const hex = hslToHex(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]));
    if (!isNeutralColor(hex)) {
      colorCounts[hex] = (colorCounts[hex] || 0) + 1;
    }
  }

  // Sort by frequency, return top colors
  return Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([color]) => color);
}

function extractFontFamily(css: string): string | null {
  // Try body first, then html, then :root
  const patterns = [
    /body\s*\{[^}]*font-family\s*:\s*([^;]+)/i,
    /html\s*\{[^}]*font-family\s*:\s*([^;]+)/i,
    /:root\s*\{[^}]*font-family\s*:\s*([^;]+)/i,
  ];
  for (const pattern of patterns) {
    const match = css.match(pattern);
    if (match) return match[1].trim().replace(/["']/g, '');
  }
  return null;
}

function extractBackgroundColor(css: string): string | null {
  const match = css.match(/body\s*\{[^}]*background(?:-color)?\s*:\s*([^;]+)/i);
  if (match) return cssValueToHex(match[1].trim());
  return null;
}

function extractLogoUrl(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Priority order: header/nav logo, class-based logo, first link image
  const selectors = [
    'header img[src*="logo"]',
    'nav img[src*="logo"]',
    '[class*="logo"] img',
    'header img',
    'nav img',
    'a > img:first-child',
  ];

  for (const selector of selectors) {
    const img = doc.querySelector(selector);
    if (img) {
      const src = img.getAttribute('src');
      if (src) return src;
    }
  }

  // Fallback: og:image meta tag
  const ogImage = doc.querySelector('meta[property="og:image"]');
  if (ogImage) return ogImage.getAttribute('content');

  return null;
}

function extractFaviconUrl(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const selectors = [
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
    'link[rel="apple-touch-icon"]',
  ];

  for (const selector of selectors) {
    const link = doc.querySelector(selector);
    if (link) {
      const href = link.getAttribute('href');
      if (href) return href;
    }
  }
  return null;
}

// ─── Color Utilities ────────────────────────────────────────────

function normalizeHex(hex: string): string {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  if (hex.length === 8) hex = hex.substring(0, 6);
  return '#' + hex.toLowerCase();
}

function isNeutralColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const maxDiff = Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b));
  return maxDiff < 20 || (r > 240 && g > 240 && b > 240) || (r < 15 && g < 15 && b < 15);
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.min(255, Math.max(0, v)).toString(16).padStart(2, '0')).join('');
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color);
  };
  return rgbToHex(f(0), f(8), f(4));
}

function cssValueToHex(val: string): string | null {
  const hexMatch = val.match(/#[0-9a-fA-F]{3,8}/);
  if (hexMatch) return normalizeHex(hexMatch[0]);
  const rgbMatch = val.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) return rgbToHex(parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3]));
  const hslMatch = val.match(/hsla?\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%/);
  if (hslMatch) return hslToHex(parseInt(hslMatch[1]), parseInt(hslMatch[2]), parseInt(hslMatch[3]));
  // Named colors
  const namedColors: Record<string, string> = {
    white: '#ffffff', black: '#000000', red: '#ff0000', blue: '#0000ff',
    green: '#008000', transparent: '#ffffff',
  };
  return namedColors[val.toLowerCase()] || null;
}

export function getLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function adjustLightness(hex: string, amount: number): string {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.min(255, Math.max(0, Math.round(r + 255 * amount)));
  g = Math.min(255, Math.max(0, Math.round(g + 255 * amount)));
  b = Math.min(255, Math.max(0, Math.round(b + 255 * amount)));
  return rgbToHex(r, g, b);
}
