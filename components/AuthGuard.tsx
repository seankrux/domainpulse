import React, { ReactNode } from 'react';

interface AuthGuardProps {
  children: ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  // Portfolio demo — skip authentication, show dashboard directly
  return <>{children}</>;
};
