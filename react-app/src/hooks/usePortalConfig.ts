import { useState, useEffect } from 'react';
import { PortalConfigAPI } from '../api/salesforce';

export interface PortalConfig {
  showProduct: boolean;
  productOptions: string[];
  showPriority: boolean;
  showType: boolean;
  showAdminInPortal: boolean;
}

/** Master switch from Salesforce MDT (read from window.SP_CONFIG).
 *  In dev mode (no SP_CONFIG), defaults to true so admin works locally. */
function getMdtShowAdmin(): boolean {
  if (!window.SP_CONFIG) return true; // dev/mock mode
  // VF merge fields render as strings: 'true' or 'false'
  return window.SP_CONFIG.showAdminInPortal === 'true';
}

const DEFAULT_CONFIG: PortalConfig = {
  showProduct: true,
  productOptions: ['Radar', 'Canvas', 'AgentPM', 'Resolve', 'LeadGen'],
  showPriority: true,
  showType: false,
  showAdminInPortal: false,
};

let cachedConfig: PortalConfig | null = null;

export function usePortalConfig() {
  const [config, setConfig] = useState<PortalConfig>(cachedConfig || DEFAULT_CONFIG);
  const [loading, setLoading] = useState(!cachedConfig);

  useEffect(() => {
    if (cachedConfig) return;

    async function load() {
      try {
        const result = await PortalConfigAPI.getPortalConfig();
        if (result.success && result.data) {
          const data = result.data as { portalConfigJson?: string };
          if (data.portalConfigJson) {
            const raw = JSON.parse(data.portalConfigJson);
            // MDT is master switch — if MDT says false, admin is always hidden
            const mdtAllow = getMdtShowAdmin();
            const parsed: PortalConfig = {
              showProduct: raw.showProduct ?? true,
              productOptions: raw.productOptions
                ? raw.productOptions.split(',').map((s: string) => s.trim()).filter(Boolean)
                : DEFAULT_CONFIG.productOptions,
              showPriority: raw.showPriority ?? true,
              showType: raw.showType ?? false,
              showAdminInPortal: mdtAllow && (raw.showAdminInPortal ?? false),
            };
            cachedConfig = parsed;
            setConfig(parsed);
          }
        }
      } catch {
        // Use defaults
      }
      setLoading(false);
    }

    load();
  }, []);

  return { config, loading };
}

/** Call this to clear the cache (e.g., after admin saves settings) */
export function clearPortalConfigCache() {
  cachedConfig = null;
}
