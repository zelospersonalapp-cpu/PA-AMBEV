import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  ArrowRight,
  PlusCircle,
  Repeat,
  ShieldCheck,
  TrendingUp,
  AlertOctagon,
  BatteryCharging,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { PTA, VAgenda, Agendamento } from '../types';
import { formatDateBR, getAgendamentoStatusConfig, getPtaStatusConfig } from '../lib/formatters';
import { DetalhesAgendamentoDrawer } from '../components/DetalhesAgendamentoDrawer';
import { AgendamentoModal } from '../components/AgendamentoModal';

export const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);

  // KPIs
  const [ptas, setPtas] = useState<PTA[]>([]);
  const [agendamentosHoje, setAgendamentosHoje] = useState<number>(0);
  const [agendamentosSemana, setAgendamentosSemana] = useState<number>(0);
  const [avariasAbertas, setAvariasAbertas] = useState<number>(0);

  // Lists
  const [proximasAtividades, setProximasAtividades] = useState<VAgenda[]>([]);

  // Drawers / Modals
  const [selectedAgendamentoId, setSelectedAgendamentoId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [novoModalOpen, setNovoModalOpen] = useState(false);
  const [editingAgendamento, setEditingAgendamento] = useState<Agendamento | null>(null);

  useEffect(() => {
    loadDashboardData();

    const handleUpdate = () => {
      loadDashboardData();
    };
    window.addEventListener('agendamento-updated', handleUpdate);
    return () => window.removeEventListener('agendamento-updated', handleUpdate);
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().substring(0, 10);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextWeekStr = nextWeek.toISOString().substring(0, 10);

      // 1. Fetch PTAs for status counts
      const { data: ptasData } = await supabase.from('ptas').select('*');
      if (ptasData) {
        setPtas(ptasData);
      }

      // 2. Fetch Agendamentos de Hoje e da Semana
      const { data: agHoje } = await supabase
        .from('agendamentos')
        .select('id')
        .neq('status', 'cancelado')
        .lte('data_inicio', todayStr)
        .gte('data_fim', todayStr);

      setAgendamentosHoje(agHoje?.length || 0);

      const { data: agSemana } = await supabase
        .from('agendamentos')
        .select('id')
        .neq('status', 'cancelado')
        .gte('data_fim', todayStr)
        .lte('data_inicio', nextWeekStr);

      setAgendamentosSemana(agSemana?.length || 0);

      // 3. Fetch Avarias Abertas
      const { data: avariasData } = await supabase
        .from('avarias')
        .select('id')
        .neq('status', 'resolvida');

      setAvariasAbertas(avariasData?.length || 0);

      // 4. Fetch Confiabilidade View

      // 5. Fetch Próximas Atividades (7 dias de v_agenda)
      const { data: proxData } = await supabase
        .from('v_agenda')
        .select('*')
        .neq('status', 'cancelado')
        .gte('data_fim', todayStr)
        .lte('data_inicio', nextWeekStr)
        .order('data_inicio', { ascending: true })
        .limit(10);

      if (proxData) {
        setProximasAtividades(proxData);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  // PTA status counts
  const ptaDisponiveis = ptas.filter((p) => p.status === 'disponivel').length;
  const ptaEmUso = ptas.filter((p) => p.status === 'em_uso').length;
  const ptaManutencao = ptas.filter((p) => p.status === 'em_manutencao').length;
  const ptaAvariadas = ptas.filter((p) => p.status === 'avariada').length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#1A1A1A] flex items-center gap-2 leading-tight">
            Painel Geral de PTAs
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Visão geral do parque de plataformas e desempenho operacional.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => setNovoModalOpen(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs sm:text-sm rounded-lg shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4 text-white" />
            <span>Novo Agendamento</span>
          </button>
          <NavLink
            to="/agenda"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-800 font-semibold text-xs sm:text-sm rounded-lg border border-gray-300 transition-colors"
          >
            <Calendar className="w-4 h-4 text-gray-500" />
            <span>Ver Calendário</span>
          </NavLink>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: PTAs por Status */}
        <NavLink to="/ptas" className="tap-card bg-white rounded-xl border border-gray-200 border-l-4 border-l-[#F5D800] p-3 sm:p-4 shadow-xs flex flex-col justify-between no-underline">
          <div>
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400 leading-tight min-h-[2rem] flex items-center">
                Parque de PTAs ({ptas.length})
              </span>
              <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-[#1B2A4A]">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-xl sm:text-3xl font-bold text-[#1A1A1A]">
              {ptaDisponiveis}{' '}
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Disponíveis
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> {ptaEmUso} em uso
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> {ptaManutencao} manut.
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> {ptaAvariadas} avar.
            </span>
          </div>
        </NavLink>

        {/* Card 2: Agendamentos Hoje / Semana */}
        <NavLink to="/agenda" className="tap-card bg-white rounded-xl border border-gray-200 border-l-4 border-l-[#F5D800] p-3 sm:p-4 shadow-xs flex flex-col justify-between no-underline">
          <div>
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400 leading-tight min-h-[2rem] flex items-center">
                Reservas em Operação
              </span>
              <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-[#1B2A4A]">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-xl sm:text-3xl font-bold text-[#1A1A1A]">
              {agendamentosHoje}{' '}
              <span className="text-xs font-medium text-gray-500">hoje na fábrica</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
            <span>Semana:</span>
            <span className="font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
              {agendamentosSemana}
            </span>
          </div>
        </NavLink>

        {/* Card 3: Avarias Abertas */}
        <NavLink to="/avarias" className="tap-card bg-white rounded-xl border border-gray-200 border-l-4 border-l-[#F5D800] p-3 sm:p-4 shadow-xs flex flex-col justify-between no-underline">
          <div>
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400 leading-tight min-h-[2rem] flex items-center">
                Manutenção & Avarias
              </span>
              <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-[#1B2A4A]">
                <AlertOctagon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-xl sm:text-3xl font-bold text-[#1A1A1A] flex items-center gap-2">
              {avariasAbertas}
              {avariasAbertas > 0 ? (
                <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  Pendentes
                </span>
              ) : (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Zero Avarias
                </span>
              )}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
            <span className="text-amber-800 font-semibold flex items-center gap-1">
              <span>Gerenciar</span>
              <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </NavLink>

      </div>

      {/* Main Section: Próximas Atividades */}
      <div className="grid grid-cols-1 gap-6">
        {/* Left 2 Cols: Próximas Atividades (7 dias de v_agenda) */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div>
              <h3 className="text-base font-bold text-[#1A1A1A] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-500" />
                Próximas Atividades (Próximos 7 Dias)
              </h3>
              <p className="text-xs text-gray-500">
                Ordenado cronologicamente a partir da view unificada de agendamentos (v_agenda).
              </p>
            </div>
            <NavLink
              to="/agenda"
              className="text-xs font-bold text-amber-800 hover:text-amber-900 flex items-center gap-1 hover:underline"
            >
              <span>Ver agenda completa</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </NavLink>
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-[#F5D800] border-t-transparent rounded-full animate-spin" />
              <span>Carregando agenda...</span>
            </div>
          ) : proximasAtividades.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <Truck className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <div className="text-sm font-semibold text-gray-700">Nenhum agendamento para os próximos 7 dias</div>
              <p className="text-xs text-gray-500 mt-1">
                Todas as plataformas elevatórias estão disponíveis para reserva imediata.
              </p>
              <button
                onClick={() => setNovoModalOpen(true)}
                className="mt-3 px-3.5 py-1.5 bg-[#1B2A4A] hover:bg-[#152238] text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
              >
                Criar primeiro agendamento
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {proximasAtividades.map((item) => {
                const statusConfig = getAgendamentoStatusConfig(item.status);
                const isPrioritario = item.prioridade === 'prioritario';

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedAgendamentoId(item.id);
                      setDrawerOpen(true);
                    }}
                    className="tap-card py-3 px-2.5 rounded-lg hover:bg-gray-50 flex items-center justify-between gap-3 sm:gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-gray-500 uppercase">
                          {formatDateBR(item.data_inicio).substring(0, 5)}
                        </span>
                        <span className="text-xs font-bold text-gray-900">
                          {formatDateBR(item.data_inicio).substring(0, 2)}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-gray-900 truncate">
                            {item.pta_patrimonio || item.patrimonio || 'PTA'} — {item.tipo_atividade}
                          </span>
                          {isPrioritario && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#F5D800] text-[#1B2A4A] border border-amber-300">
                              ★ PRIORITÁRIO
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>Área: <strong>{item.area_nome || item.nome_area || 'Área'}</strong></span>
                          <span>•</span>
                          <span>UG: <strong>{item.ug || 'Principal'}</strong></span>
                          <span>•</span>
                          <span>Solicitante: {item.solicitante_nome || item.nome_solicitante || '-'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${statusConfig.bg}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                        {statusConfig.label}
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Drawer & Modal */}
      <DetalhesAgendamentoDrawer
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedAgendamentoId(null);
        }}
        agendamentoId={selectedAgendamentoId}
        onUpdated={loadDashboardData}
        onOpenEdit={(agendamento) => {
          setEditingAgendamento(agendamento);
          setNovoModalOpen(true);
        }}
      />

      <AgendamentoModal
        isOpen={novoModalOpen}
        onClose={() => { setNovoModalOpen(false); setEditingAgendamento(null); }}
        onSuccess={loadDashboardData}
        editingAgendamento={editingAgendamento}
      />
    </div>
  );
};
