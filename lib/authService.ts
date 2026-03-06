import { supabase } from './projectService';

export interface UserProfile {
  id: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'manager' | 'sales_rep';
  commission_rate: number;
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  organization_id: string | null;
  created_at: string;
}

export const authService = {
  async signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });
    if (error) throw error;
    return data;
  },

  async signUpNewOrg(email: string, password: string, fullName: string, orgName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, org_name: orgName },
      },
    });
    if (error) throw error;
    return data;
  },

  async signUpWithCode(email: string, password: string, fullName: string, joinCode: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, join_code: joinCode },
      },
    });
    if (error) throw error;
    return data;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async getMyProfile(): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    if (error) return null;
    return data;
  },

  async getPendingUsers(): Promise<UserProfile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  async approveUser(profileId: string, role: 'superadmin' | 'admin' | 'manager' | 'sales_rep' = 'sales_rep') {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get the approver's profile id
    const { data: approverProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    const { data, error } = await supabase
      .from('profiles')
      .update({
        approval_status: 'approved',
        role,
        approved_by: approverProfile?.id || null,
        approved_at: new Date().toISOString(),
      })
      .eq('id', profileId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) throw error;
  },

  async rejectUser(profileId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ approval_status: 'rejected' })
      .eq('id', profileId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
