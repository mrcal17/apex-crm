"use client";

import { useState, useEffect, useMemo } from "react";
import { UserPlus, Search, Phone, Mail, Building2, X, Edit3, Trash2, User } from "lucide-react";
import { supabase } from "../../lib/projectService";
import { _rl, type Role } from "../../lib/roles";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  notes: string | null;
  created_at: string;
}

interface ClientContactsProps {
  role?: Role;
}

export default function ClientContacts({ role = "sales_rep" }: ClientContactsProps) {
  const canCreateEdit = _rl(role) >= 2;
  const canDelete = _rl(role) >= 2;
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", role: "", notes: "" });
  const [saving, setSaving] = useState(false);

  async function loadContacts() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("client_contacts")
        .select("*")
        .order("name", { ascending: true });
      setContacts(data || []);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadContacts(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel("contacts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "client_contacts" }, () => loadContacts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => {
    if (!searchQuery) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter((c) =>
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    );
  }, [contacts, searchQuery]);

  function openNew() {
    setForm({ name: "", email: "", phone: "", company: "", role: "", notes: "" });
    setEditingContact(null);
    setShowForm(true);
  }

  function openEdit(contact: Contact) {
    setForm({
      name: contact.name || "",
      email: contact.email || "",
      phone: contact.phone || "",
      company: contact.company || "",
      role: contact.role || "",
      notes: contact.notes || "",
    });
    setEditingContact(contact);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        company: form.company.trim() || null,
        role: form.role.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (editingContact) {
        await supabase.from("client_contacts").update(payload).eq("id", editingContact.id);
      } else {
        await supabase.from("client_contacts").insert([payload]);
      }
      setShowForm(false);
      loadContacts();
    } catch (err) {
      console.error("Failed to save contact:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this contact?")) return;
    try {
      await supabase.from("client_contacts").delete().eq("id", id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // ignore
    }
  }

  return (
    <>
      {/* Form Modal — rendered outside overflow-hidden container */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="glass-card-elevated rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">{editingContact ? "Edit Contact" : "New Contact"}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-white/10 text-gray-400">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-600 px-3 py-2 focus:outline-none focus:border-[var(--accent)]/40"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-600 px-3 py-2 focus:outline-none focus:border-[var(--accent)]/40"
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-600 px-3 py-2 focus:outline-none focus:border-[var(--accent)]/40"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Company"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-600 px-3 py-2 focus:outline-none focus:border-[var(--accent)]/40"
                />
                <input
                  type="text"
                  placeholder="Role / Title"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-600 px-3 py-2 focus:outline-none focus:border-[var(--accent)]/40"
                />
              </div>
              <textarea
                placeholder="Notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-600 px-3 py-2 focus:outline-none focus:border-[var(--accent)]/40 resize-none"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!form.name.trim() || saving}
                  className="btn-primary px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingContact ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card-elevated rounded-2xl overflow-hidden mt-6">
      <div className="p-5 border-b border-white/[0.06] bg-gradient-to-r from-purple-500/[0.04] to-transparent">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-purple-500/10">
              <User size={18} className="text-purple-400" />
            </div>
            Client Contacts
            <span className="text-sm font-normal text-gray-500">({contacts.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 text-gray-500" size={14} />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs text-white placeholder-gray-600 pl-8 pr-3 py-1.5 w-44 focus:outline-none focus:border-[var(--accent)]/40"
              />
            </div>
            {canCreateEdit && (
              <button
                onClick={openNew}
                className="flex items-center gap-1.5 text-xs font-medium bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 px-3 py-1.5 rounded-lg transition-colors border border-purple-500/20"
              >
                <UserPlus size={14} /> Add
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Contact List */}
      <div className="max-h-[500px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
            <div className="w-5 h-5 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin mr-2" />
            Loading contacts...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            <User size={24} className="mx-auto mb-2 opacity-40" />
            <p>{searchQuery ? "No contacts match your search." : "No client contacts yet."}</p>
            {!searchQuery && (
              <button onClick={openNew} className="mt-2 text-xs text-[var(--accent)] hover:underline">
                Add your first contact
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtered.map((c) => (
              <div key={c.id} className="px-5 py-3 hover:bg-white/[0.02] transition-colors group flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500/20 to-[var(--accent)]/20 flex items-center justify-center text-sm font-bold text-white/70 shrink-0">
                  {c.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">{c.name}</p>
                    {c.role && <span className="text-[10px] text-gray-500">{c.role}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {c.company && (
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Building2 size={10} /> {c.company}
                      </span>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="text-[11px] text-gray-500 hover:text-[var(--accent)] flex items-center gap-1 transition-colors">
                        <Mail size={10} /> {c.email}
                      </a>
                    )}
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="text-[11px] text-gray-500 hover:text-emerald-400 flex items-center gap-1 transition-colors">
                        <Phone size={10} /> {c.phone}
                      </a>
                    )}
                  </div>
                  {c.notes && <p className="text-[10px] text-gray-600 mt-0.5 truncate">{c.notes}</p>}
                </div>
                {(canCreateEdit || canDelete) && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {canCreateEdit && (
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-[var(--accent)]/10 text-gray-500 hover:text-[var(--accent)] transition-all">
                        <Edit3 size={14} />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-all">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
