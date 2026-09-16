// sessionStorage (not localStorage) so an impersonation session never
// survives closing the tab, and each tab impersonates independently.

const RETURN_SESSION_KEY = 'wacrm.impersonation.returnSession';
const ACTIVE_KEY = 'wacrm.impersonation.active';

export interface StashedSession {
  access_token: string;
  refresh_token: string;
}

export interface ActiveImpersonation {
  targetUserId: string;
  targetName: string;
  startedAt: string;
}

export function stashReturnSession(session: StashedSession) {
  sessionStorage.setItem(RETURN_SESSION_KEY, JSON.stringify(session));
}

export function readReturnSession(): StashedSession | null {
  const raw = sessionStorage.getItem(RETURN_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StashedSession;
  } catch {
    return null;
  }
}

export function setActiveImpersonation(info: ActiveImpersonation) {
  sessionStorage.setItem(ACTIVE_KEY, JSON.stringify(info));
}

export function readActiveImpersonation(): ActiveImpersonation | null {
  const raw = sessionStorage.getItem(ACTIVE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveImpersonation;
  } catch {
    return null;
  }
}

export function clearImpersonation() {
  sessionStorage.removeItem(RETURN_SESSION_KEY);
  sessionStorage.removeItem(ACTIVE_KEY);
}
