"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Mail, Lock, User, LogIn, UserPlus, Hash } from "lucide-react";
import { authService } from "../../lib/authService";

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { label: "Weak", color: "bg-red-500" },
    { label: "Fair", color: "bg-amber-500" },
    { label: "Good", color: "bg-emerald-400" },
    { label: "Strong", color: "bg-green-500" },
  ];
  return { score, ...levels[score] };
}

export default function LoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // Handle rejected user redirect from middleware
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "rejected") {
      authService.signOut().catch(() => {});
      setError("Your account has been rejected. Contact an administrator.");
      window.history.replaceState({}, "", "/login");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          setError("Passwords do not match");
          setLoading(false);
          return;
        }
        const signUpResult = await authService.signUpWithCode(email, password, fullName, joinCode);
        // Attempt auto-confirm based on IP
        if (signUpResult?.user?.id) {
          fetch("/api/auth/auto-confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: signUpResult.user.id }),
          }).catch(() => {});
        }
        setMessage("Account created! Your account is pending admin approval.");
        setIsSignUp(false);
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setFullName("");
        setJoinCode("");
      } else {
        await authService.signIn(email, password);
        // Register session for device tracking
        const sessionToken = crypto.randomUUID();
        localStorage.setItem("gch-session-token", sessionToken);
        await fetch("/api/auth/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionToken, deviceInfo: navigator.userAgent }),
        }).catch(() => {});
        // Check approval status
        const profile = await authService.getMyProfile();
        if (profile?.approval_status === "pending") {
          router.push("/pending-approval");
        } else if (profile?.approval_status === "approved") {
          router.push("/");
        } else if (profile?.approval_status === "rejected") {
          setError("Your account has been rejected. Contact an administrator.");
          await authService.signOut();
        } else {
          router.push("/");
        }
      }
    } catch (err: any) {
      setError(err?.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-bg noise-overlay min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent-secondary)]/15 border border-white/5">
              <Sparkles size={28} className="text-[var(--accent)]" />
            </div>
            <h1 className="text-3xl font-display font-bold tracking-tight gradient-text">GoyCattleHerder CRM</h1>
          </div>
          <p className="text-gray-500 text-sm">
            {isSignUp ? "Create your account" : "Sign in to your account"}
          </p>
        </div>

        {/* Card */}
        <div className="glass-card-elevated rounded-2xl p-6 sm:p-8">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}
          {message && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm text-gray-400">Full Name</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-3 text-gray-500" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      placeholder="John Smith"
                      className="input-field py-2.5 w-full"
                      style={{ paddingLeft: '2.5rem' }}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm text-gray-400">Organization Code</label>
                  <div className="relative">
                    <Hash size={16} className="absolute left-3 top-3 text-gray-500" />
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      required
                      placeholder="XXXX-XXXX"
                      className="input-field py-2.5 w-full font-mono tracking-wider"
                      style={{ paddingLeft: '2.5rem' }}
                    />
                  </div>
                  <p className="text-xs text-gray-600">Ask your admin for this code.</p>
                </div>
              </>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-400">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                  className="input-field py-2.5 w-full"
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-400">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-3 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="input-field py-2.5 w-full"
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>
              {isSignUp && (
                <div className="mt-1.5 flex flex-col gap-1.5">
                  <label className="text-sm text-gray-400">Confirm Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-3 text-gray-500" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="••••••••"
                      className="input-field py-2.5 w-full"
                      style={{ paddingLeft: '2.5rem' }}
                    />
                  </div>
                  {confirmPassword.length > 0 && password !== confirmPassword && (
                    <p className="text-[10px] text-red-400">Passwords do not match</p>
                  )}
                </div>
              )}
              {isSignUp && password.length > 0 && (() => {
                const strength = getPasswordStrength(password);
                return (
                  <div className="mt-1.5">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength.score - 1 ? strength.color : "bg-white/10"}`} />
                      ))}
                    </div>
                    <p className={`text-[10px] mt-0.5 ${strength.score <= 1 ? "text-red-400" : strength.score === 2 ? "text-amber-400" : "text-emerald-400"}`}>
                      {strength.label}
                    </p>
                  </div>
                );
              })()}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary text-white font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isSignUp ? (
                <><UserPlus size={18} /> Request to Join</>
              ) : (
                <><LogIn size={18} /> Sign In</>
              )}
            </button>
          </form>

          {!isSignUp && !showForgotPassword && (
            <div className="mt-3 text-center">
              <button
                onClick={() => { setShowForgotPassword(true); setError(null); setMessage(null); setResetEmail(email); }}
                className="text-xs text-gray-500 hover:text-[var(--accent)] transition-colors"
              >
                Forgot password?
              </button>
            </div>
          )}

          {showForgotPassword && (
            <div className="mt-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
              <p className="text-sm text-gray-400">Enter your email to receive a password reset link.</p>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3 text-gray-500" />
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="input-field py-2.5 w-full"
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowForgotPassword(false)}
                  className="flex-1 text-sm text-gray-400 hover:text-white transition-colors py-2"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!resetEmail.trim()) return;
                    setResetLoading(true);
                    setError(null);
                    try {
                      await authService.resetPassword(resetEmail.trim());
                      setMessage("Password reset link sent! Check your email.");
                      setShowForgotPassword(false);
                    } catch (err: any) {
                      setError(err?.message || "Failed to send reset link");
                    } finally {
                      setResetLoading(false);
                    }
                  }}
                  disabled={resetLoading || !resetEmail.trim()}
                  className="flex-1 btn-primary text-white font-bold rounded-xl px-4 py-2 text-sm disabled:opacity-60"
                >
                  {resetLoading ? "Sending..." : "Send Reset Link"}
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null); setShowForgotPassword(false); }}
              className="text-sm text-gray-400 hover:text-[var(--accent)] transition-colors"
            >
              {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
