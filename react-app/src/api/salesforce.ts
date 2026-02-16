/**
 * Salesforce Visualforce Remoting wrapper.
 * Provides a typed Promise-based API for calling Apex @RemoteAction methods
 * from the React SPA running inside a Visualforce page.
 */

// Global type declarations for Visualforce remoting
declare global {
  interface Window {
    Visualforce?: {
      remoting: {
        Manager: {
          invokeAction: (action: string, ...args: unknown[]) => void;
        };
      };
    };
    SP_CONFIG?: SPConfig;
  }
}

export interface SPConfig {
  sessionActive: string;
  userId: string;
  userName: string;
  userRole: string;
  portalName: string;
  brandColor: string;
  logoUrl: string;
  agentforceEnabled: string;
  agentforceMode: string;
  themeJson: string;
  companyName: string;
  supportEmail: string;
  supportPhone: string;
  registrationMode: string;
  showAdminInPortal: string;
}

export interface SPResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Calls a Salesforce @RemoteAction method via Visualforce remoting.
 * Falls back to mock data in development mode (when running outside VF).
 */
export function callRemote<T = unknown>(
  controller: string,
  method: string,
  ...params: unknown[]
): Promise<SPResponse<T>> {
  if (!window.Visualforce) {
    // Dev mode - use in-memory mock layer
    return import('./mock').then(({ handleMockCall }) =>
      handleMockCall(method, params) as Promise<SPResponse<T>>
    );
  }

  const vf = window.Visualforce;
  return new Promise((resolve, reject) => {
    const action = `${controller}.${method}`;

    vf.remoting.Manager.invokeAction(action, ...params,
      (result: SPResponse<T>, event: { status: boolean; message?: string }) => {
        if (event.status) {
          resolve(result);
        } else {
          reject(new Error(event.message || 'Remote action failed'));
        }
      },
      { escape: false },
    );
  });
}

// ─── Auth API ─────────────────────────────────────────────────

export const AuthAPI = {
  login: (email: string, password: string) =>
    callRemote('SPAuthController', 'login', email, password),

  register: (firstName: string, lastName: string, email: string, password: string, company: string) =>
    callRemote('SPAuthController', 'register', firstName, lastName, email, password, company),

  logout: () =>
    callRemote('SPAuthController', 'logout'),

  getCurrentUser: () =>
    callRemote('SPAuthController', 'getCurrentUser'),

  resetPasswordRequest: (email: string) =>
    callRemote('SPAuthController', 'resetPasswordRequest', email),

  resetPassword: (contactId: string, token: string, newPassword: string) =>
    callRemote('SPAuthController', 'resetPassword', contactId, token, newPassword),

  changePassword: (contactId: string, currentPassword: string, newPassword: string) =>
    callRemote('SPAuthController', 'changePassword', contactId, currentPassword, newPassword),
};

// ─── Case API ─────────────────────────────────────────────────
// All calls route through SPAuthController (the VF page controller)
// because VF remoting on Sites only resolves the page controller.

export const CaseAPI = {
  getCases: (contactId: string, statusFilter: string, page: number) =>
    callRemote('SPAuthController', 'getCases', contactId, statusFilter, page),

  getCaseDetail: (contactId: string, caseId: string) =>
    callRemote('SPAuthController', 'getCaseDetail', contactId, caseId),

  createCase: (contactId: string, subject: string, description: string, priority: string, product?: string, caseType?: string) =>
    callRemote('SPAuthController', 'createCase', contactId, subject, description, priority, product || null, caseType || null),

  addComment: (contactId: string, caseId: string, body: string) =>
    callRemote('SPAuthController', 'addComment', contactId, caseId, body),

  uploadAttachment: (contactId: string, caseId: string, fileName: string, base64Body: string) =>
    callRemote('SPAuthController', 'uploadAttachment', contactId, caseId, fileName, base64Body),

  closeCase: (contactId: string, caseId: string) =>
    callRemote('SPAuthController', 'closeCase', contactId, caseId),

  getAttachmentContent: (contactId: string, contentDocumentId: string) =>
    callRemote('SPAuthController', 'getAttachmentContent', contactId, contentDocumentId),
};

