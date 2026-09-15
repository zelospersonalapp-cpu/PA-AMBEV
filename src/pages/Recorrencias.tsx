import React, { useState, useEffect } from 'react';
import {
  Repeat,
  PlusCircle,
  Play,
  Calendar,
  Building,
  MapPin,
  Truck,
  Edit2,
  Trash2,
  CheckCircle,
  X,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { supabase, chamarGerarAgendamentosRecorrentes } from '../lib/supabase';
import { useToast } from '../components/Toast';
import type { Recorrencia, AreaEmpresa, Local, PTA, FrequenciaRecorrencia } from '../types';
import { formatDateBR, getDayOfWeekName } from '../lib/formatters';

export const Recorrencias: React.FC = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([]);

  // Auxiliary data
  const [areas, setAreas] = useState<AreaEmpresa[]>([]);
  const [locais, setLocais] = useState<Local[]>([]);
  const [ptas, setPtas] = useState<PTA[]>([]);

  // Modal Create/Edit Recorrencia
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Recorrencia | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [areaEmpresaId, setAreaEmpresaId] = useState('');
  const [ptaId, setPtaId] = useState('');
  const [localId, setLocalId] = useState('');
  const [diaSemana, setDiaSemana] = useState<number>(1); // Monday
  const [frequencia, setFrequencia] = useState<FrequenciaRecorrencia>('semanal');
  const [prioritario, setPrioritario] = useState(false);
  const [tipoAtividade, setTipoAtividade] = useState('Manutenção Periódica');
  const [vigenciaInicio, setVigenciaInicio] = useState(new Date().toISOString().substring(0, 10));
  const [vigenciaFim, setVigenciaFim] = useState('');
  const [ativo, setAtivo] = useState(true);

  // Modal Gerar Agendamentos RPC
  const [gerarModalOpen, setGerarModalOpen] = useState(false);
  const [gerarInicio, setGerarInicio] = useState(new Date().toISOString().substring(0, 10));
  const [gerarFim, setGerarFim] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().substring(0, 10);
  });
  const [executingRpc, setExecutingRpc] = useState(false);
  const [resultadoGeracao, setResultadoGeracao] = useState<{ count?: number } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [recRes, areasRes, locaisRes, ptasRes] = await Promise.all([
        supabase.from('recorrencias').select('*').order('dia_semana', { ascending: true }),
        supabase.from('areas_empresas').select('*').eq('ativo', true).order('nome', { ascending: true }),
        supabase.from('locais').select('*').eq('ativo', true).order('ug', { ascending: true }),
        supabase.from('ptas').select('*').order('patrimonio', { ascending: true }),
      ]);

      if (recRes.data) setRecorrencias(recRes.data);
      if (areasRes.data) setAreas(areasRes.data);
      if (locaisRes.data) setLocais(locaisRes.data);
      if (ptasRes.data) setPtas(ptasRes.data);
    } catch (err: any) {
      console.error('Erro ao carregar recorrências:', err);
      toast.error('Erro ao carregar dados', err.message);
    } finally {
      setLoading(false);
    }
  }

  const openCreate = () => {
    setEditingItem(null);
    setAreaEmpresaId(areas[0]?.id || '');
    setPtaId('');
    setLocalId(locais[0]?.id || '');
    setDiaSemana(1);
    setFrequencia('semanal');
    setPrioritario(false);
    setTipoAtividade('Inspeção Preventiva');
    setVigenciaInicio(new Date().toISOString().substring(0, 10));
    // Default 6 months end
    const nextSix = new Date();
    nextSix.setMonth(nextSix.getMonth() + 6);
    setVigenciaFim(nextSix.toISOString().substring(0, 10));
    setAtivo(true);
    setModalOpen(true);
  };

  const openEdit = (item: Recorrencia) => {
    setEditingItem(item);
    setAreaEmpresaId(item.area_empresa_id);
    setPtaId(item.pta_id || '');
    setLocalId(item.local_id);
    setDiaSemana(item.dia_semana);
    setFrequencia(item.frequencia);
    setPrioritario(item.prioritario);
    setTipoAtividade(item.tipo_atividade);
    setVigenciaInicio(item.vigencia_inicio);
    setVigenciaFim(item.vigencia_fim);
    setAtivo(item.ativo);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!areaEmpresaId || !localId || !vigenciaInicio || !vigenciaFim) {
      toast.warning('Campos Obrigatórios', 'Preencha área, local e datas de vigência.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        area_empresa_id: areaEmpresaId,
        pta_id: ptaId || null,
        local_id: localId,
        dia_semana: Number(diaSemana),
        frequencia,
        prioritario,
        tipo_atividade: tipoAtividade,
        vigencia_inicio: vigenciaInicio,
        vigencia_fim: vigenciaFim,
        ativo,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('recorrencias')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
        toast.success('Regra Atualizada', 'A regra recorrente foi atualizada com sucesso.');
      } else {
        const { error } = await supabase.from('recorrencias').insert([payload]);
        if (error) throw error;
        toast.success('Regra Criada', 'Nova programação recorrente salva.');
      }

      setModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error('Erro ao salvar recorrência:', err);
      toast.error('Falha ao salvar', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Deseja excluir esta regra de recorrência?')) return;
    try {
      const { error } = await supabase.from('recorrencias').delete().eq('id', id);
      if (error) throw error;
      toast.info('Regra Excluída', 'A regra recorrente foi removida.');
      loadData();
    } catch (err: any) {
      toast.error('Erro ao excluir', err.message);
    }
  };

  const handleExecutarRpc = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!gerarInicio || !gerarFim) {
      toast.warning('Janela Inválida', 'Informe as datas de início e fim da janela de agendamentos.');
      return;
    }

    if (gerarInicio > gerarFim) {
      toast.error('Período Inválido', 'Data de início deve ser anterior ao término.');
      return;
    }

    setExecutingRpc(true);
    setResultadoGeracao(null);

    try {
      const result = await chamarGerarAgendamentosRecorrentes(gerarInicio, gerarFim);

      if (result.error) {
        throw result.error;
      }

      const count = result.count !== undefined ? result.count : 0;
      setResultadoGeracao({ count });
      toast.success(
        'Geração Concluída!',
        `${count} agendamento(s) recorrente(s) gerado(s) para a janela selecionada.`
      );
    } catch (err: any) {
      console.error('Erro ao chamar RPC gerar_agendamentos_recorrentes:', err);
      toast.error('Erro na RPC de Geração', err.message || 'Falha ao executar a rotina no banco de dados.');
    } finally {
      setExecutingRpc(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header with CTA to Generate Schedules */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#1A1A1A] flex items-center gap-2">
            <Repeat className="w-5 h-5 text-amber-500" />
            Programação de Recorrências Facilities
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Automatize as manutenções periódicas e vistorias semanais/quinzenais sem conflito na agenda.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* RPC Generator Button */}
          <button
            onClick={() => {
              setResultadoGeracao(null);
              setGerarModalOpen(true);
            }}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#1A1A1A] hover:bg-black text-white font-bold text-xs sm:text-sm rounded-lg shadow-xs transition-colors"
          >
            <Play className="w-4 h-4 text-[#F5D800]" />
            <span>Gerar Agendamentos (RPC)</span>
          </button>

          <button
            onClick={openCreate}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#F5D800] hover:bg-[#e4c900] text-black font-bold text-xs sm:text-sm rounded-lg shadow-xs border border-amber-400 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nova Regra</span>
          </button>
        </div>
      </div>

      {/* Recorrencias Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Regras Ativas ({recorrencias.length})
          </span>
          <span className="text-xs text-gray-500">
            Executadas pela rotina RPC do Supabase
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-[#F5D800] border-t-transparent rounded-full animate-spin" />
            <span>Carregando regras de recorrência...</span>
          </div>
        ) : recorrencias.length === 0 ? (
          <div className="p-10 text-center text-gray-500 text-xs">
            Nenhuma regra de recorrência cadastrada ainda.
            <div className="mt-2">
              <button
                onClick={openCreate}
                className="px-3 py-1.5 bg-[#F5D800] text-black font-bold text-xs rounded hover:bg-[#e4c900]"
              >
                + Criar Primeira Regra
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] font-bold border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Dia & Frequência</th>
                  <th className="py-3 px-4">Atividade</th>
                  <th className="py-3 px-4">Área / Empresa</th>
                  <th className="py-3 px-4">PTA Vinculada</th>
                  <th className="py-3 px-4">Local (UG)</th>
                  <th className="py-3 px-4">Vigência</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recorrencias.map((item) => {
                  const area = areas.find((a) => a.id === item.area_empresa_id);
                  const ptaObj = ptas.find((p) => p.id === item.pta_id);
                  const loc = locais.find((l) => l.id === item.local_id);

                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        {item.ativo ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Ativa
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">
                            Inativa
                          </span>
                        )}
                        {item.prioritario && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#F5D800] text-black">
                            ★ Prioritário
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <strong className="text-gray-900 block">{getDayOfWeekName(item.dia_semana)}</strong>
                        <span className="text-[11px] text-gray-500 capitalize">{item.frequencia}</span>
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-900">{item.tipo_atividade}</td>
                      <td className="py-3 px-4 text-gray-700">{area?.nome || 'Área'}</td>
                      <td className="py-3 px-4 text-gray-700">
                        {ptaObj ? (
                          <span className="font-semibold text-gray-900">
                            {ptaObj.patrimonio} ({ptaObj.tipo})
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Qualquer disponível</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {loc ? `${loc.ug} • ${loc.setor_linha}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-[11px] whitespace-nowrap">
                        {formatDateBR(item.vigencia_inicio)} até {formatDateBR(item.vigencia_fim)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(item)}
                            className="p-1 text-gray-500 hover:text-black hover:bg-gray-100 rounded"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Gerar Agendamentos (RPC) */}
      {gerarModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-gray-200 overflow-hidden">
            <div className="bg-[#1A1A1A] text-white px-6 py-4 flex items-center justify-between border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Play className="w-5 h-5 text-[#F5D800]" />
                <h3 className="text-base font-bold">Executar Geração Recorrente</h3>
              </div>
              <button
                onClick={() => setGerarModalOpen(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecutarRpc} className="p-6 space-y-4">
              <p className="text-xs text-gray-600 leading-relaxed">
                Esta rotina chama a procedure do banco de dados (
                <code className="bg-gray-100 px-1 py-0.5 rounded text-amber-900 font-mono">
                  gerar_agendamentos_recorrentes
                </code>
                ) para criar automaticamente as reservas no período especificado.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Data Início da Janela *
                  </label>
                  <input
                    type="date"
                    required
                    value={gerarInicio}
                    onChange={(e) => setGerarInicio(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Data Término da Janela *
                  </label>
                  <input
                    type="date"
                    required
                    value={gerarFim}
                    onChange={(e) => setGerarFim(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white"
                  />
                </div>
              </div>

              {resultadoGeracao !== null && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Geração Realizada com Sucesso!</span>
                    <span>
                      {resultadoGeracao.count} agendamento(s) foram inseridos na agenda para este período.
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-gray-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setGerarModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={executingRpc}
                  className="px-4 py-1.5 text-xs font-bold text-black bg-[#F5D800] hover:bg-[#e4c900] border border-amber-400 rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {executingRpc ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Processando RPC...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Gerar Agendamentos</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Create/Edit Regra */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-gray-200 overflow-hidden my-6">
            <div className="bg-[#F5D800] px-6 py-4 flex items-center justify-between border-b border-amber-300">
              <h3 className="text-base font-bold text-black flex items-center gap-2">
                <Repeat className="w-4 h-4" />
                {editingItem ? 'Editar Regra Recorrente' : 'Nova Regra Recorrente'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-black/70 hover:text-black p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-3.5 max-h-[78vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Área / Empresa Solicitante *
                </label>
                <select
                  value={areaEmpresaId}
                  onChange={(e) => setAreaEmpresaId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">Selecione...</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome} ({a.tipo})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    PTA Específica (Opcional)
                  </label>
                  <select
                    value={ptaId}
                    onChange={(e) => setPtaId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">Qualquer PTA disponível</option>
                    {ptas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.patrimonio} ({p.tipo})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Local de Uso (UG / Setor) *
                  </label>
                  <select
                    value={localId}
                    onChange={(e) => setLocalId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">Selecione o local...</option>
                    {locais.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.ug} — {l.setor_linha}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Dia da Semana *
                  </label>
                  <select
                    value={diaSemana}
                    onChange={(e) => setDiaSemana(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-medium"
                  >
                    <option value={1}>Segunda-feira</option>
                    <option value={2}>Terça-feira</option>
                    <option value={3}>Quarta-feira</option>
                    <option value={4}>Quinta-feira</option>
                    <option value={5}>Sexta-feira</option>
                    <option value={6}>Sábado</option>
                    <option value={0}>Domingo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Frequência *
                  </label>
                  <select
                    value={frequencia}
                    onChange={(e) => setFrequencia(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-medium"
                  >
                    <option value="semanal">Semanal</option>
                    <option value="quinzenal">Quinzenal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Tipo de Atividade *
                </label>
                <input
                  type="text"
                  required
                  value={tipoAtividade}
                  onChange={(e) => setTipoAtividade(e.target.value)}
                  placeholder="Ex: Limpeza CIP, Inspeção Semanal, Manutenção..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Vigência Início *
                  </label>
                  <input
                    type="date"
                    required
                    value={vigenciaInicio}
                    onChange={(e) => setVigenciaInicio(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Vigência Fim *
                  </label>
                  <input
                    type="date"
                    required
                    value={vigenciaFim}
                    onChange={(e) => setVigenciaFim(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-800">
                  <input
                    type="checkbox"
                    checked={prioritario}
                    onChange={(e) => setPrioritario(e.target.checked)}
                    className="w-4 h-4 text-amber-500 rounded border-gray-300"
                  />
                  <span>Prioritário (destaque em amarelo)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-800">
                  <input
                    type="checkbox"
                    checked={ativo}
                    onChange={(e) => setAtivo(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-gray-300"
                  />
                  <span>Regra Ativa</span>
                </label>
              </div>

              <div className="pt-3 border-t border-gray-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 text-xs font-bold text-black bg-[#F5D800] hover:bg-[#e4c900] border border-amber-400 rounded-lg shadow-xs disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar Regra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
