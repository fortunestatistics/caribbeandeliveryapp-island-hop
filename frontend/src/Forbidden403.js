import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { ShieldOff, Home, LogIn } from 'lucide-react';
import { useAuth } from './AuthContext';

const Forbidden403 = ({ requiredRoles = [] }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const roleList = requiredRoles.join(', ');

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4" data-testid="forbidden-page">
      <Card className="max-w-lg w-full border-red-500/30 bg-matte-900/80">
        <CardContent className="p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-5">
            <ShieldOff className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Access restricted</h1>
          <p className="text-sm text-muted-foreground mb-1">
            This area is only for {roleList || 'authorized'} accounts.
          </p>
          {user ? (
            <p className="text-xs text-muted-foreground mb-6">
              You're signed in as <span className="text-gold-500 font-medium">{user.user_type}</span> — switch accounts or head home.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mb-6">
              Please sign in with a {roleList || 'permitted'} account to continue.
            </p>
          )}
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate('/')} variant="outline" data-testid="forbidden-home-btn">
              <Home className="h-4 w-4 mr-2" />Home
            </Button>
            {!user && (
              <Button onClick={() => navigate('/login')} data-testid="forbidden-login-btn" className="bg-gold-gradient text-white">
                <LogIn className="h-4 w-4 mr-2" />Sign in
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Forbidden403;
