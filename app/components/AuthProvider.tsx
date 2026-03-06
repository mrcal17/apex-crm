"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/projectService";
import type { Role } from "../../lib/roles";

interface AuthContextType {
  session: Session | null;
  profile: any | null;
  role: Role;
  profileId: string | null;
  organizationId: string | null;
  organizationName: string | null;
  isApproved: boolean;
  isPending: boolean;
  isRejected: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  role: "sales_rep",
  profileId: null,
  organizationId: null,
  organizationName: null,
  isApproved: false,
  isPending: false,
  isRejected: false,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("*, organizations!profiles_organization_id_fkey(name, slug)")
      .eq("auth_user_id", userId)
      .single();
    setProfile(data);
    return data;
  }

  async function refreshProfile() {
    if (session?.user?.id) {
      await fetchProfile(session.user.id);
    }
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user?.id) {
        fetchProfile(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch(() => setLoading(false));

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
        if (s?.user?.id) {
          await fetchProfile(s.user.id);
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const role: Role = profile?.role || "sales_rep";
  const isApproved = profile?.approval_status === "approved";
  const isPending = profile?.approval_status === "pending";
  const isRejected = profile?.approval_status === "rejected";
  const profileId = profile?.id || null;
  const organizationId = profile?.organization_id || null;
  const organizationName = profile?.organizations?.name || null;

  async function handleSignOut() {
    // Clean up session tracking
    const token = localStorage.getItem("gch-session-token");
    if (token) {
      fetch("/api/auth/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken: token }),
      }).catch(() => {});
      localStorage.removeItem("gch-session-token");
    }
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        role,
        profileId,
        organizationId,
        organizationName,
        isApproved,
        isPending,
        isRejected,
        loading,
        signOut: handleSignOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
