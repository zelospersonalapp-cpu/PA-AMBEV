import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Truck,
  Clock,
  AlertTriangle,
  Calendar,
  ArrowRight,
  PlusCircle,
  AlertOctagon,
  Battery,
  CheckCircle2,
  Wrench,
  ChevronRight,
  Activity,
  MapPin,
  User,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { PTA, VAgenda, Agendamento } from '../types';
import { formatDateBR, getAgendamentoStatusConfig, getPtaStatusConfig } from '../lib/formatters';
import { DetalhesAgendamentoDrawer } from '../components/DetalhesAgendamentoDrawer';
import { AgendamentoModal } from '../components/AgendamentoModal';

export const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);

  const [ptas, setPtas] = useState<PTA[]>([]);
  const [agendamentosHoje, setAgendamentosHoje] = useState<number>(0);
  const [agendamentosSemana, setAgendamentosSemana] = useState<number>(0);
  const [avariasAbertas, setAvariasAbertas] = useState<number>(0);
  const [proximasAtividades, setProximasAtividades] = useState<VAgenda[]>([]);

  const [selectedAgendamentoId, setSelectedAgendamentoId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [novoModalOpen, setNovoModalOpen] = useState(false);
  const [editingAgendamento, setEditingAgendamento] = useState<Agendamento | null>(null);

  useEffect(() => {
    loadDashboardData();
    const handleUpdate = () => loadDashboardData();
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

      const [ptasRes, agHojeRes, agSemanaRes, avariasRes, proxRes] = await Promise.all([
        supabase.from('ptas').select('*'),
        supabase.from('agendamentos').select('id').neq('status', 'cancelado').lte('data_inicio', todayStr).gte('data_fim', todayStr),
        supabase.from('agendamentos').select('id').neq('status', 'cancelado').gte('data_fim', todayStr).lte('data_inicio', nextWeekStr),
        supabase.from('avarias').select('id').neq('status', 'resolvida'),
        supabase.from('v_agenda').select('*').neq('status', 'cancelado').gte('data_fim', todayStr).lte('data_inicio', nextWeekStr).order('data_inicio', { ascending: true }).limit(12),
      ]);

      if (ptasRes.data) setPtas(ptasRes.data);
      setAgendamentosHoje(agHojeRes.data?.length || 0);
      setAgendamentosSemana(agSemanaRes.data?.length || 0);
      setAvariasAbertas(avariasRes.data?.length || 0);
      if (proxRes.data) setProximasAtividades(proxRes.data);
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  const ptaDisponiveis = ptas.filter((p) => p.status === 'disponivel').length;
  const ptaEmUso = ptas.filter((p) => p.status === 'em_uso').length;
  const ptaManutencao = ptas.filter((p) => p.status === 'em_manutencao').length;
  const ptaAvariadas = ptas.filter((p) => p.status === 'avariada').length;

  const today = new Date();
  const todayLabel = today.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <div className="space-y-4">

      {/* ── Topbar ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#F5D800]" />
            Painel Operacional
          </h2>
          <p className="text-[11px] text-gray-400 capitalize mt-0.5">{todayLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <NavLink
            to="/agenda"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-lg border border-gray-300 transition-colors"
          >
            <Calendar className="w-3.5 h-3.5" />
            Calendário
          </NavLink>
          <button
            onClick={() => setNovoModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs rounded-lg shadow-xs transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Novo Agendamento
          </button>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* PTAs */}
        <NavLink to="/cadastros" className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-xs hover:border-[#F5D800] transition-colors no-underline group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Parque de PTAs</span>
            <div className="w-7 h-7 rounded-lg bg-[#1B2A4A]/5 flex items-center justify-center">
              <Truck className="w-3.5 h-3.5 text-[#1B2A4A]" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 mb-2.5">
            <span className="text-2xl font-black text-gray-900">{ptas.length}</span>
            <span className="text-xs text-gray-400">plataformas</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{ptaDisponiveis} disp.
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />{ptaEmUso} uso
            </span>
            {ptaManutencao > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{ptaManutencao} manut.
              </span>
            )}
            {ptaAvariadas > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />{ptaAvariadas} avar.
              </span>
            )}
          </div>
        </NavLink>

        {/* Hoje */}
        <NavLink to="/agenda" className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-xs hover:border-[#F5D800] transition-colors no-underline">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Em Operação Hoje</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 mb-2.5">
            <span className="text-2xl font-black text-gray-900">{agendamentosHoje}</span>
            <span className="text-xs text-gray-400">ativas agora</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-gray-500 border-t border-gray-100 pt-2">
            <span>Semana</span>
            <span className="font-black text-gray-800 text-sm">{agendamentosSemana}</span>
          </div>
        </NavLink>

        {/* Avarias */}
        <NavLink to="/avarias" className={`bg-white rounded-xl border p-3.5 shadow-xs hover:border-rose-300 transition-colors no-underline ${avariasAbertas > 0 ? 'border-rose-200 bg-rose-50/30' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Avarias Abertas</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${avariasAbertas > 0 ? 'bg-rose-100' : 'bg-emerald-50'}`}>
              <AlertOctagon className={`w-3.5 h-3.5 ${avariasAbertas > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 mb-2.5">
            <span className={`text-2xl font-black ${avariasAbertas > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{avariasAbertas}</span>
            <span className="text-xs text-gray-400">pendentes</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] border-t border-gray-100 pt-2">
            {avariasAbertas === 0 ? (
              <span className="text-emerald-600 font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Tudo OK</span>
            ) : (
              <span className="text-rose-600 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Requer atenção</span>
            )}
          </div>
        </NavLink>

        {/* Mini mapa de PTAs */}
        <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Status das PTAs</span>
            <Wrench className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <div className="space-y-1.5">
            {loading ? (
              <div className="text-[10px] text-gray-300 py-2">Carregando...</div>
            ) : ptas.length === 0 ? (
              <div className="text-[10px] text-gray-400 py-2">Nenhuma PTA cadastrada</div>
            ) : ptas.slice(0, 4).map((pta) => {
              const cfg = getPtaStatusConfig(pta.status);
              return (
                <div key={pta.id} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-gray-700 truncate">{pta.patrimonio}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${cfg.bg} shrink-0`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                </div>
              );
            })}
            {ptas.length > 4 && (
              <NavLink to="/cadastros" className="text-[10px] text-[#1B2A4A] font-bold flex items-center gap-0.5 hover:underline">
                +{ptas.length - 4} mais <ChevronRight className="w-3 h-3" />
              </NavLink>
            )}
          </div>
        </div>

      </div>

      {/* ── Próximas Atividades ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-bold text-gray-900">Próximas Atividades</span>
            <span className="text-[10px] text-gray-400 font-normal">— próximos 7 dias</span>
          </div>
          <NavLink to="/agenda" className="text-[11px] font-bold text-[#1B2A4A] hover:underline flex items-center gap-1">
            Ver agenda <ArrowRight className="w-3 h-3" />
          </NavLink>
        </div>

        {loading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-xs text-gray-400">
            <div className="w-4 h-4 border-2 border-[#F5D800] border-t-transparent rounded-full animate-spin" />
            Carregando...
          </div>
        ) : proximasAtividades.length === 0 ? (
          <div className="py-10 text-center">
            <Truck className="w-7 h-7 text-gray-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-gray-500">Nenhum agendamento nos próximos 7 dias</p>
            <button
              onClick={() => setNovoModalOpen(true)}
              className="mt-3 px-3 py-1.5 bg-[#1B2A4A] hover:bg-[#152238] text-white text-xs font-bold rounded-lg"
            >
              Criar agendamento
            </button>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 text-[10px] font-bold uppercase border-b border-gray-100">
              <tr>
                <th className="py-2.5 px-4">Data</th>
                <th className="py-2.5 px-4">PTA</th>
                <th className="py-2.5 px-4">Atividade</th>
                <th className="py-2.5 px-4 hidden sm:table-cell">Local</th>
                <th className="py-2.5 px-4 hidden md:table-cell">Solicitante</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {proximasAtividades.map((item) => {
                const statusConfig = getAgendamentoStatusConfig(item.status);
                const isPrioritario = item.prioridade === 'prioritario';
                const dataInicio = formatDateBR(item.data_inicio);
                const dataFim = formatDateBR(item.data_fim);
                const sameDayRange = item.data_inicio === item.data_fim;

                return (
                  <tr
                    key={item.id}
                    onClick={() => { setSelectedAgendamentoId(item.id); setDrawerOpen(true); }}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className="font-bold text-gray-800">{dataInicio.substring(0, 5)}</span>
                      {!sameDayRange && (
                        <span className="text-gray-400"> → {dataFim.substring(0, 5)}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-[#1B2A4A]">
                          {item.pta_patrimonio || item.patrimonio || '—'}
                        </span>
                        {isPrioritario && (
                          <span className="text-[9px] font-bold bg-[#F5D800] text-[#1B2A4A] px-1 py-0.5 rounded">★</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-gray-700 max-w-[160px] truncate">{item.tipo_atividade}</td>
                    <td className="py-2.5 px-4 hidden sm:table-cell text-gray-500 max-w-[140px] truncate">
                      {(item as any).ponto_ref || item.local_descricao || item.ug || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-2.5 px-4 hidden md:table-cell text-gray-500">
                      {item.solicitante || item.solicitante_nome || item.nome_solicitante || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 w-fit ${statusConfig.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-2">
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Drawer & Modal */}
      <DetalhesAgendamentoDrawer
        isOpen={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedAgendamentoId(null); }}
        agendamentoId={selectedAgendamentoId}
        onUpdated={loadDashboardData}
        onOpenEdit={(agendamento) => { setEditingAgendamento(agendamento); setNovoModalOpen(true); }}
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
