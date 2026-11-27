// Cloud storage adapters for MAHI (Supabase).
// Workflow state lives in public.mahi_docs (one row per document per user);
// saved reports live in public.mahi_reports. Row Level Security limits both to auth.uid().

const authError = (error) => {
  const e = new Error(error.message || 'Request failed');
  if (error.status === 401 || /JWT|auth/i.test(error.message || '')) e.auth = true;
  return e;
};

export function createSyncAdapter(supabase, userId) {
  return {
    label: 'your MAHI cloud account',
    async listDocs() {
      const { data, error } = await supabase.from('mahi_docs').select('doc_key, body').eq('user_id', userId);
      if (error) throw authError(error);
      const docs = {};
      (data || []).forEach((r) => { docs[r.doc_key] = r.body; });
      return docs;
    },
    async writeDoc(key, body) {
      const { error } = await supabase.from('mahi_docs').upsert({ user_id: userId, doc_key: key, body }, { onConflict: 'user_id,doc_key' });
      if (error) throw authError(error);
    },
    subscribe(onChange) {
      const channel = supabase
        .channel('mahi-docs-' + userId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mahi_docs', filter: `user_id=eq.${userId}` }, (payload) => {
          const row = payload.new || {};
          if (row.doc_key) onChange(row.doc_key, row.body);
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    },
  };
}

export function createReportsApi(supabase, userId) {
  return {
    async saveReport({ title, report_type, period_from, period_to, content }) {
      const { error } = await supabase.from('mahi_reports').insert({ user_id: userId, title, report_type, period_from: period_from || null, period_to: period_to || null, content });
      if (error) throw authError(error);
    },
    async listReports() {
      const { data, error } = await supabase.from('mahi_reports').select('id, title, report_type, period_from, period_to, content, created_at').order('created_at', { ascending: false }).limit(200);
      if (error) throw authError(error);
      return data || [];
    },
    async deleteReport(id) {
      const { error } = await supabase.from('mahi_reports').delete().eq('id', id);
      if (error) throw authError(error);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Schema v2 (current): record-level sync. Writes ONLY through public.mahi_push, reads through
// public.mahi_pull. Direct table writes are revoked in the database, so this is the only path.
const TABLES_V2 = ['profiles', 'brands', 'campaigns', 'sets', 'deliverables', 'tasks', 'work_reports', 'work_sessions', 'focus_sessions', 'achievements', 'notifications', 'notes'];
export function createRpcAdapter(supabase, userId) {
  const device = (() => {
    try { let d = localStorage.getItem('mahi.device'); if (!d) { d = 'web-' + Math.random().toString(36).slice(2, 8); localStorage.setItem('mahi.device', d); } return d; } catch (e) { return 'web'; }
  })();
  return {
    label: 'your MAHI cloud account',
    device,
    async rpc(name, args) {
      let res;
      try { res = await supabase.rpc(name, args); } catch (e) { throw Object.assign(new Error(e.message || 'Network error'), { network: true }); }
      const { data, error } = res;
      if (error) {
        const e = new Error(error.message || 'Request failed');
        if (error.code === '28000' || error.status === 401 || /JWT|not signed in|auth/i.test(error.message || '')) e.auth = true;
        if (/fetch|network|Failed to fetch|timeout/i.test(error.message || '') || error.status === 0) e.network = true;
        throw e;
      }
      return data;
    },
    subscribe(onChange) {
      // Realtime is only a hint that something changed; the pull itself goes through mahi_pull (RLS applies).
      const ch = supabase.channel('mahi-v2-' + userId);
      TABLES_V2.forEach((t) => ch.on('postgres_changes', { event: '*', schema: 'public', table: 'mahi_' + t, filter: `user_id=eq.${userId}` }, () => onChange(t)));
      ch.subscribe();
      return () => { supabase.removeChannel(ch); };
    },
  };
}
