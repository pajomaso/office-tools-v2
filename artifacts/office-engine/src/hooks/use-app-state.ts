import { useState, useEffect } from 'react';

export function useAppState() {
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('officeEngineUser') || '';
  });
  
  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem('officeEngineAdmin') === 'true';
  });

  const saveUserName = (name: string) => {
    localStorage.setItem('officeEngineUser', name);
    setUserName(name);
  };

  const toggleAdmin = () => {
    const newState = !isAdmin;
    localStorage.setItem('officeEngineAdmin', String(newState));
    setIsAdmin(newState);
  };

  return {
    userName,
    saveUserName,
    isAdmin,
    toggleAdmin
  };
}
