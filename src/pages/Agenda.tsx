import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Filter,
  X,
  Truck,
  Building,
  MapPin,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { VAgenda, PTA, AreaEmpresa, Local, Agendamento } from '../types';
import { formatDateBR, getAgendamentoStatusConfig, getDayOfWeekName } from '../lib/formatters';
import { DetalhesAgendamentoDrawer } from '../components/DetalhesAgendamentoDrawer';
import { AgendamentoModal } from '../components/AgendamentoModal';

export const Agenda: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);

  // Agenda records
  const [agendamentos, setAgendamentos] = useState<VAgenda[]>([]);

  // Auxiliary filter options
  const [ptas, setPtas] = useState<PTA[]>([]);
  const [areas, setAreas] = useState<AreaEmpresa[]>([]);
  const [locais, setLocais] = useState<Local[]>([]);

  // Calendar view mode: 'semana' | 'mes' | 'lista'
  const [viewMode, setViewMode] = useState<'semana' | 'mes' | 'lista'>('semana');
  // Current anchor date
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Filter states
  const [filterPta, setFilterPta] = useState<string>('');
  const [filterArea, setFilterArea] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterUg, setFilterUg] = useState<string>('');

  // Modals & Drawers
  const [selectedAgendamentoId, setSelectedAgendamentoId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [novoModalOpen, setNovoModalOpen] = useState(false);
  const [editingAgendamento, setEditingAgendamento] = useState<Agendamento | null>(null);
  const [selectedDateForNew, setSelectedDateForNew] = useState<string | undefined>(undefined);

  // Check if query param ?novo=true is present
  useEffect(() => {
    if (searchParams.get('novo') === 'true') {
      setNovoModalOpen(true);
      // Clean query param
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    loadAuxData();
    loadAgenda();

    const handleUpdate = () => {
      loadAgenda();
    };
    window.addEventListener('agendamento-updated', handleUpdate);
    return () => window.removeEventListener('agendamento-updated', handleUpdate);
  }, []);

  async function loadAuxData() {
    try {
      const [ptasRes, areasRes, locaisRes] = await Promise.all([
        supabase.from('ptas').select('*').order('patrimonio', { ascending: true }),
        supabase.from('areas_empresas').select('*').eq('ativo', true).order('nome', { ascending: true }),
        supabase.from('locais').select('*').eq('ativo', true).order('ug', { ascending: true }),
      ]);
      if (ptasRes.data) setPtas(ptasRes.data);
      if (areasRes.data) setAreas(areasRes.data);
      if (locaisRes.data) setLocais(locaisRes.data);
    } catch (err) {
      console.error('Erro ao carregar dados auxiliares de filtros:', err);
    }
  }

  async function loadAgenda() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('v_agenda')
        .select('*')
        .order('data_inicio', { ascending: true });

      if (error) throw error;
      setAgendamentos(data || []);
    } catch (err) {
      console.error('Erro ao carregar v_agenda:', err);
    } finally {
      setLoading(false);
    }
  }

  // Unique UGs from locais
  const uniqueUGs = useMemo(() => {
    return Array.from(new Set(locais.map((l) => l.ug))).filter(Boolean);
  }, [locais]);

  // Apply filters
  const filteredAgendamentos = useMemo(() => {
    return agendamentos.filter((item) => {
      if (filterPta && item.pta_id !== filterPta) return false;
      if (filterArea && item.area_empresa_id !== filterArea) return false;
      if (filterStatus && item.status !== filterStatus) return false;
      if (filterUg && item.ug !== filterUg) return false;
      return true;
    });
  }, [agendamentos, filterPta, filterArea, filterStatus, filterUg]);

  // Navigation handlers
  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewMode === 'mes') {
      next.setMonth(next.getMonth() - 1);
    } else {
      next.setDate(next.getDate() - 7);
    }
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === 'mes') {
      next.setMonth(next.getMonth() + 1);
    } else {
      next.setDate(next.getDate() + 7);
    }
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Calculate Week Days for 'semana' view
  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay(); // 0 = sun, 1 = mon...
    // Set to Monday (or Sunday)
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  // Calculate Month Days for 'mes' view
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days = [];
    // Leading days from previous month to align with Sunday or Monday
    const startDayIndex = firstDay.getDay(); // 0 = sun
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false });
    }

    // Days in current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true });
    }

    // Trailing days to fill 35 or 42 grid slots
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false });
    }

    return days;
  }, [currentDate]);

  // Check if an item is active on date YYYY-MM-DD
  const getAgendamentosForDate = (date: Date) => {
    const dStr = date.toISOString().substring(0, 10);
    return filteredAgendamentos.filter((a) => {
      const start = a.data_inicio ? a.data_inicio.substring(0, 10) : '';
      const end = a.data_fim ? a.data_fim.substring(0, 10) : '';
      return start <= dStr && end >= dStr;
    });
  };

  const hasActiveFilters = Boolean(filterPta || filterArea || filterStatus || filterUg);

  const clearFilters = () => {
    setFilterPta('');
    setFilterArea('');
    setFilterStatus('');
    setFilterUg('');
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#1A1A1A] flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-amber-500" />
            Agenda de Plataformas Elevatórias
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Visão gráfica de ocupação por dia/semana. Clique em qualquer agendamento para abrir o fluxo operacional.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => {
              setEditingAgendamento(null);
              setSelectedDateForNew(undefined);
              setNovoModalOpen(true);
            }}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs sm:text-sm rounded-lg shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4 text-white" />
            <span>+ Novo Agendamento</span>
          </button>
          <button
            onClick={loadAgenda}
            title="Atualizar Agenda"
            className="p-2 text-gray-500 hover:text-black rounded-lg border border-gray-300 hover:bg-gray-100"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-700 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-amber-500" />
            <span>Filtros Rápidos</span>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1 hover:underline"
            >
              <X className="w-3.5 h-3.5" />
              Limpar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* PTA */}
          <div>
            <label className="block text-gray-500 mb-1 font-medium">Plataforma (PTA)</label>
            <select
              value={filterPta}
              onChange={(e) => setFilterPta(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white text-xs"
            >
              <option value="">Todas as PTAs</option>
              {ptas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.patrimonio} ({p.tipo})
                </option>
              ))}
            </select>
          </div>

          {/* Area / Empresa */}
          <div>
            <label className="block text-gray-500 mb-1 font-medium">Área / Empresa</label>
            <select
              value={filterArea}
              onChange={(e) => setFilterArea(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white text-xs"
            >
              <option value="">Todas as Áreas</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-gray-500 mb-1 font-medium">Status Operacional</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white text-xs"
            >
              <option value="">Todos os Status</option>
              <option value="agendado">Agendado</option>
              <option value="liberado">Liberado</option>
              <option value="retirado">Retirado / Em uso</option>
              <option value="concluido">Concluído</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          {/* Local UG */}
          <div>
            <label className="block text-gray-500 mb-1 font-medium">Unidade / Local (UG)</label>
            <select
              value={filterUg}
              onChange={(e) => setFilterUg(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white text-xs"
            >
              <option value="">Todas as UGs</option>
              {uniqueUGs.map((ug) => (
                <option key={ug} value={ug}>
                  {ug}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Navigation & Mode Toggle Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Date Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className="px-3 py-1.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Hoje
          </button>
          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={handlePrev}
              className="p-1.5 hover:bg-gray-100 text-gray-600 transition-colors"
              title="Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 hover:bg-gray-100 text-gray-600 transition-colors"
              title="Próximo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <span className="text-sm font-bold text-[#1A1A1A] ml-2">
            {currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
          </span>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center rounded-lg border border-gray-300 p-1 bg-gray-50 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('semana')}
            className={`px-3 py-1 rounded-md font-semibold transition-all ${
              viewMode === 'semana'
                ? 'bg-[#1B2A4A] text-white shadow-xs'
                : 'text-gray-600 hover:text-black'
            }`}
          >
            Semana
          </button>
          <button
            type="button"
            onClick={() => setViewMode('mes')}
            className={`px-3 py-1 rounded-md font-semibold transition-all ${
              viewMode === 'mes'
                ? 'bg-[#1B2A4A] text-white shadow-xs'
                : 'text-gray-600 hover:text-black'
            }`}
          >
            Mês
          </button>
          <button
            type="button"
            onClick={() => setViewMode('lista')}
            className={`px-3 py-1 rounded-md font-semibold transition-all ${
              viewMode === 'lista'
                ? 'bg-[#1B2A4A] text-white shadow-xs'
                : 'text-gray-600 hover:text-black'
            }`}
          >
            Lista Completa
          </button>
        </div>
      </div>

      {/* Calendar Content */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-[#F5D800] border-t-transparent rounded-full animate-spin" />
          <span>Carregando dados da agenda...</span>
        </div>
      ) : viewMode === 'semana' ? (
        /* VISÃO SEMANA */
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-center text-xs font-bold text-gray-700 divide-x divide-gray-200">
            {weekDays.map((d, i) => {
              const isToday = d.toISOString().substring(0, 10) === new Date().toISOString().substring(0, 10);
              return (
                <div key={i} className={`py-2.5 px-1 ${isToday ? 'bg-amber-100/60' : ''}`}>
                  <div className="uppercase text-[10px] text-gray-500">{getDayOfWeekName(d.getDay()).substring(0, 3)}</div>
                  <div className={`text-sm font-bold ${isToday ? 'text-amber-900 font-extrabold' : 'text-gray-900'}`}>
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-7 min-h-[460px] divide-x divide-gray-200">
            {weekDays.map((d, colIndex) => {
              const items = getAgendamentosForDate(d);
              const dateStr = d.toISOString().substring(0, 10);
              const isToday = dateStr === new Date().toISOString().substring(0, 10);

              return (
                <div
                  key={colIndex}
                  className={`p-2 space-y-2 flex flex-col ${isToday ? 'bg-amber-50/20' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDateForNew(dateStr);
                      setEditingAgendamento(null);
                      setNovoModalOpen(true);
                    }}
                    className="w-full py-1 text-[11px] font-semibold text-gray-400 hover:text-black hover:bg-gray-100 rounded border border-dashed border-gray-200 transition-colors"
                  >
                    + Agendar
                  </button>

                  <div className="space-y-1.5 flex-1">
                    {items.map((item) => {
                      const statusConfig = getAgendamentoStatusConfig(item.status);
                      const isPrioritario = item.prioridade === 'prioritario';

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedAgendamentoId(item.id);
                            setDrawerOpen(true);
                          }}
                          className={`p-2 rounded-lg border text-xs cursor-pointer shadow-2xs hover:shadow-xs transition-all ${statusConfig.bg}`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="font-bold text-gray-900 truncate">
                              {item.solicitante_nome || item.nome_solicitante || 'Solicitante'}
                            </span>
                            {isPrioritario && (
                              <span className="px-1 py-0.2 rounded text-[9px] font-extrabold bg-[#F5D800] text-black border border-amber-400">
                                ★
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-medium text-gray-800 truncate">
                            {item.tipo_atividade}
                          </div>
                          <div className="text-[10px] text-gray-500 truncate mt-0.5">
                            {item.ug || 'UG não informada'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : viewMode === 'mes' ? (
        /* VISÃO MÊS */
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-center text-xs font-bold text-gray-700 divide-x divide-gray-200">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dayName, i) => (
              <div key={i} className="py-2">
                {dayName}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-gray-200">
            {monthDays.map(({ date, isCurrentMonth }, idx) => {
              const items = getAgendamentosForDate(date);
              const dateStr = date.toISOString().substring(0, 10);
              const isToday = dateStr === new Date().toISOString().substring(0, 10);

              return (
                <div
                  key={idx}
                  className={`min-h-[100px] p-1.5 flex flex-col ${
                    !isCurrentMonth ? 'bg-gray-50/70 opacity-60' : isToday ? 'bg-amber-50/40' : ''
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span className={isToday ? 'text-amber-800 font-extrabold' : 'text-gray-700'}>
                      {date.getDate()}
                    </span>
                    {items.length > 0 && (
                      <span className="text-[10px] text-gray-500 font-normal">
                        {items.length} res.
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 flex-1 overflow-y-auto max-h-[90px]">
                    {items.slice(0, 3).map((item) => {
                      const statusConfig = getAgendamentoStatusConfig(item.status);
                      const isPrioritario = item.prioridade === 'prioritario';

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedAgendamentoId(item.id);
                            setDrawerOpen(true);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] truncate cursor-pointer font-medium border flex items-center justify-between gap-1 ${statusConfig.bg}`}
                          title={`${item.pta_patrimonio} - ${item.tipo_atividade} (${item.area_nome})`}
                        >
                          <span className="truncate">
                            {item.pta_patrimonio || 'PTA'}: {item.tipo_atividade}
                          </span>
                          {isPrioritario && <span className="text-[#927300] font-bold">★</span>}
                        </div>
                      );
                    })}

                    {items.length > 3 && (
                      <div
                        onClick={() => {
                          setCurrentDate(date);
                          setViewMode('semana');
                        }}
                        className="text-[10px] font-bold text-gray-500 hover:text-black cursor-pointer text-center"
                      >
                        +{items.length - 3} mais
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* VISÃO LISTA DETALHADA */
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Todos os Agendamentos Cadastrados ({filteredAgendamentos.length})
            </span>
          </div>

          {filteredAgendamentos.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-xs">
              Nenhum agendamento encontrado com os filtros aplicados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] font-bold border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">PTA</th>
                    <th className="py-3 px-4">Período</th>
                    <th className="py-3 px-4">Atividade</th>
                    <th className="py-3 px-4">Área / Empresa</th>
                    <th className="py-3 px-4">Local (UG)</th>
                    <th className="py-3 px-4">Solicitante</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAgendamentos.map((item) => {
                    const statusConfig = getAgendamentoStatusConfig(item.status);
                    const isPrioritario = item.prioridade === 'prioritario';

                    return (
                      <tr
                        key={item.id}
                        onClick={() => {
                          setSelectedAgendamentoId(item.id);
                          setDrawerOpen(true);
                        }}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${statusConfig.bg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-gray-900">
                          {item.pta_patrimonio || item.patrimonio || 'PTA'}
                          {isPrioritario && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#F5D800] text-[#1B2A4A] border border-amber-300">
                              ★ Prioritário
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-700 whitespace-nowrap">
                          {formatDateBR(item.data_inicio)} até {formatDateBR(item.data_fim)}
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900">
                          {item.tipo_atividade}
                        </td>
                        <td className="py-3 px-4 text-gray-700">
                          {item.area_nome || item.nome_area || '-'}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          UG: {item.ug || 'Principal'} {item.setor_linha ? `• ${item.setor_linha}` : ''}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {item.solicitante_nome || item.nome_solicitante || '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-[#1B2A4A] hover:underline">
                          Ver Fluxo →
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Drawer Details & Operational Flow */}
      <DetalhesAgendamentoDrawer
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedAgendamentoId(null);
        }}
        agendamentoId={selectedAgendamentoId}
        onUpdated={loadAgenda}
        onOpenEdit={(agendamento) => {
          setEditingAgendamento(agendamento);
          setNovoModalOpen(true);
        }}
      />

      {/* Modal Novo / Editar */}
      <AgendamentoModal
        isOpen={novoModalOpen}
        onClose={() => {
          setNovoModalOpen(false);
          setEditingAgendamento(null);
          setSelectedDateForNew(undefined);
        }}
        onSuccess={loadAgenda}
        editingAgendamento={editingAgendamento}
        initialDate={selectedDateForNew}
      />
    </div>
  );
};
