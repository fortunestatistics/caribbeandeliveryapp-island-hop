import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import Forbidden403 from './Forbidden403';

/**
 * Wrap a route element to enforce auth + role gating client-side.
 *
 * Props:
 *   children     — the page element to render when access is granted.
 *   allowedRoles — array of user_type values permitted on this route.
 *                  If omitted, any logged-in user is allowed.
 *
 * Behaviour:
 *   – auth still loading → small spinner (prevents Dashboard-style bounce).
 *   – not logged in     → redirect to /login (preserves intended route).
 *   – wrong role        → render the Forbidden403 page (no shell flash).
 *   – allowed           → render children.
 *
 * Note: Backend endpoints already 403 on role mismatch — this client guard
 * just prevents the page shell from rendering for the wrong audience.
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.user_type)) {
    return <Forbidden403 requiredRoles={allowedRoles} />;
  }

  return children;
};

export default ProtectedRoute;
