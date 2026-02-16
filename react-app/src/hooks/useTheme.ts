import { useEffect } from 'react';

interface PortalTheme {
  primaryColor?: string;
  primaryHoverColor?: string;
  secondaryColor?: string;
  bgBase?: string;
  bgElevated?: string;
  bgSurface?: string;
  textPrimary?: string;
  textSecondary?: string;
  borderColor?: string;
  fontFamily?: string;
  isDark?: boolean;
}

/**
 * Reads the theme JSON from window.SP_CONFIG.themeJson and applies
 * CSS variable overrides to the document root. This makes all
 * @funnelists/ui components adopt the extracted website theme.
 */
export function useTheme() {
  useEffect(() => {
    const config = window.SP_CONFIG;
    if (!config?.themeJson || config.themeJson === '{}') return;

    let theme: PortalTheme;
    try {
      theme = JSON.parse(config.themeJson);
    } catch {
      return;
    }

    const root = document.documentElement;
    const overrides: Record<string, string | undefined> = {
      '--fl-color-primary': theme.primaryColor,
      '--fl-color-primary-hover': theme.primaryHoverColor,
      '--fl-color-secondary': theme.secondaryColor,
      '--fl-color-bg-base': theme.bgBase,
      '--fl-color-bg-elevated': theme.bgElevated,
      '--fl-color-bg-surface': theme.bgSurface,
      '--fl-color-text-primary': theme.textPrimary,
      '--fl-color-text-secondary': theme.textSecondary,
      '--fl-color-border': theme.borderColor,
      '--fl-color-border-focus': theme.primaryColor,
      '--fl-font-family': theme.fontFamily,
    };

    for (const [prop, value] of Object.entries(overrides)) {
      if (value) {
        root.style.setProperty(prop, value);
      }
    }

    // Handle light/dark mode
    if (theme.isDark === false) {
      root.style.setProperty('color-scheme', 'light');
      // Adjust text inverse for light mode
      root.style.setProperty('--fl-color-text-inverse', '#ffffff');
    }

    // Cleanup on unmount
    return () => {
      for (const prop of Object.keys(overrides)) {
        root.style.removeProperty(prop);
      }
    };
  }, []);
}
