import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, XCircle, Loader2, Trash2, CheckSquare, Square } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDateBR } from '../lib/formatters';
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fetchPendencias = async () => {
    setLoading(true);
    const today = getTodayISO();
    const { data, error } = await supabase
      .from('v_agenda')
      .select('*')
      .lt('data_fim', today)
      .not('status', 'in', `(concluido,cancelado)`)
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
      setSelectedIds(new Set());
      setConfirmDelete(false);
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

  const allSelected = pendencias.length > 0 && selectedIds.size === pendencias.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendencias.map((p) => p.id)));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelecionadas = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    setConfirmDelete(false);
    try {
      const ids = Array.from(selectedIds);
      // Deletar checklists vinculados primeiro
      await supabase.from('checklists').delete().in('agendamento_id', ids);
      // Deletar agendamentos
      const { error } = await supabase.from('agendamentos').delete().in('id', ids);
      if (error) {
        alert('Erro ao deletar: ' + error.message);
      } else {
        setSelectedIds(new Set());
        await fetchPendencias();
      }
    } finally {
      setDeleting(false);
    }
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
              {/* Barra de ações em massa */}
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-600">
                    <span className="font-bold text-red-700">{pendencias.length} pendência{pendencias.length !== 1 ? 's' : ''}</span>
                    {selectedIds.size > 0 && (
                      <span className="ml-2 text-gray-500">· {selectedIds.size} selecionada{selectedIds.size !== 1 ? 's' : ''}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Botão Selecionar Todas */}
                  <button
                    onClick={toggleSelectAll}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold transition-colors"
                  >
                    {allSelected ? (
                      <CheckSquare className="w-3.5 h-3.5 text-red-600" />
                    ) : someSelected ? (
                      <CheckSquare className="w-3.5 h-3.5 text-gray-400" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-gray-400" />
                    )}
                    {allSelected ? 'Desmarcar todas' : 'Selecionar todas'}
                  </button>

                  {/* Botão Deletar Selecionadas */}
                  {selectedIds.size > 0 && (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      disabled={deleting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold transition-colors disabled:opacity-60"
                    >
                      {deleting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      Deletar selecionadas ({selectedIds.size})
                    </button>
                  )}
                </div>
              </div>

              {/* Dialog de confirmação de exclusão */}
              {confirmDelete && (
                <div className="mb-4 bg-red-50 border-2 border-red-300 rounded-xl p-4">
                  <p className="text-sm font-bold text-red-800 mb-1">
                    ⚠️ Confirmar exclusão permanente
                  </p>
                  <p className="text-xs text-red-700 mb-3">
                    Você está prestes a deletar permanentemente <strong>{selectedIds.size} agendamento{selectedIds.size !== 1 ? 's' : ''}</strong> e seus checklists vinculados. Esta ação não pode ser desfeita.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteSelecionadas}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Sim, deletar
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {pendencias.map((p) => {
                  const status = p.status as StatusAgendamento;
                  const statusClass = statusColors[status] || 'bg-gray-100 text-gray-800 border-gray-300';
                  const statusLabel = statusLabels[status] || status;
                  const ptaLabel = p.patrimonio || p.pta_patrimonio || '—';
                  const areaLabel = p.area_nome || p.nome_area || '—';
                  const localLabel = p.ug || '—';
                  const solicitanteLabel = p.solicitante || p.solicitante_nome || p.nome_solicitante || '—';
                  const agendadorLabel = p.liberador_nome || p.agendado_nome || '—';
                  const dataFimFmt = formatDateBR(p.data_fim);
                  const dataInicFmt = formatDateBR(p.data_inicio);
                  const isSelected = selectedIds.has(p.id);

                  return (
                    <div
                      key={p.id}
                      className={`border rounded-lg overflow-hidden transition-all ${
                        isSelected
                          ? 'border-red-500 bg-red-50 shadow ring-1 ring-red-300'
                          : 'border-red-200 bg-red-50 hover:border-red-400 hover:shadow cursor-pointer'
                      }`}
                      onClick={() => onOpenAgendamento(p.id)}
                      title="Clique para abrir o agendamento"
                    >
                      {/* Linha única: checkbox + PTA + badge + vencimento */}
                      <div className="bg-red-100 px-3 py-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <button
                            onClick={(e) => toggleSelect(p.id, e)}
                            className="flex-shrink-0 hover:scale-110 transition-transform"
                            title={isSelected ? 'Desmarcar' : 'Selecionar'}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-red-700" />
                            ) : (
                              <Square className="w-4 h-4 text-red-400" />
                            )}
                          </button>
                          <span className="font-bold text-red-800 text-xs">PTA {ptaLabel}</span>
                          <span className={`text-[9px] font-bold uppercase tracking-wider border rounded px-1 py-0.5 flex-shrink-0 ${statusClass}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <span className="text-[10px] text-red-600 font-mono font-bold flex-shrink-0">
                          Venceu {dataFimFmt}
                        </span>
                      </div>

                      {/* Dados em linha única compacta */}
                      <div className="px-3 py-1.5 flex items-center gap-3 text-[11px] text-gray-700 flex-wrap">
                        <span><span className="text-gray-400">Empresa:</span> <span className="font-semibold">{areaLabel}</span></span>
                        <span className="text-gray-300">·</span>
                        <span><span className="text-gray-400">UG:</span> <span className="font-semibold">{localLabel}</span></span>
                        <span className="text-gray-300">·</span>
                        <span><span className="text-gray-400">Período:</span> <span className="font-semibold">{dataInicFmt}→{dataFimFmt}</span></span>
                        <span className="text-gray-300">·</span>
                        <span><span className="text-gray-400">Solicitante:</span> <span className="font-semibold">{solicitanteLabel}</span></span>
                        <span className="text-gray-300">·</span>
                        <span><span className="text-gray-400">Agendado por:</span> <span className="font-semibold">{agendadorLabel}</span></span>
                      </div>

                      {/* Botões de ação */}
                      <div className="px-3 pb-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onOpenAgendamento(p.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-700 hover:bg-red-800 text-white text-[11px] font-bold transition-colors"
                        >
                          <ArrowRight className="w-3 h-3" />
                          {getLabelBotao(status)}
                        </button>
                        <button
                          onClick={() => onOpenAgendamento(p.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-gray-50 border border-gray-300 text-gray-600 text-[11px] font-semibold transition-colors"
                        >
                          <XCircle className="w-3 h-3 text-gray-400" />
                          Cancelar
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
