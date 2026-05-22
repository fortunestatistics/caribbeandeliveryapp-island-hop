import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Gift, Copy, Users, CheckCircle, Clock, Share2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ReferralPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchReferrals();
  }, []);

  const fetchReferrals = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/referrals/my-referrals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const copyCode = () => {
    if (!data?.code) return;
    navigator.clipboard.writeText(data.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareCode = () => {
    if (!data?.code) return;
    const text = `Join me on IslandHop! Use my code ${data.code} when you sign up and we both get ${data.reward_amount} ${data.reward_currency}.`;
    if (navigator.share) {
      navigator.share({ title: 'IslandHop Referral', text });
    } else {
      navigator.clipboard.writeText(text);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500/30"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8" data-testid="referral-page">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Gift className="h-8 w-8 text-gold-500" />
            Refer & Earn
          </h1>
          <p className="text-muted-foreground mt-1">
            Earn {data?.reward_amount} {data?.reward_currency} for every friend that signs up and places their first paid order. Your friend also gets the same reward to their IslandHop wallet.
          </p>
        </div>

        <Card className="border-gold-500/30 mb-6">
          <CardHeader>
            <CardTitle>Your Referral Code</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between bg-matte-900/60 border border-gold-500/20 rounded-lg p-6">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Share this code</p>
                <p data-testid="referral-code-text" className="text-4xl font-bold tracking-widest text-gold-500 font-mono">
                  {data?.code || '—'}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button data-testid="copy-referral-code-btn" variant="outline" onClick={copyCode}>
                  <Copy className="h-4 w-4 mr-2" />
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                <Button data-testid="share-referral-code-btn" onClick={shareCode}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Referrals</p>
                  <p className="text-2xl font-bold" data-testid="referrals-total">{data?.total_referrals || 0}</p>
                </div>
                <Users className="h-8 w-8 text-neon-cyan" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-green-500" data-testid="referrals-completed">{data?.completed || 0}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Earned ({data?.reward_currency})</p>
                  <p className="text-2xl font-bold text-gold-500" data-testid="referrals-earned">
                    {(data?.total_earned || 0).toFixed(2)}
                  </p>
                </div>
                <Gift className="h-8 w-8 text-gold-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Referral History</CardTitle>
          </CardHeader>
          <CardContent>
            {(!data?.referrals || data.referrals.length === 0) ? (
              <p className="text-center text-muted-foreground py-8" data-testid="no-referrals">
                No referrals yet. Share your code to start earning!
              </p>
            ) : (
              <div className="space-y-3">
                {data.referrals.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-4 bg-matte-900/40 rounded-lg" data-testid={`referral-row-${r.id}`}>
                    <div>
                      <p className="font-medium text-foreground">Code: {r.code_used}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge className={
                        r.status === 'completed'
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                      }>
                        {r.status === 'completed' ? (
                          <><CheckCircle className="h-3 w-3 mr-1" />Completed</>
                        ) : (
                          <><Clock className="h-3 w-3 mr-1" />Pending</>
                        )}
                      </Badge>
                      <p className="text-sm text-gold-500 font-semibold mt-1">
                        +{r.reward_amount} {r.reward_currency}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReferralPage;
