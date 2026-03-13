import { useState } from 'react';

// Versioned key — old sessions (pre-password) stored under 'officeEngineAdmin'
// Using V2 forces everyone to re-authenticate
const ADMIN_KEY = 'officeEngineAdminV2';

export function useAppState() {
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('officeEngineUser') || '';
  });

  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem(ADMIN_KEY) === 'true';
  });

  const saveUserName = (name: string) => {
    localStorage.setItem('officeEngineUser', name);
    setUserName(name);
  };

  const enterAdmin = async (password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        localStorage.setItem(ADMIN_KEY, 'true');
        setIsAdmin(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const exitAdmin = () => {
    localStorage.setItem(ADMIN_KEY, 'false');
    setIsAdmin(false);
  };

  const toggleAdmin = () => {
    if (isAdmin) exitAdmin();
  };

  return {
    userName,
    saveUserName,
    isAdmin,
    toggleAdmin,
    enterAdmin,
    exitAdmin,
  };
}
