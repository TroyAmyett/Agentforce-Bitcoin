import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AdminAPI } from '../../api/salesforce';
import { clearPortalConfigCache } from '../../hooks/usePortalConfig';
import { Button, Input } from '@funnelists/ui';
import { ArrowLeft, Settings, Plus, X, Bot, Info, ClipboardPaste, Check, Brain, Key, Eye, EyeOff } from 'lucide-react';

interface AgentforceConfig {
  enabled: boolean;
  mode: 'builtin' | 'messaging' | 'ai-assistant';
  scriptUrl: string;
  orgId: string;
  deploymentName: string;
  siteUrl: string;
  scrtUrl: string;
}

interface AIConfig {
  provider: 'claude' | 'openai';
  apiKey: string;
  model: string;
  systemPrompt: string;
  maxTokens: number;
}

interface PortalConfig {
  showProduct: boolean;
  productOptions: string;
  showPriority: boolean;
  showType: boolean;
  showAdminInPortal: boolean;
  agentforce?: AgentforceConfig;
  ai?: AIConfig;
}

const DEFAULT_AGENTFORCE: AgentforceConfig = {
  enabled: true,
  mode: 'builtin',
  scriptUrl: '',
  orgId: '',
  deploymentName: '',
  siteUrl: '',
  scrtUrl: '',
};

const DEFAULT_AI: AIConfig = {
  provider: 'claude',
  apiKey: '',
  model: 'claude-sonnet-4-5-20250929',
  systemPrompt: '',
  maxTokens: 1024,
};

const CLAUDE_MODELS = [
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
];

const OPENAI_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
];

const DEFAULT_CONFIG: PortalConfig = {
  showProduct: true,
  productOptions: 'Radar,Canvas,AgentPM,Resolve,LeadGen',
  showPriority: true,
  showType: false,
  showAdminInPortal: true,
  agentforce: DEFAULT_AGENTFORCE,
};

