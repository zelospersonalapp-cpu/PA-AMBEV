import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  Calendar,
  Clock,
  Truck,
  Building,
  User,
  MapPin,
  CheckCircle,
  FileText,
  PlusCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase, checkPtaConflict, formatSupabaseError } from '../lib/supabase';
import { useToast } from './Toast';
import type { PTA, AreaEmpresa, Colaborador, Local, Agendamento } from '../types';
import { formatDateBR } from '../lib/formatters';

interface AgendamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingAgendamento?: Agendamento | null;
  initialDate?: string;
  initialPtaId?: string;
}

export const AgendamentoModal: React.FC<AgendamentoModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingAgendamento,
  initialDate,
  initialPtaId,
}) => {
  const toast = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // Aux data
  const [ptas, setPtas] = useState<PTA[]>([]);
  const [areas, setAreas] = useState<AreaEmpresa[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [locais, setLocais] = useState<Local[]>([]);

  // Form fields
  const [ptaId, setPtaId] = useState('');
  const [areaEmpresaId, setAreaEmpresaId] = useState('');
  const [solicitanteId, setSolicitanteId] = useState('');

  // Cascading Local fields
  const [selectedUG, setSelectedUG] = useState('');
  const [localId, setLocalId] = useState('');

  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [tipoAtividade, setTipoAtividade] = useState('Manutenção');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState<'normal' | 'prioritario'>('normal');
  const [observacoes, setObservacoes] = useState('');

  // Load auxiliary records on mount or modal open
  useEffect(() => {
    if (!isOpen) return;

    async function loadFormData() {
      try {
        const [ptasRes, areasRes, colabsRes, locaisRes] = await Promise.all([
          supabase.from('ptas').select('*').order('patrimonio', { ascending: true }),
          supabase.from('areas_empresas').select('*').eq('ativo', true).order('nome', { ascending: true }),
          supabase.from('colaboradores').select('*').eq('ativo', true).eq('papel', 'solicitante').order('nome', { ascending: true }),
          supabase.from('locais').select('*').eq('ativo', true).order('ug', { ascending: true }),
        ]);

        if (ptasRes.data) setPtas(ptasRes.data);
        if (areasRes.data) setAreas(areasRes.data);
        if (colabsRes.data) setColaboradores(colabsRes.data);
        if (locaisRes.data) setLocais(locaisRes.data);
      } catch (err) {
        console.error('Erro ao carregar dados do formulário:', err);
      }
    }

    loadFormData();
  }, [isOpen]);

  // Populate or reset form values
  useEffect(() => {
    if (!isOpen) return;

    if (editingAgendamento) {
      setPtaId(editingAgendamento.pta_id);
      setAreaEmpresaId(editingAgendamento.area_empresa_id);
      setSolicitanteId(editingAgendamento.solicitante_id);
      setLocalId(editingAgendamento.local_id);
      setDataInicio(editingAgendamento.data_inicio ? editingAgendamento.data_inicio.substring(0, 10) : '');
      setDataFim(editingAgendamento.data_fim ? editingAgendamento.data_fim.substring(0, 10) : '');
      setTipoAtividade(editingAgendamento.tipo_atividade || 'Manutenção');
      setDescricao(editingAgendamento.descricao || '');
      setPrioridade(editingAgendamento.prioridade || 'normal');
      setObservacoes(editingAgendamento.observacoes || '');
    } else {
      // Defaults for new
      const today = initialDate || new Date().toISOString().substring(0, 10);
      setPtaId(initialPtaId || '');
      setAreaEmpresaId('');
      setSolicitanteId('');
      setSelectedUG('');
      setLocalId('');
      setDataInicio(today);
      setDataFim(today);
      setTipoAtividade('Manutenção Geral');
      setDescricao('');
      setPrioridade('normal');
      setObservacoes('');
      setConflictWarning(null);
    }
  }, [isOpen, editingAgendamento, initialDate, initialPtaId]);

  // When localId changes or editingAgendamento is loaded, sync UG selector
  useEffect(() => {
    if (localId && locais.length > 0) {
      const loc = locais.find((l) => l.id === localId);
      if (loc) {
        setSelectedUG(loc.ug);
      }
    }
  }, [localId, locais]);

  // Available UGs from locais
  const uniqueUGs = Array.from(new Set(locais.map((l) => l.ug))).filter(Boolean);
  // Available Locais filtered by chosen UG
  const filteredLocais = selectedUG
    ? locais.filter((l) => l.ug === selectedUG)
    : locais;

  // Filter solicitantes by chosen Area if area has employees
  const filteredColaboradores = areaEmpresaId
    ? colaboradores.filter((c) => !c.area_empresa_id || c.area_empresa_id === areaEmpresaId)
    : colaboradores;

  // Real-time conflict preview check
  useEffect(() => {
    if (!ptaId || !dataInicio || !dataFim) {
      setConflictWarning(null);
      return;
    }

    if (dataInicio > dataFim) {
      setConflictWarning('A data de início não pode ser posterior à data de término.');
      return;
    }

    let isSubscribed = true;
    setCheckingConflict(true);

    const timer = setTimeout(async () => {
      const { hasConflict, conflictingAgendamentos } = await checkPtaConflict(
        ptaId,
        dataInicio,
        dataFim,
        editingAgendamento?.id
      );

      if (isSubscribed) {
        setCheckingConflict(false);
        if (hasConflict && conflictingAgendamentos.length > 0) {
          const c = conflictingAgendamentos[0];
          setConflictWarning(
            `Atenção: Esta PTA já possui agendamento de ${formatDateBR(c.data_inicio)} até ${formatDateBR(c.data_fim)} (${c.tipo_atividade}). O banco de dados rejeitará a sobreposição.`
          );
        } else {
          setConflictWarning(null);
        }
      }
    }, 350);

    return () => {
      isSubscribed = false;
      clearTimeout(timer);
    };
  }, [ptaId, dataInicio, dataFim, editingAgendamento]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ptaId) {
      toast.warning('Selecione uma PTA', 'A escolha da plataforma é obrigatória.');
      return;
    }
    if (!areaEmpresaId) {
      toast.warning('Selecione a Área/Empresa', 'Informe a área solicitante.');
      return;
    }
    if (!solicitanteId) {
      toast.warning('Selecione o Solicitante', 'Informe o colaborador responsável.');
      return;
    }
    if (!localId) {
      toast.warning('Selecione o Local', 'Selecione a UG de uso.');
      return;
    }
    if (!dataInicio || !dataFim) {
      toast.warning('Datas inválidas', 'Informe as datas de início e término.');
      return;
    }
    if (dataInicio > dataFim) {
      toast.error('Período Inválido', 'A data de início não pode ser posterior ao término.');
      return;
    }

    setLoading(true);

    try {
      // Calculate duration in days
      const d1 = new Date(dataInicio).getTime();
      const d2 = new Date(dataFim).getTime();
      const duracaoDias = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);

      const payload = {
        pta_id: ptaId,
        area_empresa_id: areaEmpresaId,
        solicitante_id: solicitanteId,
        local_id: localId,
        data_inicio: dataInicio,
        data_fim: dataFim,
        duracao_dias: duracaoDias,
        tipo_atividade: tipoAtividade,
        descricao: descricao || null,
        prioridade,
        observacoes: observacoes || null,
      };

      if (editingAgendamento) {
        const { error } = await supabase
          .from('agendamentos')
          .update(payload)
          .eq('id', editingAgendamento.id);

        if (error) throw error;
        toast.success('Agendamento Atualizado', 'As alterações foram salvas com sucesso.');
      } else {
        const { error } = await supabase.from('agendamentos').insert([
          {
            ...payload,
            status: 'agendado',
            origem: 'avulso',
          },
        ]);

        if (error) throw error;
        toast.success('Agendamento Criado', 'Plataforma reservada com sucesso.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar agendamento:', err);
      // Explicit UX requirement: handle exclusion_violation 23P01
      const friendlyMessage = formatSupabaseError(err);
      toast.error('Conflito ou Erro no Agendamento', friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedPtaObj = ptas.find((p) => p.id === ptaId);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-gray-200 overflow-hidden my-8">
        {/* Header with AmBev dark navy */}
        <div className="border-b border-[#152238] bg-[#1B2A4A] px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-[#F5D800]" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              {editingAgendamento ? 'Editar Agendamento de PTA' : 'Novo Agendamento de PTA'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conflict Warning Box */}
        {conflictWarning && (
          <div className="mx-6 mt-4 p-3.5 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-3 text-sm text-rose-800 animate-fadeIn">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Conflito de Reserva Detectado</div>
              <div className="text-xs mt-0.5 leading-relaxed">{conflictWarning}</div>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* PTA Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Plataforma Elevatória (PTA) *
            </label>
            <select
              value={ptaId}
              onChange={(e) => setPtaId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5D800] focus:border-amber-400 bg-white"
            >
              <option value="">Selecione uma PTA cadastrada...</option>
              {ptas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.patrimonio} — {p.tipo === 'articulada' ? 'Articulada' : 'Tesourinha'} ({p.modelo}) | Bateria: {p.nivel_bateria}% | Status: {p.status}
                </option>
              ))}
            </select>
            {selectedPtaObj && (
              <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-gray-600">
                <span className="px-2 py-0.5 bg-gray-100 rounded border border-gray-200">
                  Tipo: <strong>{selectedPtaObj.tipo}</strong>
                </span>
                <span className="px-2 py-0.5 bg-gray-100 rounded border border-gray-200">
                  Fabricante: {selectedPtaObj.fabricante}
                </span>
                <span className="px-2 py-0.5 bg-gray-100 rounded border border-gray-200">
                  Capacidade: {selectedPtaObj.capacidade_kg} kg
                </span>
                <span className="px-2 py-0.5 bg-gray-100 rounded border border-gray-200">
                  Altura: {selectedPtaObj.altura_max_m} m
                </span>
              </div>
            )}
          </div>

          {/* Area and Solicitante */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Liberador *
              </label>
              <select
                value={areaEmpresaId}
                onChange={(e) => setAreaEmpresaId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5D800] focus:border-amber-400 bg-white"
              >
                <option value="">Selecione a Área ou Terceira...</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome} ({a.tipo === 'area_interna' ? 'Interna' : 'Terceira'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Solicitante *
              </label>
              <select
                value={solicitanteId}
                onChange={(e) => setSolicitanteId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5D800] focus:border-amber-400 bg-white"
              >
                <option value="">Selecione o solicitante...</option>
                {filteredColaboradores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} (Matrícula: {c.matricula})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Local - UG única */}
          <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200 space-y-2">
            <div className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-amber-500" />
              UG / Localização na Fábrica *
            </div>
            <select
              value={localId}
              onChange={(e) => {
                const id = e.target.value;
                setLocalId(id);
                const match = locais.find((l) => l.id === id);
                if (match) setSelectedUG(match.ug);
              }}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5D800] focus:border-amber-400 bg-white"
            >
              <option value="">Selecione a UG...</option>
              {locais.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.ug}{loc.descricao && loc.descricao !== loc.ug ? ` — ${loc.descricao}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Dates & Period */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Data Início *
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5D800] bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Data Término *
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5D800] bg-white"
                />
              </div>
            </div>
          </div>

          {/* Activity Type & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Tipo de Atividade *
              </label>
              <input
                type="text"
                value={tipoAtividade}
                onChange={(e) => setTipoAtividade(e.target.value)}
                placeholder="Ex: Manutenção Elétrica, Inspeção de Linha..."
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5D800] bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Prioridade
              </label>
              <div className="flex rounded-lg border border-gray-300 p-1 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setPrioridade('normal')}
                  className={`flex-1 py-1 text-xs font-medium rounded transition-all ${
                    prioridade === 'normal'
                      ? 'bg-white text-gray-900 shadow-xs border border-gray-200'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setPrioridade('prioritario')}
                  className={`flex-1 py-1 text-xs font-bold rounded transition-all ${
                    prioridade === 'prioritario'
                      ? 'bg-[#F5D800] text-[#1B2A4A] shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  ★ Prioritário
                </button>
              </div>
            </div>
          </div>

          {/* Descrição & Observações */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Descrição da Atividade
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              placeholder="Detalhes operacionais sobre o trabalho a ser executado na PTA..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1B2A4A] bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Observações Gerais
            </label>
            <input
              type="text"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Avisos para liberação, operadores autorizados, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1B2A4A] bg-white"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || Boolean(conflictWarning && conflictWarning.includes('A data de início'))}
              className="px-5 py-2 text-sm font-bold text-white bg-[#1B2A4A] hover:bg-[#152238] rounded-lg shadow-xs transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 text-[#F5D800]" />
                  <span>{editingAgendamento ? 'Salvar Alterações' : 'Confirmar Agendamento'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
