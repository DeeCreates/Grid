// src/components/demo/DemoUserCreator.tsx
import { useState } from 'react';
import { Users, Plus, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { createDemoUsers, DEMO_USERS } from '@/scripts/createDemoUsers';

interface DemoUserCreatorProps {
  onComplete?: () => void;
}

export function DemoUserCreator({ onComplete }: DemoUserCreatorProps) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    created: string[];
    existing: string[];
    failed: { email: string; error: string }[];
  } | null>(null);

  const handleCreateUsers = async () => {
    setLoading(true);
    try {
      const result = await createDemoUsers();
      setResults(result);
      if (onComplete && result.created.length > 0) {
        onComplete();
      }
    } catch (error) {
      console.error('Failed to create demo users:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-[#161616] border border-neutral-800 rounded-2xl">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-lime-400/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6 text-lime-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-1">Demo Users</h3>
            <p className="text-sm text-neutral-400 mb-4">
              Create demo accounts for all user types to test the platform
            </p>

            {results ? (
              <div className="space-y-3">
                {/* Success */}
                {results.created.length > 0 && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-emerald-400 font-medium">
                          Created {results.created.length} new users
                        </p>
                        <div className="mt-1 space-y-0.5">
                          {results.created.map(email => (
                            <p key={email} className="text-xs text-emerald-300/70">
                              {email}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Existing */}
                {results.existing.length > 0 && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-blue-400 font-medium">
                          {results.existing.length} users already exist
                        </p>
                        <div className="mt-1 space-y-0.5">
                          {results.existing.map(email => (
                            <p key={email} className="text-xs text-blue-300/70">
                              {email}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Failed */}
                {results.failed.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-red-400 font-medium">
                          Failed to create {results.failed.length} users
                        </p>
                        <div className="mt-1 space-y-0.5">
                          {results.failed.map(f => (
                            <p key={f.email} className="text-xs text-red-300/70">
                              {f.email}: {f.error}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Show Demo Credentials */}
                <div className="bg-neutral-800/50 rounded-lg p-3">
                  <p className="text-xs text-neutral-400 font-medium mb-2">Demo Credentials:</p>
                  <div className="space-y-1 text-xs">
                    <p className="text-neutral-300">All accounts use: <span className="text-lime-400 font-mono">Demo@123</span></p>
                    {DEMO_USERS.map(user => (
                      <p key={user.email} className="text-neutral-400">
                        <span className="text-neutral-300">{user.role}:</span> {user.email}
                      </p>
                    ))}
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setResults(null)}
                  className="w-full bg-transparent border-neutral-700 text-neutral-400 hover:bg-neutral-800"
                >
                  Try Again
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleCreateUsers}
                disabled={loading}
                className="w-full bg-lime-400 text-black hover:bg-lime-300"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creating users...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create All Demo Users
                  </>
                )}
              </Button>
            )}

            <p className="text-[10px] text-neutral-500 mt-3">
              This will create {DEMO_USERS.length} demo accounts with the password "Demo@123"
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}