// ─── Session Token Helper ─────────────────────────────────────
// On Salesforce Sites, ApexPages.currentPage() is null in RemoteAction
// context, so Apex cannot read cookies. Instead we pass the session
// token explicitly as the last parameter to methods that need auth.

function getSessionToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)apex__SP_Session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

// ─── Theme API ────────────────────────────────────────────────

export const ThemeAPI = {
  fetchWebsite: (url: string) =>
    callRemote('SPAuthController', 'fetchWebsite', url, getSessionToken()),

  saveTheme: (themeJson: string, logoUrl: string, companyName: string, sourceUrl: string) =>
    callRemote('SPAuthController', 'saveTheme', themeJson, logoUrl, companyName, sourceUrl, getSessionToken()),

  getTheme: () =>
    callRemote('SPAuthController', 'getTheme'),

  resetToDemo: () =>
    callRemote('SPAuthController', 'resetTheme', getSessionToken()),
};

// ─── Admin API ────────────────────────────────────────────────

export const AdminAPI = {
  getPortalUsers: (page: number, searchTerm: string) =>
    callRemote('SPAuthController', 'getPortalUsers', page, searchTerm, getSessionToken()),

  updateUserStatus: (contactId: string, status: string) =>
    callRemote('SPAuthController', 'updateUserStatus', contactId, status, getSessionToken()),

  updateUserRole: (contactId: string, role: string) =>
    callRemote('SPAuthController', 'updateUserRole', contactId, role, getSessionToken()),

  getPortalStats: () =>
    callRemote('SPAuthController', 'getPortalStats', getSessionToken()),

  getPortalSettings: () =>
    callRemote('SPAuthController', 'getPortalSettings', getSessionToken()),

  savePortalSettings: (configJson: string) =>
    callRemote('SPAuthController', 'savePortalSettings', configJson, getSessionToken()),
};

// ─── Portal Config API ───────────────────────────────────────
// Public endpoint (no session required) for reading portal config

export const PortalConfigAPI = {
  getPortalConfig: () =>
    callRemote('SPAuthController', 'getPortalConfig'),
};

// ─── Ideas API ────────────────────────────────────────────────

export const IdeasAPI = {
  getIdeas: (contactId: string, categoryFilter: string, page: number) =>
    callRemote('SPAuthController', 'getIdeas', contactId, categoryFilter, page, getSessionToken()),

  createIdea: (contactId: string, title: string, description: string, category: string, product?: string) =>
    callRemote('SPAuthController', 'createIdea', contactId, title, description, category, product || null, getSessionToken()),

  voteForIdea: (contactId: string, ideaId: string) =>
    callRemote('SPAuthController', 'voteForIdea', contactId, ideaId, getSessionToken()),

  updateIdeaStatus: (ideaId: string, status: string) =>
    callRemote('SPAuthController', 'updateIdeaStatus', ideaId, status, getSessionToken()),

  toggleIdeaPublished: (ideaId: string, published: boolean) =>
    callRemote('SPAuthController', 'toggleIdeaPublished', ideaId, published, getSessionToken()),
};

// ─── AI API ──────────────────────────────────────────────────

export const AIAPI = {
  chat: (message: string, conversationHistory: string) =>
    callRemote('SPAuthController', 'chat', message, conversationHistory, getSessionToken()),

  generateFAQs: (documentText: string, documentName: string) =>
    callRemote('SPAuthController', 'generateFAQs', documentText, documentName, getSessionToken()),

  getFAQs: () =>
    callRemote('SPAuthController', 'getFAQs', getSessionToken()),

  getAdminFAQs: () =>
    callRemote('SPAuthController', 'getAdminFAQs', getSessionToken()),

  updateFAQ: (faqId: string, question: string, answer: string, category: string, published: boolean) =>
    callRemote('SPAuthController', 'updateFAQ', faqId, question, answer, category, published, getSessionToken()),

  deleteFAQ: (faqId: string) =>
    callRemote('SPAuthController', 'deleteFAQ', faqId, getSessionToken()),
};
