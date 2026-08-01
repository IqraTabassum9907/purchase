"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const success = await onLogin(username, password);
      if (!success) {
        setError("Invalid username or password. Please try again.");
      }
    } catch (err) {
      setError("An error occurred during login. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.1),transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,107,107,0.05),transparent_70%)] pointer-events-none" />

      <Card className="w-full max-w-md shadow-2xl border-0 bg-background/80 backdrop-blur-sm">
        <CardHeader className="text-center pb-8">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-linear-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <CardTitle className="text-3xl font-bold bg-linear-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Purchase Workflow
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Sign in to access your dashboard
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-md animate-in fade-in zoom-in duration-300">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="h-12 text-base"
                placeholder="Enter your username"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 text-base"
                placeholder="Enter your password"
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-linear-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-300"
              disabled={isLoading || !username || !password}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </div>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Please use your company credentials
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
        <p className="text-sm text-muted-foreground">
          Powered by{" "}
          <span className="font-semibold text-primary">Botivate</span>
        </p>
      </div>
    </div>
  );
}