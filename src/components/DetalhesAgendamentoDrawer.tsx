import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  MapPin,
  Building,
  User,
  Truck,
  CheckCircle,
  AlertCircle,
  FileCheck,
  Zap,
  CheckSquare,
  ShieldCheck,
  ExternalLink,
  Edit2,
  Trash2,
  ArrowRight,
  Battery,
  Share2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';
import { formatDateBR, formatDateTimeBR, getAgendamentoStatusConfig } from '../lib/formatters';
import type { Agendamento, VAgenda, PTA, Checklist, Colaborador } from '../types';
import { ChecklistRetiradaModal } from './ChecklistRetiradaModal';
import { ChecklistDevolucaoModal } from './ChecklistDevolucaoModal';

interface DetalhesAgendamentoDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  agendamentoId: string | null;
  onUpdated: () => void;
  onOpenEdit?: (agendamento: Agendamento) => void;
}

export const DetalhesAgendamentoDrawer: React.FC<DetalhesAgendamentoDrawerProps> = ({
  isOpen,
  onClose,
  agendamentoId,
  onUpdated,
  onOpenEdit,
}) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [agendamento, setAgendamento] = useState<Agendamento | null>(null);
  const [vAgendaItem, setVAgendaItem] = useState<VAgenda | null>(null);
  const [pta, setPta] = useState<PTA | null>(null);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);

  // Operational modals
  const [liberarDialogOpen, setLiberarDialogOpen] = useState(false);
  const [liberadoPor, setLiberadoPor] = useState('');
  const [retiradaModalOpen, setRetiradaModalOpen] = useState(false);
  const [devolucaoModalOpen, setDevolucaoModalOpen] = useState(false);
  const [sharePopupOpen, setSharePopupOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || !agendamentoId) return;

    loadDetails();
  }, [isOpen, agendamentoId]);

  async function loadDetails() {
    if (!agendamentoId) return;
    setLoading(true);
    try {
      // 1. Fetch raw agendamento
      const { data: rawData, error: rawError } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('id', agendamentoId)
        .single();

      if (rawError) throw rawError;
      setAgendamento(rawData);

      // 2. Fetch from v_agenda for resolved names
      const { data: vData } = await supabase
        .from('v_agenda')
        .select('*')
        .eq('id', agendamentoId)
        .maybeSingle();

      if (vData) setVAgendaItem(vData);

      // 3. Fetch PTA
      if (rawData?.pta_id) {
        const { data: ptaData } = await supabase
          .from('ptas')
          .select('*')
          .eq('id', rawData.pta_id)
          .single();
        if (ptaData) setPta(ptaData);
      }

      // 4. Fetch Checklists
      const { data: checkData } = await supabase
        .from('checklists')
        .select('*')
        .eq('agendamento_id', agendamentoId)
        .order('realizado_em', { ascending: true });

      if (checkData) setChecklists(checkData);

      // 5. Fetch Colaboradores
      const { data: colabs } = await supabase
        .from('colaboradores')
        .select('*')
        .eq('ativo', true)
        .eq('papel', 'liberador')
        .order('nome', { ascending: true });
      if (colabs) setColaboradores(colabs);
    } catch (err: any) {
      console.error('Erro ao carregar detalhes:', err);
      toast.error('Erro ao abrir agendamento', err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleLiberarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agendamento) return;
    if (!liberadoPor) {
      toast.warning('Selecione o Liberador', 'Informe quem está autorizando a saída da PTA.');
      return;
    }

    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({
          status: 'liberado',
          liberado_por: liberadoPor,
          liberado_em: new Date().toISOString(),
        })
        .eq('id', agendamento.id);

      if (error) throw error;

      toast.success('PTA Liberada', 'A plataforma já está pronta para retirada pelo operador.');
      setLiberarDialogOpen(false);
      loadDetails();
      onUpdated();
    } catch (err: any) {
      toast.error('Falha ao liberar', err.message);
    }
  };

  const handleDeletarAgendamento = async () => {
    if (!agendamento) return;
    if (!window.confirm('⚠️ Isso vai apagar o agendamento permanentemente do banco de dados. Não tem como desfazer. Confirma?')) return;
    try {
      // Apagar checklists vinculados primeiro
      await supabase.from('checklists').delete().eq('agendamento_id', agendamento.id);
      // Apagar o agendamento
      const { error } = await supabase.from('agendamentos').delete().eq('id', agendamento.id);
      if (error) throw error;
      toast.success('Deletado', 'Agendamento removido permanentemente.');
      onClose();
      onUpdated();
    } catch (err: any) {
      toast.error('Erro ao deletar', err.message || 'Não foi possível remover o agendamento.');
    }
  };

  const handleCancelarAgendamento = async () => {
    if (!agendamento) return;
    if (!window.confirm('Tem certeza que deseja cancelar este agendamento?')) return;

    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ status: 'cancelado' })
        .eq('id', agendamento.id);

      if (error) throw error;

      // Free PTA if it was locked
      if (pta && pta.status === 'em_uso') {
        await supabase.from('ptas').update({ status: 'disponivel' }).eq('id', pta.id);
      }

      toast.info('Agendamento Cancelado', 'A reserva foi desativada.');
      loadDetails();
      onUpdated();
    } catch (err: any) {
      toast.error('Erro ao cancelar', err.message);
    }
  };

  if (!isOpen) return null;

  const statusConfig = agendamento ? getAgendamentoStatusConfig(agendamento.status) : null;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end transition-opacity">
        <div className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-gray-200">
          {/* Header */}
          <div className="p-5 border-b border-gray-200 bg-gray-50 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Agendamento #{agendamento?.id.substring(0, 8)}
                </span>
                {agendamento?.prioridade === 'prioritario' && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#F5D800] text-[#1B2A4A] border border-amber-300">
                    ★ PRIORITÁRIO
                  </span>
                )}
                {agendamento?.origem === 'recorrente' && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                    Recorrente
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-[#1A1A1A]">
                {vAgendaItem?.pta_patrimonio || vAgendaItem?.patrimonio || pta?.patrimonio || 'PTA'} —{' '}
                {vAgendaItem?.pta_modelo || pta?.modelo || 'Plataforma'}
              </h2>
              <div className="text-xs text-gray-500 mt-0.5">
                Tipo: <strong className="capitalize">{pta?.tipo || vAgendaItem?.pta_tipo || 'PTA'}</strong> • Fabricante: {pta?.fabricante || 'AmBev'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {statusConfig && (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${statusConfig.bg}`}
                >
                  <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
                  {statusConfig.label}
                </span>
              )}
              {agendamento && (
                <button
                  onClick={() => setSharePopupOpen(true)}
                  title="Compartilhar com solicitante"
                  className="p-1.5 text-emerald-700 hover:text-white bg-emerald-50 hover:bg-emerald-600 rounded-md transition-colors flex items-center gap-1 px-2"
                >
                  <Share2 className="w-4 h-4" />
                  <span className="text-xs font-semibold hidden sm:inline">Compartilhar</span>
                </button>
              )}
              {onOpenEdit &&
                agendamento &&
                agendamento.status !== 'concluido' &&
                agendamento.status !== 'cancelado' && (
                  <button
                    onClick={() => { onOpenEdit(agendamento); onClose(); }}
                    title="Editar agendamento"
                    className="p-1.5 text-[#1B2A4A] hover:text-white bg-gray-100 hover:bg-[#1B2A4A] rounded-md transition-colors flex items-center gap-1 px-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span className="text-xs font-semibold hidden sm:inline">Editar</span>
                  </button>
                )}
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {loading ? (
              <div className="py-12 text-center text-gray-500 flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-[#F5D800] border-t-transparent rounded-full animate-spin" />
                <span>Carregando detalhes do agendamento...</span>
              </div>
            ) : agendamento ? (
              <>
                {/* Operational Flow Status Bar */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                    Fluxo Operacional de Liberação & Uso
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {/* 1. Agendado */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          ['agendado', 'liberado', 'retirado', 'em_uso', 'concluido'].includes(
                            agendamento.status
                          )
                            ? 'bg-[#F5D800] text-black ring-2 ring-amber-300'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        1
                      </div>
                      <span className="text-[11px] font-semibold mt-1 text-gray-800">Agendado</span>
                    </div>

                    {/* 2. Liberado */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          ['liberado', 'retirado', 'em_uso', 'concluido'].includes(agendamento.status)
                            ? 'bg-[#F5D800] text-black ring-2 ring-amber-300'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        2
                      </div>
                      <span className="text-[11px] font-semibold mt-1 text-gray-800">Liberado</span>
                    </div>

                    {/* 3. Retirado / Em uso */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          ['retirado', 'em_uso', 'concluido'].includes(agendamento.status)
                            ? 'bg-[#F5D800] text-black ring-2 ring-amber-300'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        3
                      </div>
                      <span className="text-[11px] font-semibold mt-1 text-gray-800">Retirado</span>
                    </div>

                    {/* 4. Concluído */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          agendamento.status === 'concluido'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        4
                      </div>
                      <span className="text-[11px] font-semibold mt-1 text-gray-800">Concluído</span>
                    </div>
                  </div>
                </div>

                {/* Primary Action Buttons Bar */}
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                  <div className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                    Ação Operacional Requerida
                  </div>

                  {agendamento.status === 'agendado' && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-700">
                        A plataforma está agendada. Facilities precisa autorizar e liberar a saída.
                      </p>
                      <button
                        type="button"
                        onClick={() => setLiberarDialogOpen(true)}
                        className="w-full py-2.5 px-4 bg-[#1B2A4A] hover:bg-[#152238] text-white font-bold text-sm rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
                      >
                        <ShieldCheck className="w-4 h-4 text-[#F5D800]" />
                        <span>Liberar PTA para Retirada</span>
                      </button>
                    </div>
                  )}

                  {agendamento.status === 'liberado' && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-700">
                        PTA liberada por Facilities. Realize o checklist de retirada com o operador.
                      </p>
                      <button
                        type="button"
                        onClick={() => setRetiradaModalOpen(true)}
                        className="w-full py-2.5 px-4 bg-[#1B2A4A] hover:bg-[#152238] text-white font-bold text-sm rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckSquare className="w-4 h-4 text-[#F5D800]" />
                        <span>Abrir Checklist de Retirada</span>
                      </button>
                    </div>
                  )}

                  {(agendamento.status === 'retirado' || agendamento.status === 'em_uso') && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-700">
                        Equipamento em operação na fábrica. Ao finalizar, realize a devolução com os 3 checks de SLA.
                      </p>
                      <button
                        type="button"
                        onClick={() => setDevolucaoModalOpen(true)}
                        className="w-full py-2.5 px-4 bg-[#1B2A4A] hover:bg-[#152238] text-white font-bold text-sm rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
                      >
                        <FileCheck className="w-4 h-4 text-[#F5D800]" />
                        <span>Devolver / Concluir (Checklist + SLA)</span>
                      </button>
                    </div>
                  )}

                  {agendamento.status === 'concluido' && (
                    <div className="text-xs text-emerald-800 font-medium flex items-center gap-2 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Agendamento finalizado em {formatDateTimeBR(agendamento.devolvido_em)}. PTA devolvida e liberada.
                      </span>
                    </div>
                  )}

                  {agendamento.status === 'cancelado' && (
                    <div className="text-xs text-gray-600 font-medium bg-gray-100 p-2.5 rounded-lg border border-gray-200">
                      Este agendamento foi cancelado e não ocupa mais a PTA.
                    </div>
                  )}
                </div>

                {/* Audit SLA Results (if completed) */}
                {agendamento.status === 'concluido' && (
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-2.5">
                    <div className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center justify-between">
                      <span>Resultado da Auditoria de SLA</span>
                      <span className="text-[11px] text-gray-500">
                        {agendamento.devolvido_em ? formatDateBR(agendamento.devolvido_em) : '-'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 bg-gray-50 rounded-lg border">
                        <span className="block text-[10px] text-gray-500">No Prazo</span>
                        <span
                          className={`font-bold ${
                            agendamento.entregou_no_prazo ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {agendamento.entregou_no_prazo ? '✓ Sim' : '✗ Não'}
                        </span>
                      </div>
                      <div className="p-2 bg-gray-50 rounded-lg border">
                        <span className="block text-[10px] text-gray-500">Local Combinado</span>
                        <span
                          className={`font-bold ${
                            agendamento.entregou_local_combinado ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {agendamento.entregou_local_combinado ? '✓ Sim' : '✗ Não'}
                        </span>
                      </div>
                      <div className="p-2 bg-gray-50 rounded-lg border">
                        <span className="block text-[10px] text-gray-500">Carregamento</span>
                        <span
                          className={`font-bold ${
                            agendamento.posicionou_carregamento ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {agendamento.posicionou_carregamento ? '✓ Sim' : '✗ Não'}
                        </span>
                      </div>
                    </div>
                    {agendamento.obs_sla && (
                      <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded italic">
                        "{agendamento.obs_sla}"
                      </p>
                    )}
                  </div>
                )}

                {/* Primary Data Grid */}
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 shadow-xs text-sm">
                  {/* Atividade */}
                  <div className="p-3.5 flex items-start gap-3">
                    <FileCheck className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-gray-500">Tipo de Atividade</div>
                      <div className="font-bold text-gray-900">{agendamento.tipo_atividade}</div>
                      {agendamento.descricao && (
                        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                          {agendamento.descricao}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Periodo */}
                  <div className="p-3.5 flex items-start gap-3">
                    <Clock className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-gray-500">Período Reservado</div>
                      <div className="font-semibold text-gray-900">
                        {formatDateBR(agendamento.data_inicio)} até {formatDateBR(agendamento.data_fim)}
                        <span className="ml-2 text-xs font-normal text-gray-500">
                          ({agendamento.duracao_dias || 1} dia(s))
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Local */}
                  <div className="p-3.5 flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-gray-500">Local na Cervejaria</div>
                      <div className="font-semibold text-gray-900">
                        {vAgendaItem?.local_descricao || vAgendaItem?.ug || 'Não informado'}{vAgendaItem?.setor_linha ? ` — ${vAgendaItem.setor_linha}` : ''}
                      </div>

                    </div>
                  </div>

                  {/* Area & Solicitante */}
                  <div className="p-3.5 flex items-start gap-3">
                    <Building className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-gray-500">Área / Empresa</div>
                      <div className="font-semibold text-gray-900">
                        {vAgendaItem?.area_nome || vAgendaItem?.nome_area || 'Área Solicitante'}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
                        <User className="w-3 h-3 text-gray-400" />
                        <span>
                          Solicitante:{' '}
                          <strong>
                            {vAgendaItem?.solicitante_nome || vAgendaItem?.nome_solicitante || '-'}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Liberador e Retirador */}
                  {(agendamento.liberado_por || agendamento.retirado_por) && (
                    <div className="p-3.5 grid grid-cols-2 gap-2 text-xs">
                      {agendamento.liberado_por && (
                        <div>
                          <span className="text-gray-500 block">Liberado por:</span>
                          <span className="font-semibold text-gray-900">
                            {vAgendaItem?.liberador_nome || 'Facilities'}
                          </span>
                          <span className="text-[10px] text-gray-400 block">
                            {formatDateTimeBR(agendamento.liberado_em)}
                          </span>
                        </div>
                      )}
                      {agendamento.retirado_por && (
                        <div>
                          <span className="text-gray-500 block">Retirado por:</span>
                          <span className="font-semibold text-gray-900">
                            {vAgendaItem?.retirador_nome || 'Operador'}
                          </span>
                          <span className="text-[10px] text-gray-400 block">
                            {formatDateTimeBR(agendamento.retirado_em)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Vistorias / Checklists Realizados */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Histórico de Checklists Realizados ({checklists.length})</span>
                  </div>

                  {checklists.length === 0 ? (
                    <p className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-lg border border-dashed text-center">
                      Nenhum checklist registrado ainda para este agendamento.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {checklists.map((chk) => (
                        <div
                          key={chk.id}
                          className="bg-white p-3 rounded-lg border border-gray-200 shadow-xs text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-gray-900 uppercase">
                              {chk.tipo === 'retirada' ? 'Checklist de Retirada' : 'Checklist de Devolução'}
                            </span>
                            <span className="text-gray-400 text-[11px]">
                              {formatDateTimeBR(chk.realizado_em)}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1 font-medium text-gray-700">
                              <Battery className="w-3.5 h-3.5 text-emerald-600" />
                              Bateria: {chk.nivel_bateria}%
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                                chk.estado_geral === 'ok'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : chk.estado_geral === 'com_ressalvas'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              Estado: {chk.estado_geral}
                            </span>
                          </div>

                          {chk.avarias_visiveis && (
                            <p className="text-gray-600 bg-gray-50 p-1.5 rounded">
                              <strong>Ressalvas:</strong> {chk.avarias_visiveis}
                            </p>
                          )}

                          {chk.fotos && chk.fotos.length > 0 && (
                            <div className="flex gap-2 mt-1">
                              {chk.fotos.map((url, i) => (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block w-12 h-12 rounded border border-gray-300 overflow-hidden hover:opacity-80"
                                >
                                  <img
                                    src={url}
                                    alt="Foto Checklist"
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Secondary Actions (Edit / Cancel / Delete) */}
                <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {agendamento.status !== 'concluido' && agendamento.status !== 'cancelado' && (
                      <button
                        type="button"
                        onClick={handleCancelarAgendamento}
                        className="text-xs text-amber-600 hover:text-amber-800 font-semibold flex items-center gap-1 hover:underline"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Cancelar</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleDeletarAgendamento}
                      className="text-xs text-rose-600 hover:text-white hover:bg-rose-600 font-semibold flex items-center gap-1 border border-rose-200 hover:border-rose-600 px-2 py-1 rounded-md transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Deletar permanente</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {onOpenEdit &&
                      agendamento.status !== 'concluido' &&
                      agendamento.status !== 'cancelado' && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenEdit(agendamento);
                            onClose();
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Editar Agendamento</span>
                        </button>
                      )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Popup Compartilhar com Solicitante */}
      {sharePopupOpen && agendamento && (() => {
        const patr = vAgendaItem?.pta_patrimonio || vAgendaItem?.patrimonio || pta?.patrimonio || 'PTA';
        const tipoPta = (pta?.tipo || vAgendaItem?.pta_tipo) === 'articulada' ? 'Articulada' : 'Tesourinha';
        const solNome = vAgendaItem?.solicitante_nome || vAgendaItem?.nome_solicitante || 'Solicitante';
        const solObj = colaboradores.find((c) => c.id === agendamento.solicitante_id);
        const solContato = solObj?.contato || '';
        const dtRet = formatDateBR(agendamento.data_inicio);
        const dtEnt = formatDateBR(agendamento.data_fim);
        const msgTexto = `Olá, ${solNome}! Seu agendamento da PTA ${patr} (${tipoPta}) foi confirmado pelo Facilities. ✅\n\n📅 Retirada: ${dtRet}\n📅 Devolução: ${dtEnt}\n\nPara que tudo corra bem, siga as instruções abaixo:\n\n1️⃣ ANTES DE RETIRAR: faça o Check de Extrato da PTA — confira nível de bateria, avarias visíveis e o funcionamento dos controles.\n\n2️⃣ RETIRADA: desconecte do carregador com cuidado e transite somente por locais autorizados.\n\n3️⃣ DURANTE O USO: utilize apenas no local combinado. Qualquer avaria ou problema técnico, avise o Facilities IMEDIATAMENTE.\n\n4️⃣ NA DEVOLUÇÃO: faça um novo Check de Extrato e entregue a PTA limpa e sem danos no local de origem.\n\n5️⃣ CARREGAMENTO: logo após devolver, conecte a PTA no MESMO carregador que estava sendo usado.\n\n6️⃣ SE FICAR PARA O DIA SEGUINTE: deixe a plataforma carregando no local onde ela ficará, antes de encerrar o turno.\n\n🚫 IMPORTANTE: em hipótese alguma a PTA pode deixar de ser devolvida no mesmo dia, salvo quando previamente alinhado com o Facilities.\n\n⚠️ Nunca deixe a PTA descarregada ou sem supervisão fora da área designada.\n\nQualquer dúvida, é só chamar o Facilities. Bom trabalho! 👷`;
        const msgWpp = encodeURIComponent(msgTexto);
        const tel = solContato.replace(/\D/g, '');
        const wppUrl = tel ? `https://wa.me/55${tel}?text=${msgWpp}` : `https://wa.me/?text=${msgWpp}`;
        const mailUrl = `mailto:?subject=${encodeURIComponent(`Agendamento PTA ${patr} — Retirada em ${dtRet}`)}&body=${encodeURIComponent(msgTexto)}`;
        return (
          <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden">
              <div className="bg-[#1B2A4A] px-5 py-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm">Compartilhar Agendamento</h3>
                  <p className="text-blue-200 text-[11px] mt-0.5">Para: {solNome}</p>
                </div>
                <button onClick={() => setSharePopupOpen(false)} className="text-gray-300 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                  <p>Retirada: <strong>{dtRet}</strong> | Devolução: <strong>{dtEnt}</strong></p>
                  <p className="mt-1">Envie as instruções de uso, carregamento e devolução para o solicitante.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <a href={wppUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-bold text-sm rounded-lg transition-colors">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.374 0 0 5.373 0 12c0 2.112.549 4.094 1.508 5.814L0 24l6.336-1.482A11.945 11.945 0 0012 24c6.626 0 12-5.373 12-12S18.626 0 12 0zm0 21.818a9.818 9.818 0 01-5.006-1.37l-.36-.214-3.724.977.994-3.63-.235-.374A9.818 9.818 0 1112 21.818z"/></svg>
                    WhatsApp
                  </a>
                  <a href={mailUrl}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-[#1B2A4A] hover:bg-[#152238] text-white font-bold text-sm rounded-lg transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    E-mail
                  </a>
                </div>
                {!solContato && (
                  <p className="text-[11px] text-amber-600">O solicitante não tem contato cadastrado — o WhatsApp abrirá sem número, mas você pode escolher o contato manualmente.</p>
                )}
                <button onClick={() => setSharePopupOpen(false)}
                  className="w-full py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Dialog to Liberar */}
      {liberarDialogOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 border border-gray-200">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
              Autorização de Liberação de PTA
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Selecione o técnico ou líder de Facilities responsável por liberar o equipamento.
            </p>

            <form onSubmit={handleLiberarSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Liberado por (Colaborador Facilities) *
                </label>
                <select
                  value={liberadoPor}
                  onChange={(e) => setLiberadoPor(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#1B2A4A]"
                >
                  <option value="">Selecione o liberador...</option>
                  {colaboradores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLiberarDialogOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#1B2A4A] hover:bg-[#152238] rounded-lg shadow-xs transition-colors"
                >
                  Confirmar Liberação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Retirada Modal */}
      {agendamento && (
        <ChecklistRetiradaModal
          isOpen={retiradaModalOpen}
          onClose={() => setRetiradaModalOpen(false)}
          onSuccess={() => {
            loadDetails();
            onUpdated();
          }}
          agendamento={agendamento}
          pta={pta}
        />
      )}

      {/* Devolucao Modal */}
      {agendamento && (
        <ChecklistDevolucaoModal
          isOpen={devolucaoModalOpen}
          onClose={() => setDevolucaoModalOpen(false)}
          onSuccess={() => {
            loadDetails();
            onUpdated();
          }}
          agendamento={agendamento}
          pta={pta}
        />
      )}
    </>
  );
};
