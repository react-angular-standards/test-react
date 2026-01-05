/** @format */

import React, { createContext, useContext } from 'react';

interface Session {
  name: string;
  email?: string;
  role?: string;
}

interface AuthContextType {
  session: Session | null;
}

const AuthContext = createContext<AuthContextType>({ session: null });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const session = { name: 'User', email: 'user@example.com', role: 'user' };

  return (
    <AuthContext.Provider value={{ session }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
