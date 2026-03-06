import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

export const projectService = {
  // 1. Create a New Project & Automate Permit Setup
  async createProject(projectData: {
    name: string;
    client: string;
    value: number;
    salesRepId: string;
  }) {
    const { data, error } = await supabase
      .from('projects')
      .insert([
        { 
          name: projectData.name, 
          client_name: projectData.client, 
          contract_value: projectData.value, 
          sales_rep_id: projectData.salesRepId,
          status: 'lead' 
        }
      ])
      .select()
      .single();

    if (error) throw error;

    return data;
  },

  // 2. Complete Project & Trigger Commission
  async completeProject(projectId: string) {
    // First fetch the project to get contract_value for revenue
    const { data: existing, error: fetchErr } = await supabase
      .from('projects')
      .select('contract_value')
      .eq('id', projectId)
      .single();

    if (fetchErr) throw fetchErr;

    const { data: project, error: pError } = await supabase
      .from('projects')
      .update({
        status: 'completed',
        revenue_collected: existing.contract_value,
      })
      .eq('id', projectId)
      .select()
      .single();

    if (pError) throw pError;

    // Logic: Fetch Sales Rep's commission rate
    const { data: profile } = await supabase
      .from('profiles')
      .select('commission_rate')
      .eq('id', project.sales_rep_id)
      .single();

    const flatRate = profile?.commission_rate || 0.10;

    // Check for tiered commission rates in settings
    const { data: tiersSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'commission_tiers')
      .maybeSingle();

    let amount: number;
    if (tiersSetting?.value) {
      try {
        type Tier = { upTo: number | null; rate: number };
        const tiers: Tier[] = JSON.parse(tiersSetting.value);
        const sorted = tiers.slice().sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity));
        const contractValue = Number(project.contract_value);
        const match = sorted.find((t) => t.upTo === null || contractValue <= t.upTo);
        amount = contractValue * (match?.rate ?? flatRate);
      } catch {
        amount = project.contract_value * flatRate;
      }
    } else {
      amount = project.contract_value * flatRate;
    }

    // Create the Commission Entry
    await supabase.from('commissions').insert([{
      project_id: projectId,
      sales_rep_id: project.sales_rep_id,
      amount: amount,
      status: 'unpaid'
    }]);

    return { project, commission: amount };
  },

  // 3. Fetch Revenue Summary
  async getRevenueStats() {
    const { data, error } = await supabase
      .from('projects')
      .select('contract_value, revenue_collected, status');

    if (error) throw error;

    return data.reduce((acc, curr) => {
      acc.totalPipeline += Number(curr.contract_value);
      acc.totalCollected += Number(curr.revenue_collected);
      return acc;
    }, { totalPipeline: 0, totalCollected: 0 });
  },

  // 4. Fetch All Projects
  async getProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // 5. Update a Project
  async updateProject(id: string, updates: Partial<{
    name: string;
    address: string;
    client_name: string;
    contract_value: number;
    revenue_collected: number;
    status: string;
    interconnection_status: string;
    interconnection_submitted_at: string | null;
    interconnection_approved_at: string | null;
    pto_status: string;
    pto_submitted_at: string | null;
    pto_granted_at: string | null;
    utility_name: string;
    utility_checklist: Array<{ name: string; required: boolean; completed: boolean }>;
  }>) {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 6. Delete a Project
  async deleteProject(id: string) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // 7. Fetch All Profiles
  async getProfiles() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, commission_rate');

    if (error) throw error;
    return data;
  },

  // 8. Fetch Permits for a Project
  async getPermitsByProject(projectId: string) {
    const { data, error } = await supabase
      .from('permits')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // 9. Update Permit Status
  async updatePermitStatus(permitId: string, status: string) {
    const { data, error } = await supabase
      .from('permits')
      .update({ status })
      .eq('id', permitId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 10. Fetch Commissions for a Project
  async getCommissionsByProject(projectId: string) {
    const { data, error } = await supabase
      .from('commissions')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // 11. Fetch Blueprints for a Project
  async getBlueprintsByProject(projectId: string) {
    const { data, error } = await supabase
      .from('blueprints')
      .select('*')
      .eq('project_id', projectId)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // 12. Upload Blueprint Metadata
  async uploadBlueprint(projectId: string, fileName: string, fileUrl: string) {
    const { data, error } = await supabase
      .from('blueprints')
      .insert([{
        project_id: projectId,
        file_name: fileName,
        file_url: fileUrl
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 12b. Delete a Blueprint
  async deleteBlueprint(id: string) {
    const { error } = await supabase
      .from('blueprints')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // 12c. Rename a Blueprint
  async renameBlueprint(id: string, fileName: string) {
    const { data, error } = await supabase
      .from('blueprints')
      .update({ file_name: fileName })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 13. Create a Profile (salesperson/admin)
  async createProfile(profileData: {
    full_name: string;
    role: string;
    commission_rate: number;
  }) {
    const { data, error } = await supabase
      .from('profiles')
      .insert([profileData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 14. Update a Profile
  async updateProfile(id: string, updates: Partial<{
    full_name: string;
    role: string;
    commission_rate: number;
  }>) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 15. Delete a Profile
  async deleteProfile(id: string) {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // 16. Create a Permit (independent of projects)
  async createPermit(permitData: {
    project_id?: string;
    agency?: string;
    permit_number?: string;
    status?: string;
    expiration_date?: string;
  }) {
    const { data, error } = await supabase
      .from('permits')
      .insert([permitData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 17. Update a Permit (full update, not just status)
  async updatePermit(permitId: string, updates: Partial<{
    project_id: string | null;
    agency: string;
    permit_number: string;
    status: string;
    expiration_date: string;
  }>) {
    const { data, error } = await supabase
      .from('permits')
      .update(updates)
      .eq('id', permitId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 17b. Delete a Permit
  async deletePermit(permitId: string) {
    const { error } = await supabase
      .from('permits')
      .delete()
      .eq('id', permitId);

    if (error) throw error;
  },

  // 18. Update a Commission
  async updateCommission(commissionId: string, updates: Partial<{
    status: string;
    payout_date: string;
  }>) {
    const { data, error } = await supabase
      .from('commissions')
      .update(updates)
      .eq('id', commissionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 19. Fetch Commissions by Sales Rep
  async getCommissionsBySalesRep(salesRepId: string) {
    const { data, error } = await supabase
      .from('commissions')
      .select('*, projects(name)')
      .eq('sales_rep_id', salesRepId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // 19b. Advance Permit Status (Pending -> Submitted -> Approved)
  async advancePermitStatus(permitId: string) {
    const { data: permit, error: fetchErr } = await supabase
      .from('permits')
      .select('status')
      .eq('id', permitId)
      .single();

    if (fetchErr || !permit) throw new Error('Permit not found');

    const nextStatus: Record<string, string> = {
      pending: 'submitted',
      submitted: 'approved',
    };

    const next = nextStatus[permit.status];
    if (!next) throw new Error(`Cannot advance permit from "${permit.status}"`);

    return this.updatePermitStatus(permitId, next);
  },

  // 20. Permit Stats
  async getPermitStats() {
    const { data, error } = await supabase
      .from('permits')
      .select('status, expiration_date');

    if (error) throw error;

    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const activePermits = data.filter(p => p.status !== 'expired').length;
    const expiringPermits = data.filter(p => {
      if (!p.expiration_date) return false;
      const exp = new Date(p.expiration_date);
      return exp >= now && exp <= thirtyDays;
    }).length;

    return { activePermits, expiringPermits };
  },

  // 21. Commission Summary Stats
  async getCommissionStats() {
    const { data, error } = await supabase
      .from('commissions')
      .select('amount, status');

    if (error) throw error;

    return data.reduce((acc, c) => {
      const amt = Number(c.amount ?? 0);
      acc.total += amt;
      if (c.status === 'paid') acc.paid += amt;
      else acc.unpaid += amt;
      acc.count += 1;
      return acc;
    }, { total: 0, paid: 0, unpaid: 0, count: 0 });
  },

  // 22. Get All Settings
  async getSettings() {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value');

    if (error) throw error;

    const map: Record<string, string> = {};
    for (const row of data || []) {
      map[row.key] = row.value;
    }
    return map;
  },

  // 23. Upsert a Setting
  async upsertSetting(key: string, value: string) {
    const { data, error } = await supabase
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 24. Fetch All Commissions (across all reps)
  async getAllCommissions() {
    const { data, error } = await supabase
      .from('commissions')
      .select('*, profiles(full_name), projects(name)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // 25. Fetch All Permits
  async getAllPermits() {
    const { data, error } = await supabase
      .from('permits')
      .select('*, projects(name)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // 26. Request Completion (sales rep flow)
  async requestCompletion(projectId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) throw new Error('Profile not found');

    // Check for existing pending request
    const { data: existing } = await supabase
      .from('pending_completions')
      .select('id')
      .eq('project_id', projectId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) throw new Error('A completion request is already pending for this project');

    const { data, error } = await supabase
      .from('pending_completions')
      .insert([{ project_id: projectId, requested_by: profile.id }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 27. Get Pending Completions (for managers/admins)
  async getPendingCompletions() {
    const { data, error } = await supabase
      .from('pending_completions')
      .select('*, projects(name, contract_value, client_name), profiles!pending_completions_requested_by_fkey(full_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // 28. Approve Completion
  async approveCompletion(pendingId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: reviewerProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    // Get the pending record
    const { data: pending, error: fetchErr } = await supabase
      .from('pending_completions')
      .select('project_id')
      .eq('id', pendingId)
      .eq('status', 'pending')
      .single();

    if (fetchErr || !pending) throw new Error('Pending completion not found');

    // Actually complete the project (status + commission)
    await this.completeProject(pending.project_id);

    // Mark as approved
    const { error } = await supabase
      .from('pending_completions')
      .update({ status: 'approved', reviewed_by: reviewerProfile?.id, reviewed_at: new Date().toISOString() })
      .eq('id', pendingId);

    if (error) throw error;
  },

  // 29. Reject Completion
  async rejectCompletion(pendingId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: reviewerProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    const { error } = await supabase
      .from('pending_completions')
      .update({ status: 'rejected', reviewed_by: reviewerProfile?.id, reviewed_at: new Date().toISOString() })
      .eq('id', pendingId);

    if (error) throw error;
  },

  // 30. Commission Summary by Sales Rep
  async getCommissionSummaryByRep() {
    const { data, error } = await supabase
      .from('commissions')
      .select('sales_rep_id, amount, status, profiles(full_name)');

    if (error) throw error;

    const byRep = new Map<string, { name: string; total: number; paid: number; unpaid: number; count: number }>();
    for (const c of data || []) {
      const repId = c.sales_rep_id;
      if (!repId) continue;
      const entry = byRep.get(repId) || { name: (c.profiles as any)?.full_name || 'Unknown', total: 0, paid: 0, unpaid: 0, count: 0 };
      const amt = Number(c.amount ?? 0);
      entry.total += amt;
      if (c.status === 'paid') entry.paid += amt;
      else entry.unpaid += amt;
      entry.count += 1;
      byRep.set(repId, entry);
    }

    return Array.from(byRep.entries()).map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.total - a.total);
  },

  // 31. Communications — CRUD + send
  async getCommunicationsByProject(projectId: string) {
    const { data, error } = await supabase
      .from('communications')
      .select('*, client_contacts(name, email, phone)')
      .eq('project_id', projectId)
      .order('sent_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getCommunicationsByContact(contactId: string) {
    const { data, error } = await supabase
      .from('communications')
      .select('*, projects(name)')
      .eq('contact_id', contactId)
      .order('sent_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async createCommunication(commData: {
    project_id?: string;
    contact_id?: string;
    channel: 'email' | 'sms';
    direction: 'inbound' | 'outbound';
    subject?: string;
    body: string;
    from: string;
    to: string;
    status?: string;
    metadata?: Record<string, unknown>;
  }) {
    const { data, error } = await supabase
      .from('communications')
      .insert([commData])
      .select('*, client_contacts(name, email, phone)')
      .single();

    if (error) throw error;
    return data;
  },

  async deleteCommunication(id: string) {
    const { error } = await supabase
      .from('communications')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // 32. Message Templates
  async getMessageTemplates() {
    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .order('name');

    if (error) throw error;
    return data;
  },

  async createMessageTemplate(template: {
    name: string;
    channel: 'email' | 'sms';
    subject?: string;
    body: string;
    created_by?: string;
  }) {
    const { data, error } = await supabase
      .from('message_templates')
      .insert([template])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteMessageTemplate(id: string) {
    const { error } = await supabase
      .from('message_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // 33. Update Interconnection Status
  async updateInterconnectionStatus(projectId: string, status: 'not_started' | 'submitted' | 'approved' | 'denied') {
    const timestamps: Record<string, string | null> = {};
    const now = new Date().toISOString();

    if (status === 'submitted') {
      timestamps.interconnection_submitted_at = now;
    } else if (status === 'approved') {
      timestamps.interconnection_approved_at = now;
    } else if (status === 'not_started') {
      timestamps.interconnection_submitted_at = null;
      timestamps.interconnection_approved_at = null;
    }

    const { data, error } = await supabase
      .from('projects')
      .update({ interconnection_status: status, ...timestamps })
      .eq('id', projectId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 34. Update PTO Status
  async updatePtoStatus(projectId: string, status: 'not_started' | 'submitted' | 'granted') {
    const timestamps: Record<string, string | null> = {};
    const now = new Date().toISOString();

    if (status === 'submitted') {
      timestamps.pto_submitted_at = now;
    } else if (status === 'granted') {
      timestamps.pto_granted_at = now;
    } else if (status === 'not_started') {
      timestamps.pto_submitted_at = null;
      timestamps.pto_granted_at = null;
    }

    const { data, error } = await supabase
      .from('projects')
      .update({ pto_status: status, ...timestamps })
      .eq('id', projectId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 35. Update Utility Info & Checklist
  async updateUtilityInfo(projectId: string, updates: {
    utility_name?: string;
    utility_checklist?: Array<{ name: string; required: boolean; completed: boolean }>;
  }) {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 36. Get Interconnection & PTO Status for a Project
  async getInterconnectionPtoStatus(projectId: string) {
    const { data, error } = await supabase
      .from('projects')
      .select('interconnection_status, interconnection_submitted_at, interconnection_approved_at, pto_status, pto_submitted_at, pto_granted_at, utility_name, utility_checklist')
      .eq('id', projectId)
      .single();

    if (error) throw error;
    return data;
  },

  // 37. Batch Reassign Projects
  async batchReassign(ids: string[], salesRepId: string) {
    const { data, error } = await supabase
      .from('projects')
      .update({ sales_rep_id: salesRepId })
      .in('id', ids)
      .select();

    if (error) throw error;
    return data;
  },

  // 38. Batch Delete Projects
  async batchDelete(ids: string[]) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .in('id', ids);

    if (error) throw error;
  },

  // 39. Project Stats
  async getProjectStats() {
    const { data, error } = await supabase
      .from('projects')
      .select('status, contract_value');

    if (error) throw error;

    const byStatus: Record<string, number> = {};
    let totalValue = 0;
    for (const p of data) {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
      totalValue += Number(p.contract_value ?? 0);
    }

    return {
      total: data.length,
      byStatus,
      avgValue: data.length > 0 ? totalValue / data.length : 0,
    };
  }
};
