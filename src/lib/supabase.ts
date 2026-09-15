import { createClient } from '@supabase/supabase-js';
import type { Agendamento } from '../types';

const env = (import.meta as any).env || {};

const SUPABASE_URL =
  env.VITE_SUPABASE_URL ||
  'https://wvwaovszodixsvvhvnpt.supabase.co';

const SUPABASE_ANON_KEY =
  env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2d2FvdnN6b2RpeHN2dmh2bnB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0MTEwNzMsImV4cCI6MjEwNDk4NzA3M30.xZdZJQ6S_dXc06hfaB9NPX5fx_tcWy74l8ukua1ZA7k';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

/**
 * Upload an image to the public 'ptas' bucket and return its public URL
 */
export async function uploadPtaPhoto(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
  const filePath = `uploads/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('ptas')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    console.error('Erro no upload de foto:', uploadError);
    throw new Error(`Falha ao fazer upload da imagem: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from('ptas').getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Checks for date overlaps for a specific PTA in agendamentos
 * Active statuses that occupy the PTA: agendado, liberado, retirado, em_uso
 */
export async function checkPtaConflict(
  ptaId: string,
  dataInicio: string,
  dataFim: string,
  excludeAgendamentoId?: string
): Promise<{ hasConflict: boolean; conflictingAgendamentos: Agendamento[] }> {
  try {
    let query = supabase
      .from('agendamentos')
      .select('*')
      .eq('pta_id', ptaId)
      .neq('status', 'cancelado')
      .neq('status', 'concluido')
      // Interval overlap condition: (data_inicio <= dataFim) AND (data_fim >= dataInicio)
      .lte('data_inicio', dataFim)
      .gte('data_fim', dataInicio);

    if (excludeAgendamentoId) {
      query = query.neq('id', excludeAgendamentoId);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('Aviso na verificação prévia de conflito:', error.message);
      return { hasConflict: false, conflictingAgendamentos: [] };
    }

    const conflicts = (data as Agendamento[]) || [];
    return {
      hasConflict: conflicts.length > 0,
      conflictingAgendamentos: conflicts,
    };
  } catch (err) {
    console.warn('Falha na verificação de conflito:', err);
    return { hasConflict: false, conflictingAgendamentos: [] };
  }
}

/**
 * Format standard database / Postgres error messages for UI
 */
export function formatSupabaseError(error: any): string {
  if (!error) return 'Ocorreu um erro desconhecido.';

  // Exclusion violation error code 23P01 or overlapping constraint
  if (
    error.code === '23P01' ||
    (error.message && error.message.toLowerCase().includes('exclusion')) ||
    (error.message && error.message.toLowerCase().includes('sobrepos')) ||
    (error.details && error.details.toLowerCase().includes('exclusion'))
  ) {
    return 'Esta PTA já está reservada nesse período. Escolha outra data ou outra plataforma.';
  }

  return error.message || 'Erro ao comunicar com o servidor Supabase.';
}

/**
 * Calls RPC to generate recurring schedule bookings
 */
export async function chamarGerarAgendamentosRecorrentes(
  pInicio: string,
  pFim: string
): Promise<{ count?: number; error?: any }> {
  const { data, error } = await supabase.rpc('gerar_agendamentos_recorrentes', {
    p_inicio: pInicio,
    p_fim: pFim,
  });

  if (error) {
    return { error };
  }

  // data can be an integer or object depending on function return
  let count = 0;
  if (typeof data === 'number') {
    count = data;
  } else if (data && typeof data.count === 'number') {
    count = data.count;
  } else if (Array.isArray(data)) {
    count = data.length;
  } else if (data) {
    count = Number(data) || 0;
  }

  return { count };
}