export function PortalSettings() {
  const [config, setConfig] = useState<PortalConfig>(DEFAULT_CONFIG);
  const [products, setProducts] = useState<string[]>([]);
  const [newProduct, setNewProduct] = useState('');
  const [agentforce, setAgentforce] = useState<AgentforceConfig>(DEFAULT_AGENTFORCE);
  const [aiConfig, setAiConfig] = useState<AIConfig>(DEFAULT_AI);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function loadSettings() {
      try {
        const result = await AdminAPI.getPortalSettings();
        if (result.success && result.data) {
          const data = result.data as { portalConfigJson?: string };
          if (data.portalConfigJson) {
            try {
              const parsed = JSON.parse(data.portalConfigJson) as PortalConfig;
              setConfig(parsed);
              setProducts(
                parsed.productOptions
                  ? parsed.productOptions.split(',').map((s) => s.trim()).filter(Boolean)
                  : [],
              );
              if (parsed.agentforce) {
                setAgentforce({ ...DEFAULT_AGENTFORCE, ...parsed.agentforce });
              }
              if (parsed.ai) {
                setAiConfig({ ...DEFAULT_AI, ...parsed.ai });
              }
            } catch {
              // Use defaults
              setProducts(DEFAULT_CONFIG.productOptions.split(','));
            }
          } else {
            setProducts(DEFAULT_CONFIG.productOptions.split(','));
          }
        }
      } catch {
        // Use defaults
        setProducts(DEFAULT_CONFIG.productOptions.split(','));
      }
      setLoading(false);
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const configToSave: PortalConfig = {
        ...config,
        productOptions: products.join(','),
        agentforce,
        ai: agentforce.mode === 'ai-assistant' ? aiConfig : config.ai,
      };
      const result = await AdminAPI.savePortalSettings(JSON.stringify(configToSave));
      if (result.success) {
        setSuccess('Portal settings saved successfully.');
        setConfig(configToSave);
        clearPortalConfigCache();
      } else {
        setError(result.error || 'Failed to save settings.');
      }
    } catch {
      setError('Something went wrong.');
    }
    setSaving(false);
  };

  const addProduct = () => {
    const name = newProduct.trim();
    if (!name) return;
    if (products.some((p) => p.toLowerCase() === name.toLowerCase())) {
      setError('Product already exists.');
      return;
    }
    setProducts((prev) => [...prev, name]);
    setNewProduct('');
    setError('');
  };

  const removeProduct = (index: number) => {
    setProducts((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleField = (field: keyof PortalConfig) => {
    setConfig((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  if (loading) {
    return (
      <div style={{ padding: 'var(--fl-spacing-xl)', color: 'var(--fl-color-text-secondary)' }}>
        Loading settings...
      </div>
    );
  }

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
          <Settings size={22} style={{ color: 'var(--fl-color-primary)' }} />
          <h1 className="sp-page-header__title">Portal Settings</h1>
        </div>
      </div>

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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--fl-spacing-lg)', maxWidth: '900px' }}>
        {/* Case Form Fields */}
        <div
          style={{
            backgroundColor: 'var(--fl-color-bg-elevated)',
            border: '1px solid var(--fl-color-border)',
            borderRadius: 'var(--fl-radius-lg)',
            padding: 'var(--fl-spacing-xl)',
          }}
        >
          <h2
            style={{
              fontSize: 'var(--fl-font-size-lg)',
              margin: '0 0 var(--fl-spacing-sm)',
              fontWeight: 'var(--fl-font-weight-semibold)',
            }}
          >
            Case Form Fields
          </h2>
          <p
            style={{
              fontSize: 'var(--fl-font-size-sm)',
              color: 'var(--fl-color-text-secondary)',
              margin: '0 0 var(--fl-spacing-lg)',
            }}
          >
            Control which fields appear on the case creation and detail pages.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--fl-spacing-md)' }}>
            {/* Subject - always shown */}
            <FieldToggle label="Subject" description="Brief title for the case" enabled={true} locked />
            <FieldToggle label="Description" description="Detailed case description" enabled={true} locked />
            <FieldToggle
              label="Priority"
              description="Low, Medium, High, Critical"
              enabled={config.showPriority}
              onToggle={() => toggleField('showPriority')}
            />
            <FieldToggle
              label="Product"
              description="Which product the case relates to"
              enabled={config.showProduct}
              onToggle={() => toggleField('showProduct')}
            />
            <FieldToggle
              label="Type"
              description="Case type (Bug, Feature Request, etc.)"
              enabled={config.showType}
              onToggle={() => toggleField('showType')}
            />
          </div>
        </div>

        {/* Product Options */}
        <div
          style={{
            backgroundColor: 'var(--fl-color-bg-elevated)',
            border: '1px solid var(--fl-color-border)',
            borderRadius: 'var(--fl-radius-lg)',
            padding: 'var(--fl-spacing-xl)',
          }}
        >
          <h2
            style={{
              fontSize: 'var(--fl-font-size-lg)',
              margin: '0 0 var(--fl-spacing-sm)',
              fontWeight: 'var(--fl-font-weight-semibold)',
            }}
          >
            Product Options
          </h2>
          <p
            style={{
              fontSize: 'var(--fl-font-size-sm)',
              color: 'var(--fl-color-text-secondary)',
              margin: '0 0 var(--fl-spacing-lg)',
            }}
          >
            Manage the products shown in the case form dropdown.
            {!config.showProduct && (
              <span style={{ color: 'var(--fl-color-warning, #f59e0b)', display: 'block', marginTop: '4px' }}>
                Product field is currently hidden. Enable it in Case Form Fields.
              </span>
            )}
          </p>

          {/* Chip/tag display */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              marginBottom: products.length ? 'var(--fl-spacing-md)' : 0,
            }}
          >
            {products.map((product, idx) => (
              <span
                key={idx}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 10px 5px 12px',
                  backgroundColor: 'rgba(14, 165, 233, 0.1)',
                  border: '1px solid rgba(14, 165, 233, 0.25)',
                  borderRadius: '999px',
                  fontSize: 'var(--fl-font-size-sm)',
                  color: 'var(--fl-color-text-primary)',
                  whiteSpace: 'nowrap',
                }}
              >
                {product}
                <button
                  onClick={() => removeProduct(idx)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--fl-color-text-muted)',
                    padding: '2px',
                    display: 'flex',
                    borderRadius: '50%',
                    lineHeight: 0,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fl-color-danger, #ef4444)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fl-color-text-muted)')}
                  aria-label={`Remove ${product}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>

          {/* Add product input */}
          <div style={{ display: 'flex', gap: 'var(--fl-spacing-sm)' }}>
            <div style={{ flex: 1 }}>
              <Input
                value={newProduct}
                onChange={(e) => setNewProduct(e.target.value)}
                placeholder="Add a product..."
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addProduct();
                  }
                }}
              />
            </div>
            <Button variant="secondary" onClick={addProduct} disabled={!newProduct.trim()}>
              <Plus size={14} /> Add
            </Button>
          </div>
        </div>
      </div>

      {/* Agentforce / Chat Widget */}
      <div
        style={{
          marginTop: 'var(--fl-spacing-lg)',
          maxWidth: '900px',
          backgroundColor: 'var(--fl-color-bg-elevated)',
          border: '1px solid var(--fl-color-border)',
          borderRadius: 'var(--fl-radius-lg)',
          padding: 'var(--fl-spacing-xl)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--fl-spacing-sm)' }}>
          <Bot size={20} style={{ color: 'var(--fl-color-primary)' }} />
          <h2
            style={{
              fontSize: 'var(--fl-font-size-lg)',
              margin: 0,
              fontWeight: 'var(--fl-font-weight-semibold)',
            }}
          >
            Agentforce / Chat Widget
          </h2>
        </div>
        <p
          style={{
            fontSize: 'var(--fl-font-size-sm)',
            color: 'var(--fl-color-text-secondary)',
            margin: '0 0 var(--fl-spacing-lg)',
          }}
        >
          Configure the chat assistant for your portal users.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--fl-spacing-md)' }}>
          <FieldToggle
            label="Enable Chat Widget"
            description="Show a floating chat button for portal users"
            enabled={agentforce.enabled}
            onToggle={() => setAgentforce((prev) => ({ ...prev, enabled: !prev.enabled }))}
          />

          {agentforce.enabled && (
            <>
              {/* Mode selector */}
              <div
                style={{
                  padding: '12px',
                  backgroundColor: 'var(--fl-color-bg-surface)',
                  borderRadius: 'var(--fl-radius-md)',
                  border: '1px solid var(--fl-color-border)',
                }}
              >
                <div style={{ fontSize: 'var(--fl-font-size-sm)', fontWeight: 'var(--fl-font-weight-medium)', marginBottom: 'var(--fl-spacing-sm)' }}>
                  Chat Mode
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--fl-spacing-sm)' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      cursor: 'pointer',
                      padding: '8px 10px',
                      borderRadius: 'var(--fl-radius-md)',
                      border: `1px solid ${agentforce.mode === 'builtin' ? 'var(--fl-color-primary)' : 'var(--fl-color-border)'}`,
                      backgroundColor: agentforce.mode === 'builtin' ? 'rgba(14, 165, 233, 0.05)' : 'transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name="agentforceMode"
                      value="builtin"
                      checked={agentforce.mode === 'builtin'}
                      onChange={() => setAgentforce((prev) => ({ ...prev, mode: 'builtin' }))}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <div style={{ fontSize: 'var(--fl-font-size-sm)', fontWeight: 'var(--fl-font-weight-medium)' }}>
                        Built-in Assistant
                      </div>
                      <div style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-muted)', marginTop: '2px' }}>
                        Simple keyword-based assistant that helps users navigate the portal, create cases, and submit ideas. No external setup required.
                      </div>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      cursor: 'pointer',
                      padding: '8px 10px',
                      borderRadius: 'var(--fl-radius-md)',
                      border: `1px solid ${agentforce.mode === 'messaging' ? 'var(--fl-color-primary)' : 'var(--fl-color-border)'}`,
                      backgroundColor: agentforce.mode === 'messaging' ? 'rgba(14, 165, 233, 0.05)' : 'transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name="agentforceMode"
                      value="messaging"
                      checked={agentforce.mode === 'messaging'}
                      onChange={() => setAgentforce((prev) => ({ ...prev, mode: 'messaging' }))}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <div style={{ fontSize: 'var(--fl-font-size-sm)', fontWeight: 'var(--fl-font-weight-medium)' }}>
                        Salesforce Messaging for Web
                      </div>
                      <div style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-muted)', marginTop: '2px' }}>
                        Connect to an Agentforce Service Agent or Einstein Bot via Salesforce Embedded Service. Requires setup in Salesforce.
                      </div>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      cursor: 'pointer',
                      padding: '8px 10px',
                      borderRadius: 'var(--fl-radius-md)',
                      border: `1px solid ${agentforce.mode === 'ai-assistant' ? 'var(--fl-color-primary)' : 'var(--fl-color-border)'}`,
                      backgroundColor: agentforce.mode === 'ai-assistant' ? 'rgba(14, 165, 233, 0.05)' : 'transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name="agentforceMode"
                      value="ai-assistant"
                      checked={agentforce.mode === 'ai-assistant'}
                      onChange={() => setAgentforce((prev) => ({ ...prev, mode: 'ai-assistant' }))}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <div style={{ fontSize: 'var(--fl-font-size-sm)', fontWeight: 'var(--fl-font-weight-medium)' }}>
                        AI Assistant (BYO Key)
                      </div>
                      <div style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-muted)', marginTop: '2px' }}>
                        LLM-powered chat using your own Claude or OpenAI API key. Answers grounded in your Help content and case history.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Messaging for Web config fields */}
              {agentforce.mode === 'messaging' && (
                <MessagingConfig agentforce={agentforce} setAgentforce={setAgentforce} />
              )}

              {/* AI Assistant config */}
              {agentforce.mode === 'ai-assistant' && (
                <AIAssistantConfig aiConfig={aiConfig} setAiConfig={setAiConfig} />
              )}
            </>
          )}
        </div>
      </div>

      {/* Portal Access */}
      <div
        style={{
          marginTop: 'var(--fl-spacing-lg)',
          maxWidth: '900px',
          backgroundColor: 'var(--fl-color-bg-elevated)',
          border: '1px solid var(--fl-color-border)',
          borderRadius: 'var(--fl-radius-lg)',
          padding: 'var(--fl-spacing-xl)',
        }}
      >
        <h2
          style={{
            fontSize: 'var(--fl-font-size-lg)',
            margin: '0 0 var(--fl-spacing-sm)',
            fontWeight: 'var(--fl-font-weight-semibold)',
          }}
        >
          Portal Access
        </h2>
        <p
          style={{
            fontSize: 'var(--fl-font-size-sm)',
            color: 'var(--fl-color-text-secondary)',
            margin: '0 0 var(--fl-spacing-lg)',
          }}
        >
          Control which admin features are accessible from the portal. When disabled, manage configuration directly in Salesforce Setup.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--fl-spacing-md)' }}>
          <FieldToggle
            label="Show Admin Pages in Portal"
            description="Admin Dashboard, User Management, and Portal Settings. Branding is always accessible."
            enabled={config.showAdminInPortal}
            onToggle={() => toggleField('showAdminInPortal')}
          />
          {!config.showAdminInPortal && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '10px 12px',
              backgroundColor: 'rgba(217, 119, 6, 0.06)',
              borderRadius: 'var(--fl-radius-md)',
              border: '1px solid rgba(217, 119, 6, 0.15)',
            }}>
              <Info size={14} style={{ color: 'var(--fl-color-warning, #f59e0b)', marginTop: '2px', flexShrink: 0 }} />
              <span style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-secondary)', lineHeight: 1.5 }}>
                After saving, only Branding will be visible in the admin menu. To re-enable, go to Salesforce Setup &rarr; Custom Metadata Types &rarr; Support Portal Setting &rarr; Default and check <code>Show Admin In Portal</code>, or navigate directly to <code>#/admin/settings</code>.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Save */}
      <div style={{ marginTop: 'var(--fl-spacing-xl)', maxWidth: '900px' }}>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}

function parseSnippet(snippet: string): Partial<AgentforceConfig> | null {
  const result: Partial<AgentforceConfig> = {};
  let found = false;

  // Extract script URL from <script> src attribute
  const srcMatch = snippet.match(/src\s*=\s*["']([^"']*bootstrap[^"']*)["']/i)
    || snippet.match(/src\s*=\s*["'](https?:\/\/[^"']*\.js)["']/i);
  if (srcMatch) {
    result.scriptUrl = srcMatch[1];
    found = true;
  }

  // Extract init() parameters: init('orgId', 'deploymentName', 'siteUrl', { scrt2URL: '...' })
  const initMatch = snippet.match(
    /\.init\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/
  );
  if (initMatch) {
    result.orgId = initMatch[1];
    result.deploymentName = initMatch[2];
    result.siteUrl = initMatch[3];
    found = true;
  }

  // Extract scrt2URL from options object
  const scrtMatch = snippet.match(/scrt2URL\s*:\s*['"]([^'"]+)['"]/);
  if (scrtMatch) {
    result.scrtUrl = scrtMatch[1];
    found = true;
  }

  return found ? result : null;
}

function MessagingConfig({
  agentforce,
  setAgentforce,
}: {
  agentforce: AgentforceConfig;
  setAgentforce: React.Dispatch<React.SetStateAction<AgentforceConfig>>;
}) {
  const [snippet, setSnippet] = useState('');
  const [parsed, setParsed] = useState(false);

  const handleParse = () => {
    const result = parseSnippet(snippet);
    if (result) {
      setAgentforce((prev) => ({ ...prev, ...result }));
      setParsed(true);
      setTimeout(() => setParsed(false), 3000);
    }
  };

  const hasValues = agentforce.scriptUrl || agentforce.orgId;

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: 'var(--fl-color-bg-surface)',
        borderRadius: 'var(--fl-radius-md)',
        border: '1px solid var(--fl-color-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--fl-spacing-md)',
      }}
    >
      {/* Paste Snippet */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: 'var(--fl-spacing-sm)',
          }}
        >
          <ClipboardPaste size={16} style={{ color: 'var(--fl-color-primary)' }} />
          <span style={{ fontSize: 'var(--fl-font-size-sm)', fontWeight: 'var(--fl-font-weight-medium)' }}>
            Paste Code Snippet
          </span>
        </div>
        <p
          style={{
            fontSize: 'var(--fl-font-size-xs)',
            color: 'var(--fl-color-text-muted)',
            margin: '0 0 var(--fl-spacing-sm)',
            lineHeight: 1.5,
          }}
        >
          Copy the code snippet from Salesforce Setup &rarr; Embedded Service Deployments &rarr; your deployment, and paste it below. All fields will be extracted automatically.
        </p>
        <textarea
          value={snippet}
          onChange={(e) => {
            setSnippet(e.target.value);
            setParsed(false);
          }}
          placeholder={'<script type="text/javascript" src="https://...">\n  embeddedservice_bootstrap.init(\n    \'00Dxx...\',\n    \'ESW_Name\',\n    \'https://...\',\n    { scrt2URL: \'https://...\' }\n  );\n</script>'}
          rows={6}
          style={{
            width: '100%',
            padding: '10px 12px',
            backgroundColor: 'var(--fl-color-bg)',
            color: 'var(--fl-color-text-primary)',
            border: '1px solid var(--fl-color-border)',
            borderRadius: 'var(--fl-radius-md)',
            fontFamily: 'monospace',
            fontSize: 'var(--fl-font-size-xs)',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ marginTop: 'var(--fl-spacing-sm)', display: 'flex', alignItems: 'center', gap: 'var(--fl-spacing-sm)' }}>
          <Button
            variant="secondary"
            onClick={handleParse}
            disabled={!snippet.trim()}
          >
            {parsed ? <Check size={14} /> : <ClipboardPaste size={14} />}
            {parsed ? 'Extracted!' : 'Extract Values'}
          </Button>
          {parsed && (
            <span style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-success)' }}>
              Values populated below
            </span>
          )}
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--fl-color-border)', margin: '4px 0' }} />

      {/* Individual fields - always visible for review/manual edit */}
      <div>
        <div style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-muted)', marginBottom: 'var(--fl-spacing-sm)' }}>
          {hasValues ? 'Extracted values (editable):' : 'Or enter values manually:'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--fl-spacing-md)' }}>
          <Input
            label="Script URL"
            value={agentforce.scriptUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgentforce((prev) => ({ ...prev, scriptUrl: e.target.value }))}
            placeholder="https://your-org.my.salesforce-scrt2.com/assets/js/bootstrap.min.js"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--fl-spacing-md)' }}>
            <Input
              label="Org ID"
              value={agentforce.orgId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgentforce((prev) => ({ ...prev, orgId: e.target.value }))}
              placeholder="00Dxx0000000000"
            />
            <Input
              label="Deployment Name"
              value={agentforce.deploymentName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgentforce((prev) => ({ ...prev, deploymentName: e.target.value }))}
              placeholder="ESW_Deployment_Name"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--fl-spacing-md)' }}>
            <Input
              label="Site URL"
              value={agentforce.siteUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgentforce((prev) => ({ ...prev, siteUrl: e.target.value }))}
              placeholder="https://your-org.my.site.com/ESWName"
            />
            <Input
              label="SCRT2 URL"
              value={agentforce.scrtUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgentforce((prev) => ({ ...prev, scrtUrl: e.target.value }))}
              placeholder="https://your-org.my.salesforce-scrt2.com"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function AIAssistantConfig({
  aiConfig,
  setAiConfig,
}: {
  aiConfig: AIConfig;
  setAiConfig: React.Dispatch<React.SetStateAction<AIConfig>>;
}) {
  const [showKey, setShowKey] = useState(false);
  const models = aiConfig.provider === 'openai' ? OPENAI_MODELS : CLAUDE_MODELS;

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: 'var(--fl-color-bg-surface)',
        borderRadius: 'var(--fl-radius-md)',
        border: '1px solid var(--fl-color-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--fl-spacing-md)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Brain size={16} style={{ color: 'var(--fl-color-primary)' }} />
        <span style={{ fontSize: 'var(--fl-font-size-sm)', fontWeight: 'var(--fl-font-weight-medium)' }}>
          AI Provider Configuration
        </span>
      </div>

      {/* Provider selector */}
      <div>
        <div style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-muted)', marginBottom: 'var(--fl-spacing-sm)' }}>
          LLM Provider
        </div>
        <div style={{ display: 'flex', gap: 'var(--fl-spacing-sm)' }}>
          <label
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: 'var(--fl-radius-md)',
              border: `1px solid ${aiConfig.provider === 'claude' ? 'var(--fl-color-primary)' : 'var(--fl-color-border)'}`,
              backgroundColor: aiConfig.provider === 'claude' ? 'rgba(14, 165, 233, 0.05)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="aiProvider"
              value="claude"
              checked={aiConfig.provider === 'claude'}
              onChange={() => setAiConfig((prev) => ({ ...prev, provider: 'claude', model: 'claude-sonnet-4-5-20250929' }))}
            />
            <div>
              <div style={{ fontSize: 'var(--fl-font-size-sm)', fontWeight: 'var(--fl-font-weight-medium)' }}>Claude</div>
              <div style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-muted)' }}>by Anthropic</div>
            </div>
          </label>
          <label
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: 'var(--fl-radius-md)',
              border: `1px solid ${aiConfig.provider === 'openai' ? 'var(--fl-color-primary)' : 'var(--fl-color-border)'}`,
              backgroundColor: aiConfig.provider === 'openai' ? 'rgba(14, 165, 233, 0.05)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="aiProvider"
              value="openai"
              checked={aiConfig.provider === 'openai'}
              onChange={() => setAiConfig((prev) => ({ ...prev, provider: 'openai', model: 'gpt-4o' }))}
            />
            <div>
              <div style={{ fontSize: 'var(--fl-font-size-sm)', fontWeight: 'var(--fl-font-weight-medium)' }}>OpenAI</div>
              <div style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-muted)' }}>GPT models</div>
            </div>
          </label>
        </div>
      </div>

      {/* API Key */}
      <div>
        <div style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-muted)', marginBottom: '4px' }}>
          API Key
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={aiConfig.apiKey}
            onChange={(e) => setAiConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
            placeholder={aiConfig.provider === 'claude' ? 'sk-ant-...' : 'sk-...'}
            style={{
              width: '100%',
              padding: '8px 40px 8px 12px',
              backgroundColor: 'var(--fl-color-bg)',
              color: 'var(--fl-color-text-primary)',
              border: '1px solid var(--fl-color-border)',
              borderRadius: 'var(--fl-radius-md)',
              fontSize: 'var(--fl-font-size-sm)',
              fontFamily: 'monospace',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={() => setShowKey(!showKey)}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--fl-color-text-muted)',
              padding: '4px',
              display: 'flex',
            }}
            aria-label={showKey ? 'Hide API key' : 'Show API key'}
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <div style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-muted)', marginTop: '4px' }}>
          <Key size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
          Your API key is stored in Salesforce and used server-side only.
        </div>
      </div>

      {/* Model selector */}
      <div>
        <div style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-muted)', marginBottom: '4px' }}>
          Model
        </div>
        <select
          value={aiConfig.model}
          onChange={(e) => setAiConfig((prev) => ({ ...prev, model: e.target.value }))}
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
          {models.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* System Prompt */}
      <div>
        <div style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-muted)', marginBottom: '4px' }}>
          Custom Instructions (optional)
        </div>
        <textarea
          value={aiConfig.systemPrompt}
          onChange={(e) => setAiConfig((prev) => ({ ...prev, systemPrompt: e.target.value }))}
          placeholder="Add custom instructions for the AI assistant. Example: 'Always suggest creating a support case for complex issues.' Leave blank for default behavior."
          rows={3}
          style={{
            width: '100%',
            padding: '10px 12px',
            backgroundColor: 'var(--fl-color-bg)',
            color: 'var(--fl-color-text-primary)',
            border: '1px solid var(--fl-color-border)',
            borderRadius: 'var(--fl-radius-md)',
            fontSize: 'var(--fl-font-size-sm)',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Max Tokens */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--fl-spacing-md)' }}>
        <div>
          <div style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-muted)', marginBottom: '4px' }}>
            Max Response Length (tokens)
          </div>
          <input
            type="number"
            value={aiConfig.maxTokens}
            onChange={(e) => setAiConfig((prev) => ({ ...prev, maxTokens: Math.min(4096, Math.max(256, parseInt(e.target.value) || 1024)) }))}
            min={256}
            max={4096}
            step={256}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: 'var(--fl-color-bg)',
              color: 'var(--fl-color-text-primary)',
              border: '1px solid var(--fl-color-border)',
              borderRadius: 'var(--fl-radius-md)',
              fontSize: 'var(--fl-font-size-sm)',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function FieldToggle({
  label,
  description,
  enabled,
  locked,
  onToggle,
}: {
  label: string;
  description: string;
  enabled: boolean;
  locked?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        backgroundColor: 'var(--fl-color-bg-surface)',
        borderRadius: 'var(--fl-radius-md)',
        border: '1px solid var(--fl-color-border)',
        opacity: locked ? 0.7 : 1,
      }}
    >
      <div>
        <div style={{ fontSize: 'var(--fl-font-size-sm)', fontWeight: 'var(--fl-font-weight-medium)' }}>
          {label}
          {locked && (
            <span
              style={{
                fontSize: 'var(--fl-font-size-xs)',
                color: 'var(--fl-color-text-muted)',
                marginLeft: '6px',
              }}
            >
              (Required)
            </span>
          )}
        </div>
        <div style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-muted)', marginTop: '2px' }}>
          {description}
        </div>
      </div>
      <label className="sp-toggle" style={{ pointerEvents: locked ? 'none' : 'auto' }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={onToggle}
          disabled={locked}
        />
        <span className="sp-toggle__slider" />
      </label>
    </div>
  );
}
