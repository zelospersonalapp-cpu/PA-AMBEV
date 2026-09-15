import React, { useState, useEffect } from 'react';
import {
  Award,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building,
  Info,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { VConfiabilidadeAreas } from '../types';

export const Confiabilidade: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [areasConfiabilidade, setAreasConfiabilidade] = useState<VConfiabilidadeAreas[]>([]);
  const [selectedArea, setSelectedArea] = useState<VConfiabilidadeAreas | null>(null);

  useEffect(() => {
    loadConfiabilidade();
  }, []);

  async function loadConfiabilidade() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('v_confiabilidade_areas')
        .select('*')
        .order('score_confiabilidade', { ascending: false });

      if (error) throw error;
      setAreasConfiabilidade(data || []);
      if (data && data.length > 0) {
        setSelectedArea(data[0]);
      }
    } catch (err) {
      console.error('Erro ao carregar v_confiabilidade_areas:', err);
    } finally {
      setLoading(false);
    }
  }

  const getClassificacaoBadge = (classificacao: string, score: number) => {
    if (score >= 90) {
      return {
        label: 'Excelente (Nível A)',
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        bar: 'bg-emerald-500',
        desc: 'Alta conformidade de entrega, prioridade máxima para agendamentos futuros.',
      };
    } else if (score >= 70) {
      return {
        label: 'Bom (Nível B)',
        bg: 'bg-amber-50 text-amber-900 border-amber-300',
        bar: 'bg-[#F5D800]',
        desc: 'Operação regular, baixa incidência de atrasos.',
      };
    } else if (score >= 50) {
      return {
        label: 'Atenção (Nível C)',
        bg: 'bg-orange-50 text-orange-800 border-orange-200',
        bar: 'bg-orange-500',
        desc: 'Pontualidade abaixo da média; requer auditoria de check-in.',
      };
    } else {
      return {
        label: 'Crítico (Nível D)',
        bg: 'bg-rose-50 text-rose-800 border-rose-200',
        bar: 'bg-rose-600',
        desc: 'Alto índice de atrasos ou danos não reportados.',
      };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#1A1A1A] flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            Confiabilidade & SLA Operacional (AmBev Facilities)
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Métricas de pontualidade de devolução, zelo com os equipamentos e ranking de confiabilidade por área.
          </p>
        </div>

        <div className="px-3 py-1.5 bg-[#152238] border border-[#F5D800]/30 rounded-lg flex items-center gap-2 text-xs font-semibold text-white">
          <Sparkles className="w-4 h-4 text-[#F5D800]" />
          <span>Meta Facilities: Score &gt; 90%</span>
        </div>
      </div>

      {/* Rules Explanatory Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Info className="w-4 h-4 text-amber-500" />
          Regras de Pontuação & Auditoria (v_confiabilidade_areas)
        </h3>
        <p className="text-xs text-gray-600 mb-4">
          O Score de Confiabilidade é recalculado continuamente pelo banco de dados com base no cumprimento do SLA de devolução e conservação das PTAs.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50">
            <div className="font-bold text-emerald-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Devolução no Prazo (+Pontos)
            </div>
            <p className="text-emerald-800 text-[11px] mt-1">
              Equipamento devolvido dentro da tolerância do agendamento mantém a área no topo do ranking.
            </p>
          </div>

          <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50">
            <div className="font-bold text-amber-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              Atraso na Devolução (-10 pts)
            </div>
            <p className="text-amber-800 text-[11px] mt-1">
              Prejudica a próxima área agendada. Atrasos reincidentes afetam a aprovação de novas reservas.
            </p>
          </div>

          <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/50">
            <div className="font-bold text-rose-900 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Avaria Ocorrida / Omissão (-20 pts)
            </div>
            <p className="text-rose-800 text-[11px] mt-1">
              Dano constatado no checklist de devolução sem reporte imediato impacta severamente o score.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content: Ranking list + Selected Area Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Ranking Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Classificação Geral das Áreas da Cervejaria
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500 text-xs flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-[#F5D800] border-t-transparent rounded-full animate-spin" />
              <span>Calculando pontuações...</span>
            </div>
          ) : areasConfiabilidade.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-xs">
              Nenhuma movimentação de agendamentos registrada para alimentar a view de confiabilidade.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {areasConfiabilidade.map((item, index) => {
                const score = Number(item.score_confiabilidade) || 0;
                const classConf = getClassificacaoBadge(item.classificacao, score);
                const isSelected = selectedArea?.area_id === item.area_id;

                return (
                  <div
                    key={item.area_id || index}
                    onClick={() => setSelectedArea(item)}
                    className={`p-4 cursor-pointer transition-colors flex items-center justify-between gap-4 ${
                      isSelected ? 'bg-amber-50/50 border-l-4 border-l-[#F5D800]' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          index === 0
                            ? 'bg-[#F5D800] text-[#1B2A4A] font-extrabold shadow-2xs'
                            : index === 1
                            ? 'bg-gray-200 text-gray-800'
                            : index === 2
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {index + 1}º
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-sm text-gray-900 truncate">
                          {item.area_nome}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                          <span>{item.total_agendamentos} total</span>
                          <span>•</span>
                          <span>{item.total_concluidos} concluídos</span>
                          <span>•</span>
                          <span className="text-rose-600 font-medium">
                            {item.total_atrasos} atrasos
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-base font-bold text-gray-900">{score}%</div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${classConf.bg}`}>
                          {item.classificacao || classConf.label.split(' ')[0]}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Col: Details Card for Selected Area */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="border-b border-gray-100 pb-3 mb-4">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Ficha de Conformidade
              </span>
              <h3 className="text-base font-bold text-gray-900">
                {selectedArea ? selectedArea.area_nome : 'Selecione uma área'}
              </h3>
            </div>

            {selectedArea ? (
              <div className="space-y-4">
                {/* Big Score Counter */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-center">
                  <span className="text-xs text-gray-500 font-medium block">
                    Score de Confiabilidade
                  </span>
                  <div className="text-4xl font-extrabold text-[#1A1A1A] my-1">
                    {Number(selectedArea.score_confiabilidade) || 0}%
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden mt-2">
                    <div
                      className="bg-[#F5D800] h-2.5 rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(0, Number(selectedArea.score_confiabilidade) || 0))}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-gray-500 mt-2 block">
                    Taxa de pontualidade na entrega: <strong>{selectedArea.pct_no_prazo}%</strong>
                  </span>
                </div>

                {/* Metrics Breakdown */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">Total de Agendamentos:</span>
                    <strong className="text-gray-900">{selectedArea.total_agendamentos}</strong>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">Operações Concluídas:</span>
                    <strong className="text-emerald-700">{selectedArea.total_concluidos}</strong>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">Agendamentos Cancelados:</span>
                    <strong className="text-gray-600">{selectedArea.total_cancelados}</strong>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">Devoluções com Atraso:</span>
                    <strong className="text-rose-600">{selectedArea.total_atrasos}</strong>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">Avarias Vinculadas:</span>
                    <strong className="text-rose-700">{selectedArea.total_avarias}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-10">
                Selecione uma área no ranking para visualizar os indicadores detalhados.
              </p>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 text-[11px] text-gray-500">
            Dados sincronizados em tempo real com o banco de dados Supabase de Gestão de PTAs.
          </div>
        </div>
      </div>
    </div>
  );
};
