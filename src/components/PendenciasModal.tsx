import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDateBR, getAgendamentoStatusConfig } from '../lib/formatters';
import type { VAgenda, StatusAgendamento } from '../types';

interface PendenciasModalProps {
  isOpen: boolean;
  /** Incrementar para forçar nova busca de pendências */
  refreshTrigger?: number;
  /** Chamado quando todas as pendências foram resolvidas */
  onAllResolved: () => void;
  /** Chamado quando o usuário fecha o modal sem resolver */
  onClose: () => void;
  /** Chamado quando o usuário clica em um botão de ação de uma pendência */
  onOpenAgendamento: (agendamentoId: string) => void;
}

function getTodayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getLabelBotao(status: StatusAgendamento): string {
  switch (status) {
    case 'agendado': return 'Liberar para Retirada';
    case 'liberado': return 'Registrar Retirada';
    case 'retirado': return 'Registrar Devolução';
    default: return 'Resolver';
  }
}

export const PendenciasModal: React.FC<PendenciasModalProps> = ({
  isOpen,
  refreshTrigger = 0,
  onAllResolved,
  onClose,
  onOpenAgendamento,
}) => {
  const [pendencias, setPendencias] = useState<VAgenda[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPendencias = async () => {
    setLoading(true);
    const today = getTodayISO();
    const { data, error } = await supabase
      .from('v_agenda')
      .select('*')
      .lt('data_fim', today)
      .not('status', 'in', '("concluido","cancelado")')
      .order('data_fim', { ascending: true });

    if (!error && data) {
      setPendencias(data as VAgenda[]);
      if (data.length === 0) {
        onAllResolved();
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchPendencias();
    }
  }, [isOpen, refreshTrigger]);

  if (!isOpen) return null;

  const statusColors: Record<string, string> = {
    agendado: 'bg-blue-100 text-blue-800 border-blue-300',
    liberado: 'bg-amber-100 text-amber-800 border-amber-300',
    retirado: 'bg-orange-100 text-orange-800 border-orange-300',
  };

  const statusLabels: Record<string, string> = {
    agendado: 'Aguardando Liberação',
    liberado: 'Aguardando Retirada',
    retirado: 'Aguardando Devolução',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay vermelho escuro */}
      <div className="absolute inset-0 bg-red-950/80 backdrop-blur-sm" />

      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header vermelho */}
        <div className="bg-red-700 px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-full p-2">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg leading-tight">
                  Sistema Travado — Pendências em Aberto
                </h2>
                <p className="text-red-200 text-sm mt-0.5">
                  Existem agendamentos com prazo vencido que precisam ser resolvidos antes de criar um novo.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="mt-0.5 text-white/60 hover:text-white transition-colors p-1 rounded"
              title="Fechar"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-3 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Verificando pendências...</span>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                <span className="font-bold text-red-700">{pendencias.length} pendência{pendencias.length !== 1 ? 's' : ''}</span> encontrada{pendencias.length !== 1 ? 's' : ''}.
                Resolva cada uma seguindo o fluxo correto ou cancele o agendamento.
              </p>

              <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                {pendencias.map((p) => {
                  const status = p.status as StatusAgendamento;
                  const statusClass = statusColors[status] || 'bg-gray-100 text-gray-800 border-gray-300';
                  const statusLabel = statusLabels[status] || status;
                  const ptaLabel = p.patrimonio || p.pta_patrimonio || '—';
                  const areaLabel = p.area_nome || p.nome_area || '—';
                  const localLabel = [p.ug, p.setor_linha].filter(Boolean).join(' · ') || '—';
                  const dataFimFmt = formatDateBR(p.data_fim);
                  const dataInicFmt = formatDateBR(p.data_inicio);

                  return (
                    <div
                      key={p.id}
                      className="border-2 border-red-200 rounded-xl bg-red-50 overflow-hidden cursor-pointer hover:border-red-400 hover:shadow-md transition-all"
                      onClick={() => onOpenAgendamento(p.id)}
                      title="Clique para abrir o agendamento"
                    >
                      {/* Status badge + patrimônio */}
                      <div className="bg-red-100 px-4 py-2.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-red-800 text-sm">PTA {ptaLabel}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider border rounded px-1.5 py-0.5 ${statusClass}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <span className="text-[11px] text-red-600 font-mono font-bold">
                          Venceu em {dataFimFmt}
                        </span>
                      </div>

                      <div className="px-4 py-3 grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs text-gray-700">
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Empresa / Área</p>
                          <p className="font-semibold">{areaLabel}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Local (UG)</p>
                          <p className="font-semibold">{localLabel}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Período</p>
                          <p className="font-semibold">{dataInicFmt} → {dataFimFmt}</p>
                        </div>
                      </div>

                      {/* Botões de ação */}
                      <div className="px-4 pb-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onOpenAgendamento(p.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold transition-colors"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          {getLabelBotao(status)}
                        </button>
                        <button
                          onClick={() => onOpenAgendamento(p.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-xs font-semibold transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5 text-gray-500" />
                          Cancelar Agendamento
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mt-4 text-[11px] text-gray-400 text-center">
                Clique em qualquer botão acima para abrir o agendamento e executar a ação. O sistema liberará automaticamente após todas as pendências serem resolvidas.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
