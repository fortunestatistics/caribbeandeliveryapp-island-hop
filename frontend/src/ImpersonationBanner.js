import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Eye, X } from 'lucide-react';

// Persistent banner shown while an admin is viewing a user's dashboard read-only.
const ImpersonationBanner = () => {
  const { impersonation, exitImpersonation } = useAuth();
  const navigate = useNavigate();
  if (!impersonation) return null;

  const exit = async () => {
    await exitImpersonation();
    navigate('/admin');
  };

  return (
    <div
      className="fixed top-0 inset-x-0 z-[9999] flex items-center justify-center gap-3 px-4 py-2 text-sm font-medium text-white shadow-lg"
      style={{ background: 'linear-gradient(90deg,#b45309,#d97706)' }}
      data-testid="impersonation-banner"
    >
      <Eye className="h-4 w-4 shrink-0" />
      <span className="truncate">
        Viewing as <strong>{impersonation.targetName}</strong>
        {impersonation.userType ? ` (${impersonation.userType})` : ''} — admin, read-only
      </span>
      <button
        onClick={exit}
        className="ml-2 inline-flex items-center gap-1 rounded-full bg-white/20 hover:bg-white/30 px-3 py-1 transition-colors"
        data-testid="impersonation-exit-btn"
      >
        <X className="h-3.5 w-3.5" /> Exit
      </button>
    </div>
  );
};

export default ImpersonationBanner;
