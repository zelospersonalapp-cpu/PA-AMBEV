import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Clock,
  MapPin,
  PackageX,
  User,
  Building,
  Filter,
  TrendingDown,
  Calendar,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AgendaRow {
  id: string;
  data_inicio: string;
  data_fim: string;
  patrimonio?: string;
  tipo_pta?: string;
  solicitante?: string | null;
  area_empresa?: string | null;
  tipo_atividade?: string | null;
  status: string;
  entregou_no_prazo: boolean | null;
  entregou_local_combinado: boolean | null;
  posicionou_carregamento: boolean | null;
}

type Periodo = 'todos' | '30' | '90';
type TipoFiltro = 'todos' | 'prazo' | 'local' | 'carga';

function formatDateBR(d?: string) {
  if (!d) return '—';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
  } catch {
    return d;
  }
}

export const Desconformidades: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AgendaRow[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>('todos');
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('v_agenda')
        .select('*')
        .eq('status', 'concluido')
        .order('data_inicio', { ascending: false });
      if (error) throw error;
      setRows((data as AgendaRow[]) || []);
    } catch (err) {
      console.error('Erro ao carregar desconformidades:', err);
    } finally {
      setLoading(false);
    }
  }

  // Uma linha é desconformidade se qualquer um dos 3 checks for false
  const desconformidades = useMemo(() => {
    const limite =
      periodo === 'todos'
        ? null
        : new Date(Date.now() - Number(periodo) * 24 * 60 * 60 * 1000);

    return rows.filter((r) => {
      const temViolacao =
        r.entregou_no_prazo === false ||
        r.entregou_local_combinado === false ||
        r.posicionou_carregamento === false;
      if (!temViolacao) return false;

      if (limite) {
        const dt = new Date((r.data_fim || r.data_inicio) + 'T00:00:00');
        if (dt < limite) return false;
      }

      if (tipoFiltro === 'prazo') return r.entregou_no_prazo === false;
      if (tipoFiltro === 'local') return r.entregou_local_combinado === false;
      if (tipoFiltro === 'carga') return r.posicionou_carregamento === false;
      return true;
    });
  }, [rows, periodo, tipoFiltro]);

  // Totais por tipo
  const totais = useMemo(() => {
    const base = desconformidades;
    return {
      total: base.length,
      prazo: base.filter((r) => r.entregou_no_prazo === false).length,
      local: base.filter((r) => r.entregou_local_combinado === false).length,
      carga: base.filter((r) => r.posicionou_carregamento === false).length,
    };
  }, [desconformidades]);

  // Ranking por solicitante
  const rankingSolicitantes = useMemo(() => {
    const map = new Map<
      string,
      { nome: string; total: number; prazo: number; local: number; carga: number }
    >();
    desconformidades.forEach((r) => {
      const nome = r.solicitante || 'Não informado';
      const cur = map.get(nome) || { nome, total: 0, prazo: 0, local: 0, carga: 0 };
      cur.total += 1;
      if (r.entregou_no_prazo === false) cur.prazo += 1;
      if (r.entregou_local_combinado === false) cur.local += 1;
      if (r.posicionou_carregamento === false) cur.carga += 1;
      map.set(nome, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [desconformidades]);

  // Ranking por empresa
  const rankingEmpresas = useMemo(() => {
    const map = new Map<string, { nome: string; total: number }>();
    desconformidades.forEach((r) => {
      const nome = r.area_empresa || 'Não informada';
      const cur = map.get(nome) || { nome, total: 0 };
      cur.total += 1;
      map.set(nome, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [desconformidades]);

  const kpis = [
    { label: 'Total de Desconformidades', value: totais.total, icon: AlertTriangle, color: 'text-rose-600', ring: 'border-l-rose-500' },
    { label: 'Fora do Prazo', value: totais.prazo, icon: Clock, color: 'text-amber-600', ring: 'border-l-amber-500' },
    { label: 'Fora do Local Combinado', value: totais.local, icon: MapPin, color: 'text-orange-600', ring: 'border-l-orange-500' },
    { label: 'Sem Posicionar na Carga', value: totais.carga, icon: PackageX, color: 'text-purple-600', ring: 'border-l-purple-500' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-3.5 sm:p-4 shadow-xs">
        <h2 className="text-lg sm:text-xl font-bold text-[#1A1A1A] flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-rose-500" />
          Análise de Conduta
        </h2>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
          Mapeamento de condutas fora do padrão: entregas fora do prazo, fora do local combinado e sem posicionar a PTA na carga.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className={`bg-white rounded-lg border border-gray-200 border-l-4 ${k.ring} p-2.5 shadow-xs`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 leading-tight">
                  {k.label}
                </span>
                <Icon className={`w-3.5 h-3.5 shrink-0 ${k.color}`} />
              </div>
              <div className="text-xl font-extrabold text-gray-900 mt-0.5">{k.value}</div>
            </div>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-xs flex flex-wrap items-center gap-2.5">
        <span className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-amber-500" /> Filtros
        </span>
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value as Periodo)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
        >
          <option value="todos">Todo o período</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
        </select>
        <select
          value={tipoFiltro}
          onChange={(e) => setTipoFiltro(e.target.value as TipoFiltro)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
        >
          <option value="todos">Todos os tipos</option>
          <option value="prazo">Fora do prazo</option>
          <option value="local">Fora do local combinado</option>
          <option value="carga">Sem posicionar na carga</option>
        </select>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Solicitantes fora do padrão */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <User className="w-4 h-4 text-rose-500" />
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Solicitantes com mais desconformidades
            </span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-xs text-gray-400">Carregando...</div>
          ) : rankingSolicitantes.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">
              Nenhuma desconformidade registrada no período. 👏
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {rankingSolicitantes.map((s, i) => (
                <div key={(s.nome || '').toUpperCase()} className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] shrink-0 ${
                      i === 0 ? 'bg-rose-600 text-white' : i === 1 ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {i + 1}º
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-gray-900 truncate">{(s.nome || '').toUpperCase()}</div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        {s.prazo > 0 && <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">{s.prazo} prazo</span>}
                        {s.local > 0 && <span className="text-[10px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">{s.local} local</span>}
                        {s.carga > 0 && <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-full">{s.carga} carga</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-extrabold text-rose-600">{s.total}</div>
                    <div className="text-[10px] text-gray-400">ocorrências</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Empresas */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <Building className="w-4 h-4 text-rose-500" />
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Empresas com mais desconformidades
            </span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-xs text-gray-400">Carregando...</div>
          ) : rankingEmpresas.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">Sem registros no período.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {rankingEmpresas.map((e, i) => (
                <div key={(e.nome || '').toUpperCase()} className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] shrink-0 ${
                      i === 0 ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {i + 1}º
                    </div>
                    <div className="font-bold text-sm text-gray-900 truncate">{(e.nome || '').toUpperCase()}</div>
                  </div>
                  <div className="text-lg font-extrabold text-rose-600 shrink-0">{e.total}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Registro detalhado */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Registro Detalhado de Ocorrências
          </span>
          <span className="text-[11px] text-gray-400">{desconformidades.length} registro(s)</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-xs text-gray-400">Carregando...</div>
        ) : desconformidades.length === 0 ? (
          <div className="p-10 text-center text-xs text-gray-400">
            Nenhuma desconformidade encontrada com os filtros atuais.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {desconformidades.map((r) => (
              <div key={r.id} className="p-3.5 hover:bg-gray-50/60 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-gray-900">{(r.patrimonio || 'PTA').toUpperCase()}</span>
                      {r.entregou_no_prazo === false && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Fora do prazo</span>
                      )}
                      {r.entregou_local_combinado === false && (
                        <span className="text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">Fora do local</span>
                      )}
                      {r.posicionou_carregamento === false && (
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">Sem carga</span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-gray-700">{(r.solicitante || 'NÃO INFORMADO').toUpperCase()}</span>
                      {r.area_empresa && (<><span className="text-gray-300">·</span><span>{(r.area_empresa || '').toUpperCase()}</span></>)}
                      {r.tipo_atividade && (<><span className="text-gray-300">·</span><span>{(r.tipo_atividade || '').toUpperCase()}</span></>)}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-1 rounded-md whitespace-nowrap">
                    <Calendar className="w-3 h-3" />
                    {formatDateBR(r.data_fim || r.data_inicio)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

