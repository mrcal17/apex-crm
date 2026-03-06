import { supabase } from './projectService';

export interface Lead {
  id: string;
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  active: boolean;
  created_at: string;
  converted_to_project_id?: string | null;
  converted_at?: string | null;
}

export const leadService = {
  async getActiveLeads(): Promise<Lead[]> {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('active', true)
      .order('name');
    if (error) throw error;
    return data ?? [];
  },

  async createLead(lead: Omit<Lead, 'id' | 'active' | 'created_at'>): Promise<Lead> {
    const { data, error } = await supabase
      .from('leads')
      .insert([{ ...lead, active: true }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async archiveLead(id: string): Promise<void> {
    const { error } = await supabase
      .from('leads')
      .update({ active: false })
      .eq('id', id);
    if (error) throw error;
  },

  async convertLead(leadId: string, projectId: string): Promise<void> {
    const { error } = await supabase
      .from('leads')
      .update({
        converted_to_project_id: projectId,
        converted_at: new Date().toISOString(),
        active: false,
      })
      .eq('id', leadId);
    if (error) throw error;
  },

  async batchArchive(ids: string[]): Promise<void> {
    const { error } = await supabase
      .from('leads')
      .update({ active: false })
      .in('id', ids);
    if (error) throw error;
  },

  async batchDelete(ids: string[]): Promise<void> {
    const { error } = await supabase
      .from('leads')
      .delete()
      .in('id', ids);
    if (error) throw error;
  },

  async getAllLeads(): Promise<Lead[]> {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getConversionStats(): Promise<{ total: number; converted: number; conversionRate: number; avgDaysToConvert: number }> {
    const { data } = await supabase.from('leads').select('*');
    const leads = data || [];
    const total = leads.length;
    const converted = leads.filter(l => l.converted_to_project_id).length;
    const conversionRate = total > 0 ? (converted / total) * 100 : 0;

    let totalDays = 0;
    let convertedCount = 0;
    for (const l of leads) {
      if (l.converted_at && l.created_at) {
        const days = (new Date(l.converted_at).getTime() - new Date(l.created_at).getTime()) / 86400000;
        totalDays += days;
        convertedCount++;
      }
    }
    const avgDaysToConvert = convertedCount > 0 ? totalDays / convertedCount : 0;

    return { total, converted, conversionRate, avgDaysToConvert };
  },
};
