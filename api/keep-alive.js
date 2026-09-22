// Vercel Cron — mantém o projeto Supabase ativo (insere e apaga sozinho)
// Roda na infra da Vercel, independente do estado do Supabase.

const SUPABASE_URL = 'https://wvwaovszodixsvvhvnpt.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2d2FvdnN6b2RpeHN2dmh2bnB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0MTEwNzMsImV4cCI6MjEwNDk4NzA3M30.xZdZJQ6S_dXc06hfaB9NPX5fx_tcWy74l8ukua1ZA7k';

export default async function handler(req, res) {
  const headers = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    // 1. INSERE um registro de ping
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/_keep_alive`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ nota: 'ping vercel cron' }),
    });

    // 2. APAGA registros com mais de 30 dias (mantém a tabela limpa)
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const del = await fetch(
      `${SUPABASE_URL}/rest/v1/_keep_alive?ping_at=lt.${encodeURIComponent(cutoff)}`,
      { method: 'DELETE', headers }
    );

    return res.status(200).json({
      ok: true,
      inserted: ins.status,
      deleted: del.status,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
