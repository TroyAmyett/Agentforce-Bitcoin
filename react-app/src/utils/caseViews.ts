/**
 * Lightweight "unread activity" tracker using localStorage.
 * Stores the last-viewed timestamp per case so the case list
 * can highlight cases with new activity since the user's last visit.
 */

const CASE_VIEW_KEY = 'sp_case_views';

function getCaseViews(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(CASE_VIEW_KEY) || '{}');
  } catch {
    return {};
  }
}

/** Record that the user just viewed this case. */
export function markCaseViewed(caseId: string): void {
  const views = getCaseViews();
  views[caseId] = Date.now();
  localStorage.setItem(CASE_VIEW_KEY, JSON.stringify(views));
}

/**
 * Seed any cases that the user hasn't viewed yet with the current
 * timestamp so they don't show a "new activity" dot immediately.
 * Call this when the case list loads.
 */
export function initializeCaseViews(caseIds: string[]): void {
  const views = getCaseViews();
  let changed = false;
  const now = Date.now();
  for (const id of caseIds) {
    if (!(id in views)) {
      views[id] = now;
      changed = true;
    }
  }
  if (changed) {
    localStorage.setItem(CASE_VIEW_KEY, JSON.stringify(views));
  }
}

/** Returns true if the case was modified after the user's last view. */
export function hasNewActivity(caseId: string, lastModifiedDate: string): boolean {
  const views = getCaseViews();
  const lastViewed = views[caseId];
  if (!lastViewed) return false;
  return new Date(lastModifiedDate).getTime() > lastViewed;
}
