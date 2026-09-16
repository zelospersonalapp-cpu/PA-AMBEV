import React, { useState, useEffect } from 'react';
import {
  Truck,
  PlusCircle,
  Edit2,
  Battery,
  CalendarPlus,
  AlertTriangle,
  CheckCircle,
  X,
  Search,
  Wrench,
  History,
  Trash2,
  FileText,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import type { PTA, PtaTipo, PtaStatus, VAvariasPTA } from '../types';
import { getPtaStatusConfig } from '../lib/formatters';
import { AgendamentoModal } from '../components/AgendamentoModal';

export const Ptas: React.FC = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [ptas, setPtas] = useState<PTA[]>([]);
  const [avariasPtaList, setAvariasPtaList] = useState<VAvariasPTA[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Modal create/edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPta, setEditingPta] = useState<PTA | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [patrimonio, setPatrimonio] = useState('');
  const [tipo, setTipo] = useState<PtaTipo>('articulada');
  const [modelo, setModelo] = useState('');
  const [fabricante, setFabricante] = useState('');
  const [alturaMax, setAlturaMax] = useState<number>(12);
  const [capacidadeKg, setCapacidadeKg] = useState<number>(230);
  const [numSerie, setNumSerie] = useState('');
  const [nivelBateria, setNivelBateria] = useState<number>(100);
  const [status, setStatus] = useState<PtaStatus>('disponivel');
  const [observacoes, setObservacoes] = useState('');

  // History modal for specific PTA
  const [agendarModalOpen, setAgendarModalOpen] = useState(false);
  const [ptaParaAgendar, setPtaParaAgendar] = useState<PTA | null>(null);
  const [historyPta, setHistoryPta] = useState<PTA | null>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadPtas();
  }, []);

  async function loadPtas() {
    setLoading(true);
    try {
      const [ptasRes, avariasRes] = await Promise.all([
        supabase.from('ptas').select('*').order('patrimonio', { ascending: true }),
        supabase.from('v_avarias_pta').select('*'),
      ]);

      if (ptasRes.data) setPtas(ptasRes.data);
      if (avariasRes.data) setAvariasPtaList(avariasRes.data);
    } catch (err) {
      console.error('Erro ao carregar PTAs:', err);
      toast.error('Erro ao carregar PTAs', 'Verifique a conexão com o Supabase.');
    } finally {
      setLoading(false);
    }
  }

  const openCreateModal = () => {
    setEditingPta(null);
    setPatrimonio('');
    setTipo('articulada');
    setModelo('');
    setFabricante('');
    setAlturaMax(12);
    setCapacidadeKg(230);
    setNumSerie('');
    setNivelBateria(100);
    setStatus('disponivel');
    setObservacoes('');
    setModalOpen(true);
  };

  const openEditModal = (pta: PTA) => {
    setEditingPta(pta);
    setPatrimonio(pta.patrimonio);
    setTipo(pta.tipo);
    setModelo(pta.modelo);
    setFabricante(pta.fabricante);
    setAlturaMax(pta.altura_max_m);
    setCapacidadeKg(pta.capacidade_kg);
    setNumSerie(pta.num_serie || '');
    setNivelBateria(pta.nivel_bateria);
    setStatus(pta.status);
    setObservacoes(pta.observacoes || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!patrimonio.trim()) {
      toast.warning('Patrimônio Obrigatório', 'Informe o código de identificação da PTA.');
      return;
    }
    if (!modelo.trim() || !fabricante.trim()) {
      toast.warning('Dados Incompletos', 'Informe fabricante e modelo.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        patrimonio: patrimonio.trim(),
        tipo,
        modelo: modelo.trim(),
        fabricante: fabricante.trim(),
        altura_max_m: Number(alturaMax),
        capacidade_kg: Number(capacidadeKg),
        num_serie: numSerie.trim() || null,
        nivel_bateria: Number(nivelBateria),
        status,
        observacoes: observacoes.trim() || null,
      };

      if (editingPta) {
        const { error } = await supabase.from('ptas').update(payload).eq('id', editingPta.id);
        if (error) throw error;
        toast.success('PTA Atualizada', 'As alterações foram salvas com sucesso.');
      } else {
        const { error } = await supabase.from('ptas').insert([payload]);
        if (error) throw error;
        toast.success('PTA Cadastrada', 'Nova plataforma inserida no inventário Facilities.');
      }

      setModalOpen(false);
      loadPtas();
    } catch (err: any) {
      console.error('Erro ao salvar PTA:', err);
      toast.error('Erro ao salvar PTA', err.message || 'Falha ao comunicar com o Supabase.');
    } finally {
      setSaving(false);
    }
  };

  const handleExcluirPta = async (pta: PTA) => {
    if (!window.confirm(`Excluir PTA ${pta.patrimonio}? Esta ação não pode ser desfeita.`)) return;
    try {
      const { error } = await supabase.from('ptas').delete().eq('id', pta.id);
      if (error) throw error;
      toast.success('PTA Excluída', `PTA ${pta.patrimonio} removida com sucesso.`);
      loadData();
    } catch (err: any) {
      toast.error('Erro ao excluir', err.message);
    }
  };

  const openHistory = async (pta: PTA) => {
    setHistoryPta(pta);
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('avarias')
        .select('*')
        .eq('pta_id', pta.id)
        .order('data_avaria', { ascending: false });

      if (error) throw error;
      setHistoryList(data || []);
    } catch (err: any) {
      toast.error('Erro ao buscar histórico', err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Filtered PTAs
  const filteredPtas = ptas.filter((p) => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match =
        p.patrimonio.toLowerCase().includes(q) ||
        p.modelo.toLowerCase().includes(q) ||
        p.fabricante.toLowerCase().includes(q) ||
        (p.num_serie && p.num_serie.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (filterTipo && p.tipo !== filterTipo) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#1A1A1A] flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-500" />
            Cadastro e Gestão de PTAs
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Inventário de Plataformas Articuladas e Tesourinhas, nível de bateria e status de prontidão.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1B2A4A] hover:bg-[#152238] text-white font-bold text-xs sm:text-sm rounded-lg shadow-xs transition-colors"
        >
          <PlusCircle className="w-4 h-4 text-[#F5D800]" />
          <span>Cadastrar Nova PTA</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por patrimônio, modelo, fabricante ou nº de série..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B2A4A] bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="px-2.5 py-2 border border-gray-300 rounded-lg text-xs bg-white"
          >
            <option value="">Todos os Tipos</option>
            <option value="articulada">Articulada</option>
            <option value="tesourinha">Tesourinha</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-2 border border-gray-300 rounded-lg text-xs bg-white"
          >
            <option value="">Todos os Status</option>
            <option value="disponivel">Disponível</option>
            <option value="em_uso">Em Uso</option>
            <option value="em_manutencao">Em Manutenção</option>
            <option value="avariada">Avariada</option>
            <option value="inativa">Inativa</option>
          </select>
        </div>
      </div>

      {/* PTAs Grid / Cards */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-[#1B2A4A] border-t-transparent rounded-full animate-spin" />
          <span>Carregando inventário de PTAs...</span>
        </div>
      ) : filteredPtas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 text-[#1B2A4A] flex items-center justify-center mx-auto mb-3">
            <Truck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-gray-900">
            {ptas.length === 0 ? 'Nenhuma PTA cadastrada ainda' : 'Nenhuma PTA encontrada'}
          </h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            {ptas.length === 0
              ? 'Comece cadastrando as plataformas elevatórias (articuladas ou tesourinhas) disponíveis na cervejaria.'
              : 'Nenhum equipamento coincide com os critérios de busca.'}
          </p>
          {ptas.length === 0 && (
            <button
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 bg-[#1B2A4A] hover:bg-[#152238] text-white font-bold text-xs rounded-lg shadow-xs transition-colors"
            >
              + Cadastrar Primeira PTA
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPtas.map((item) => {
            const statusConf = getPtaStatusConfig(item.status);
            const avariaStat = avariasPtaList.find((a) => a.pta_id === item.id);

            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between hover:border-amber-400 transition-all relative overflow-hidden"
              >
                <div className="space-y-3">
                  {/* Card Header: Patrimônio & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        Patrimônio
                      </span>
                      <h3 className="text-lg font-bold text-gray-900">{item.patrimonio}</h3>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${statusConf.bg}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />
                      {statusConf.label}
                    </span>
                  </div>

                  {/* Model & Type info */}
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tipo:</span>
                      <strong className="text-gray-900 capitalize">
                        {item.tipo === 'articulada' ? 'Articulada (Braço)' : 'Tesourinha (Pantográfica)'}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Modelo / Fabricante:</span>
                      <span className="font-medium text-gray-900">
                        {item.fabricante} {item.modelo}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Altura Máxima:</span>
                      <span className="font-semibold text-gray-900">{item.altura_max_m} metros</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Capacidade de Carga:</span>
                      <span className="font-semibold text-gray-900">{item.capacidade_kg} kg</span>
                    </div>
                    {item.num_serie && (
                      <div className="flex justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-200">
                        <span>Nº Série:</span>
                        <span className="font-mono">{item.num_serie}</span>
                      </div>
                    )}
                  </div>

                  {/* Battery Level Visual Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 font-medium flex items-center gap-1">
                        <Battery className="w-3.5 h-3.5 text-emerald-600" />
                        Bateria:
                      </span>
                      <span className="font-bold text-gray-900">{item.nivel_bateria}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          item.nivel_bateria > 50
                            ? 'bg-emerald-500'
                            : item.nivel_bateria > 20
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${item.nivel_bateria}%` }}
                      />
                    </div>
                  </div>

                  {/* Avarias counter badge if any */}
                  {avariaStat && avariaStat.avarias_abertas > 0 && (
                    <div className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 p-1.5 rounded flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>{avariaStat.avarias_abertas} avaria(s) aberta(s) no sistema</span>
                    </div>
                  )}
                </div>

                {/* Botão Agendar esta PTA */}
                {(item.status === 'avariada' || item.status === 'em_manutencao') ? (
                  <div className="mt-4 w-full py-2 rounded-lg bg-gray-100 border border-gray-200 text-center text-xs font-semibold text-gray-400 flex items-center justify-center gap-1.5">
                    <CalendarPlus className="w-4 h-4" />
                    Indisponível para agendamento
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setPtaParaAgendar(item); setAgendarModalOpen(true); }}
                    className="mt-4 w-full py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-sm shadow-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <CalendarPlus className="w-4 h-4" />
                    Agendar esta PTA
                  </button>
                )}

                {/* Card Actions */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => openHistory(item)}
                    className="text-xs font-semibold text-gray-600 hover:text-black flex items-center gap-1 hover:underline"
                  >
                    <History className="w-3.5 h-3.5 text-gray-400" />
                    <span>Histórico</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    className="px-3 py-1.5 text-xs font-bold text-gray-800 bg-gray-100 hover:bg-[#F5D800] hover:text-black rounded-lg transition-colors flex items-center gap-1 border border-gray-200"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Editar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExcluirPta(item)}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Excluir</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Create / Edit PTA */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full border border-gray-200 overflow-hidden my-6">
            <div className="bg-[#1B2A4A] text-white px-6 py-4 flex items-center justify-between border-b border-[#152238]">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#F5D800]" />
                <h2 className="text-base font-bold text-white">
                  {editingPta ? `Editar PTA (${editingPta.patrimonio})` : 'Cadastrar Nova PTA'}
                </h2>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-300 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-3.5 max-h-[78vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Patrimônio *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: PTA-01"
                    value={patrimonio}
                    onChange={(e) => setPatrimonio(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Tipo de Plataforma *
                  </label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-medium"
                  >
                    <option value="articulada">Articulada</option>
                    <option value="tesourinha">Tesourinha</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Fabricante *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Genie, JLG, Haulotte"
                    value={fabricante}
                    onChange={(e) => setFabricante(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Modelo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Z-45/25, 1930ES"
                    value={modelo}
                    onChange={(e) => setModelo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Altura Máxima (m) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    required
                    value={alturaMax}
                    onChange={(e) => setAlturaMax(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Capacidade (kg) *
                  </label>
                  <input
                    type="number"
                    min="10"
                    required
                    value={capacidadeKg}
                    onChange={(e) => setCapacidadeKg(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Nº de Série
                  </label>
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={numSerie}
                    onChange={(e) => setNumSerie(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Status Operacional *
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-medium"
                  >
                    <option value="disponivel">Disponível</option>
                    <option value="em_uso">Em Uso</option>
                    <option value="em_manutencao">Em Manutenção</option>
                    <option value="avariada">Avariada</option>
                    <option value="inativa">Inativa</option>
                  </select>
                </div>
              </div>

              {/* Battery level */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                  <span>Nível de Carga da Bateria</span>
                  <span className="font-bold">{nivelBateria}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={nivelBateria}
                  onChange={(e) => setNivelBateria(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Observações Técnicas
                </label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={2}
                  placeholder="Instruções de recarga, histórico de pneus, revisões mecânicas..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                />
              </div>

              <div className="pt-3 border-t border-gray-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#1B2A4A] hover:bg-[#152238] rounded-lg shadow-xs disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Salvando...' : 'Salvar PTA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal for PTA */}
      {historyPta && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full border border-gray-200 overflow-hidden my-6">
            <div className="bg-[#1B2A4A] text-white px-6 py-4 flex items-center justify-between border-b border-[#152238]">
              <div>
                <h3 className="text-base font-bold text-white">
                  Histórico de Ocorrências: {historyPta.patrimonio}
                </h3>
                <p className="text-xs text-gray-300">
                  {historyPta.fabricante} {historyPta.modelo} ({historyPta.tipo})
                </p>
              </div>
              <button
                onClick={() => setHistoryPta(null)}
                className="text-gray-300 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-3 text-xs">
              {historyLoading ? (
                <div className="py-8 text-center text-gray-400">Carregando histórico...</div>
              ) : historyList.length === 0 ? (
                <div className="py-8 text-center text-gray-400">
                  Nenhuma avaria ou ocorrência registrada para esta PTA.
                </div>
              ) : (
                historyList.map((av) => (
                  <div key={av.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900 capitalize">
                        Severidade: {av.severidade}
                      </span>
                      <span className="text-[11px] text-gray-500">{av.data_avaria}</span>
                    </div>
                    <p className="text-gray-700">{av.descricao}</p>
                    <div className="flex justify-between items-center pt-1 text-[11px] text-gray-500 border-t border-gray-100">
                      <span>Status: <strong className="uppercase">{av.status}</strong></span>
                      {av.resolvido_em && <span>Resolvido em: {av.resolvido_em}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
