import React from 'react';
import { useLocation, Navigate, Routes, Route } from 'react-router-dom';
import PasswordResetForm from './PasswordResetForm';
import EmailVerificationConfirmation from './EmailVerificationConfirmation';

const AuthRoutes: React.FC = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  
  // Extract action and oobCode from URL
  const mode = queryParams.get('mode');
  const oobCode = queryParams.get('oobCode');
  
  if (!mode || !oobCode) {
    return <Navigate to="/" replace />;
  }
  
  return (
    <Routes>
      <Route path="/reset-password" element={
        mode === 'resetPassword' ? 
          <PasswordResetForm oobCode={oobCode} onBackToLogin={() => window.location.href = '/'} /> : 
          <Navigate to="/" replace />
      } />
      
      <Route path="/verify-email" element={
        mode === 'verifyEmail' ? 
          <EmailVerificationConfirmation oobCode={oobCode} /> : 
          <Navigate to="/" replace />
      } />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AuthRoutes;