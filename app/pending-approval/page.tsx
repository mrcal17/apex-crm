"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Clock, LogOut, Sparkles, XCircle } from "lucide-react";
import { useAuth } from "../components/AuthProvider";
import { supabase } from "../../lib/projectService";

export default function PendingApprovalPage() {
  const router = useRouter();
  const { session, profile, organizationName, isApproved, isRejected, signOut } = useAuth();
  const [rejected, setRejected] = useState(false);

  // Redirect to dashboard if already approved
  useEffect(() => {
    if (isApproved) {
      router.push("/");
    }
  }, [isApproved, router]);

  // Check for rejected status on mount and when profile updates
  useEffect(() => {
    if (isRejected) setRejected(true);
  }, [isRejected]);

  // Subscribe to profile changes to auto-redirect on approval
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`profile-approval-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${profile.id}`,
        },
        (payload) => {
          if (payload.new.approval_status === "approved") {
            router.push("/");
          } else if (payload.new.approval_status === "rejected") {
            setRejected(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, router]);

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <div className="app-bg noise-overlay min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center gap-3 mb-8">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-[var(--accent)]/20 to-purple-500/20 border border-white/5">
            <Sparkles size={28} className="text-[var(--accent)]" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight gradient-text">GoyCattleHerder CRM</h1>
        </div>

        <div className="glass-card-elevated rounded-2xl p-8">
          {rejected ? (
            <>
              <div className="p-3 rounded-full bg-red-500/10 inline-flex mb-4">
                <XCircle size={32} className="text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Account Rejected</h2>
              <p className="text-gray-400 text-sm mb-6">
                Your account request has been rejected by an administrator.
                Please contact your organization if you believe this is an error.
              </p>
            </>
          ) : (
            <>
              <div className="p-3 rounded-full bg-amber-500/10 inline-flex mb-4">
                <Clock size={32} className="text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Pending Approval</h2>
              {organizationName && (
                <p className="text-white/40 text-xs mb-2">{organizationName}</p>
              )}
              <p className="text-gray-400 text-sm mb-6">
                Your account has been created but is waiting for admin approval.
                You&apos;ll be automatically redirected once approved.
              </p>
            </>
          )}

          {session?.user?.email && (
            <p className="text-gray-500 text-xs mb-6">
              Signed in as <span className="text-white/70">{session.user.email}</span>
            </p>
          )}

          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white glass-card rounded-xl px-4 py-2.5 transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
