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
  const [loading, setLoading] = useState(false);
  const [novoSolicitanteOpen, setNovoSolicitanteOpen] = useState(false);
  const [novoSolNome, setNovoSolNome] = useState('');
  const [novoSolContato, setNovoSolContato] = useState('');
  const [novoSolAreaId, setNovoSolAreaId] = useState('');
  const [savingSol, setSavingSol] = useState(false);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [conflictAgendamento, setConflictAgendamento] = useState<any | null>(null);
  const [cancelingConflict, setCancelingConflict] = useState(false);

  // Aux data
  const [ptas, setPtas] = useState<PTA[]>([]);
  const [areas, setAreas] = useState<AreaEmpresa[]>([]);
  const [liberadores, setLiberadores] = useState<Colaborador[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [locais, setLocais] = useState<Local[]>([]);

  // Form fields
  const [ptaId, setPtaId] = useState('');
  const [areaEmpresaId, setAreaEmpresaId] = useState('');
  const [liberadorId, setLiberadorId] = useState('');
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
  const [repeticao, setRepeticao] = useState<'nenhuma' | 'diaria' | 'semanal' | 'quinzenal' | 'mensal'>('nenhuma');
  const [repeticaoPopupOpen, setRepeticaoPopupOpen] = useState(false);
  const [repeticaoPendente, setRepeticaoPendente] = useState<'diaria' | 'semanal' | 'quinzenal' | 'mensal' | null>(null);
  const [repeticaoFim, setRepeticaoFim] = useState('');
  const [repeticaoIndefinida, setRepeticaoIndefinida] = useState(false);

  // Load auxiliary records on mount or modal open
  useEffect(() => {
    if (!isOpen) return;

    async function loadFormData() {
      try {
        const [ptasRes, areasRes, liberadoresRes, colabsRes, locaisRes] = await Promise.all([
          supabase.from('ptas').select('*').order('patrimonio', { ascending: true }),
          supabase.from('areas_empresas').select('*').eq('ativo', true).order('nome', { ascending: true }),
          supabase.from('colaboradores').select('*').eq('ativo', true).eq('papel', 'liberador').order('nome', { ascending: true }),
          supabase.from('colaboradores').select('*').eq('ativo', true).eq('papel', 'solicitante').order('nome', { ascending: true }),
          supabase.from('locais').select('*').eq('ativo', true).order('ug', { ascending: true }),
        ]);

        if (ptasRes.data) setPtas(ptasRes.data);
        if (areasRes.data) setAreas(areasRes.data);
        if (liberadoresRes.data) setLiberadores(liberadoresRes.data);
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
      setLiberadorId(editingAgendamento.liberado_por || '');
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
      setLiberadorId('');
      setSolicitanteId('');
      setAreaEmpresaId('');
      setSelectedUG('');
      setLocalId('');
      setDataInicio(today);
      setDataFim(today);
      setTipoAtividade('Manutenção Geral');
      setDescricao('');
      setPrioridade('normal');
      setObservacoes('');
    setRepeticao('nenhuma');
    setRepeticaoPopupOpen(false);
    setRepeticaoPendente(null);
    setRepeticaoFim('');
    setRepeticaoIndefinida(false);
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

  const filteredColaboradores = colaboradores;

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
          setConflictAgendamento(c);
          setConflictWarning(
            `Atenção: Esta PTA já possui agendamento de ${formatDateBR(c.data_inicio)} até ${formatDateBR(c.data_fim)} (${c.tipo_atividade}). O banco de dados rejeitará a sobreposição.`
          );
        } else {
          setConflictWarning(null);
          setConflictAgendamento(null);
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
      const payload = {
        pta_id: ptaId,
        solicitante_id: solicitanteId,
        area_empresa_id: areaEmpresaId || null,
        liberado_por: liberadorId || null,
        local_id: localId,
        data_inicio: dataInicio,
        data_fim: dataFim,
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

        // Gerar repetições se selecionado
        if (repeticao !== 'nenhuma') {
          const intervaloDias = repeticao === 'diaria' ? 1 : repeticao === 'semanal' ? 7 : repeticao === 'quinzenal' ? 14 : 30;
          const maxRep = repeticaoIndefinida ? 104 : repeticao === 'diaria' ? 365 : repeticao === 'mensal' ? 24 : 52;
          const limiteData = !repeticaoIndefinida && repeticaoFim ? new Date(repeticaoFim + 'T23:59:59') : null;
          const duracaoDias = Math.max(1, Math.round((new Date(dataFim).getTime() - new Date(dataInicio).getTime()) / 86400000));
          const extras: any[] = [];
          for (let i = 1; i <= maxRep; i++) {
            const ini = new Date(dataInicio);
            ini.setDate(ini.getDate() + intervaloDias * i);
            if (limiteData && ini > limiteData) break;
            const fim = new Date(ini);
            fim.setDate(fim.getDate() + duracaoDias);
            extras.push({
              ...payload,
              status: 'agendado',
              origem: 'recorrente',
              data_inicio: ini.toISOString().substring(0, 10),
              data_fim: fim.toISOString().substring(0, 10),
            });
          }
          if (extras.length > 0) {
            await supabase.from('agendamentos').insert(extras);
          }
        }
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

        {/* Conflict Warning — apenas texto simples inline quando não há dados completos */}
        {conflictWarning && !conflictAgendamento && (
          <div className="mx-6 mt-4 p-3.5 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-3 text-sm text-rose-800">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Conflito de Reserva</div>
              <div className="text-xs mt-0.5">{conflictWarning}</div>
            </div>
          </div>
        )}

        {/* Popup Modal de Conflito */}
        {conflictAgendamento && (
          <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-rose-200 overflow-hidden">
              <div className="bg-rose-600 px-5 py-3.5 flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-white shrink-0" />
                <span className="text-sm font-bold text-white uppercase tracking-wide">PTA com agendamento em vigor</span>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
                  <div>
                    <span className="block text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-0.5">Solicitante</span>
                    <span className="font-semibold text-gray-900">{conflictAgendamento.solicitante || conflictAgendamento.solicitante_nome || '—'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-0.5">Área / Empresa</span>
                    <span className="font-semibold text-gray-900">{conflictAgendamento.area_empresa || conflictAgendamento.area_nome || '—'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-0.5">Período</span>
                    <span className="font-semibold text-gray-900">{formatDateBR(conflictAgendamento.data_inicio)} → {formatDateBR(conflictAgendamento.data_fim)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-0.5">Atividade</span>
                    <span className="font-semibold text-gray-900">{conflictAgendamento.tipo_atividade || '—'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-0.5">Status</span>
                    <span className="font-semibold text-gray-900 capitalize">{conflictAgendamento.status || '—'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-0.5">Local (UG)</span>
                    <span className="font-semibold text-gray-900">{conflictAgendamento.ug || conflictAgendamento.local_completo || '—'}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">
                  Deseja cancelar este agendamento para usar a PTA nas suas datas? O agendamento acima será marcado como cancelado.
                </p>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => { setConflictAgendamento(null); setConflictWarning(null); }}
                    className="flex-1 py-2.5 px-4 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Manter e Fechar
                  </button>
                  <button
                    type="button"
                    disabled={cancelingConflict}
                    onClick={async () => {
                      setCancelingConflict(true);
                      try {
                        const { error } = await supabase
                          .from('agendamentos')
                          .update({ status: 'cancelado' })
                          .eq('id', conflictAgendamento.id);
                        if (error) throw error;
                        setConflictWarning(null);
                        setConflictAgendamento(null);
                      } catch (err: any) {
                        alert('Erro ao cancelar: ' + err.message);
                      } finally {
                        setCancelingConflict(false);
                      }
                    }}
                    className="flex-1 py-2.5 px-4 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    {cancelingConflict
                      ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Cancelando...</span></>
                      : <><X className="w-4 h-4" /><span>Cancelar e liberar PTA</span></>
                    }
                  </button>
                </div>
              </div>
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

          {/* Liberador + Solicitante + Empresa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Liberador *
              </label>
              <select
                value={liberadorId}
                onChange={(e) => setLiberadorId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5D800] focus:border-amber-400 bg-white"
              >
                <option value="">Selecione o liberador...</option>
                {liberadores.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Solicitante *
              </label>
              <div className="flex gap-2">
                <select
                  value={solicitanteId}
                  onChange={(e) => setSolicitanteId(e.target.value)}
                  required
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5D800] focus:border-amber-400 bg-white"
                >
                  <option value="">Selecione o solicitante...</option>
                  {filteredColaboradores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  title="Cadastrar novo solicitante"
                  onClick={() => { setNovoSolNome(''); setNovoSolContato(''); setNovoSolAreaId(''); setNovoSolicitanteOpen(true); }}
                  className="px-2.5 py-2 bg-[#1B2A4A] hover:bg-[#243656] text-white rounded-lg flex items-center justify-center shrink-0"
                >
                  <PlusCircle className="w-4 h-4" />
                </button>
              </div>
              {filteredColaboradores.length === 0 && (
                <p className="text-[11px] text-amber-700 mt-1">Nenhum solicitante cadastrado. Clique em + para cadastrar.</p>
              )}
            </div>
          </div>

          {/* Empresa do Solicitante */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Empresa do Solicitante
            </label>
            <select
              value={areaEmpresaId}
              onChange={(e) => setAreaEmpresaId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5D800] focus:border-amber-400 bg-white"
            >
              <option value="">Selecione a empresa...</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
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
                Data da Retirada *
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => {
                    const novaInicio = e.target.value;
                    setDataInicio(novaInicio);
                    if (dataFim && novaInicio > dataFim) {
                      setDataFim(novaInicio);
                    }
                  }}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5D800] bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Data da Entrega *
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

          {/* Mini-modal: Cadastrar Novo Solicitante */}
          {novoSolicitanteOpen && (
            <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden">
                <div className="bg-[#1B2A4A] px-5 py-4 flex items-center justify-between text-white">
                  <h3 className="font-bold text-sm">Novo Solicitante</h3>
                  <button onClick={() => setNovoSolicitanteOpen(false)} className="text-gray-300 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Nome Completo *</label>
                    <input
                      type="text"
                      value={novoSolNome}
                      onChange={(e) => setNovoSolNome(e.target.value)}
                      placeholder="Ex: João Silva"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#F5D800]"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Contato</label>
                    <input
                      type="text"
                      value={novoSolContato}
                      onChange={(e) => setNovoSolContato(e.target.value)}
                      placeholder="Telefone ou e-mail"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#F5D800]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Empresa</label>
                    <select
                      value={novoSolAreaId}
                      onChange={(e) => setNovoSolAreaId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#F5D800]"
                    >
                      <option value="">Sem vínculo específico</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>{a.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="pt-3 border-t border-gray-200 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setNovoSolicitanteOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={savingSol || !novoSolNome.trim()}
                      onClick={async () => {
                        if (!novoSolNome.trim()) return;
                        setSavingSol(true);
                        try {
                          const { data, error } = await supabase
                            .from('colaboradores')
                            .insert([{
                              nome: novoSolNome.trim(),
                              contato: novoSolContato || null,
                              area_empresa_id: novoSolAreaId || null,
                              papel: 'solicitante',
                              ativo: true,
                            }])
                            .select()
                            .single();
                          if (error) throw error;
                          // Atualizar lista e selecionar o novo solicitante
                          setColaboradores((prev) => [...prev, data]);
                          setSolicitanteId(data.id);
                          setNovoSolicitanteOpen(false);
                        } catch (err: any) {
                          console.error(err);
                        } finally {
                          setSavingSol(false);
                        }
                      }}
                      className="px-5 py-2 text-sm font-bold text-white bg-[#1B2A4A] hover:bg-[#152238] rounded-lg disabled:opacity-50 flex items-center gap-2"
                    >
                      {savingSol
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <CheckCircle className="w-4 h-4 text-[#F5D800]" />}
                      Cadastrar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Repetição */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              🔁 Repetir Agendamento
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {([
                { val: 'nenhuma', label: 'Não repetir' },
                { val: 'diaria', label: 'Diário' },
                { val: 'semanal', label: 'Semanal' },
                { val: 'quinzenal', label: 'Quinzenal' },
                { val: 'mensal', label: 'Mensal' },
              ] as const).map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => {
                    if (opt.val === 'nenhuma') {
                      setRepeticao('nenhuma');
                      setRepeticaoFim('');
                      setRepeticaoIndefinida(false);
                    } else {
                      setRepeticaoPendente(opt.val);
                      setRepeticaoPopupOpen(true);
                    }
                  }}
                  className={`py-1.5 px-1 text-[11px] font-semibold rounded-lg border text-center transition-all ${
                    repeticao === opt.val
                      ? 'bg-[#1B2A4A] text-white border-[#1B2A4A]'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-[#1B2A4A]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {repeticao !== 'nenhuma' && (
              <p className="text-[11px] text-blue-700 mt-2">
                ✅ Repetição <strong>{repeticao}</strong> configurada
                {repeticaoIndefinida ? ' — sem data de término (indefinida)' : repeticaoFim ? ` — até ${new Date(repeticaoFim + 'T12:00:00').toLocaleDateString('pt-BR')}` : ''}.
              </p>
            )}
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
      {/* Popup de configuração de recorrência */}
      {repeticaoPopupOpen && repeticaoPendente && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full border border-gray-200 overflow-hidden">
            <div className="bg-[#1B2A4A] px-5 py-3.5 flex items-center gap-2">
              <span className="text-lg">🔁</span>
              <span className="text-sm font-bold text-white capitalize">Repetição {repeticaoPendente}</span>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                Deseja definir uma data de término para esta recorrência?
              </p>

              <div className="space-y-2">
                <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="repeticao_fim"
                    checked={!repeticaoIndefinida}
                    onChange={() => setRepeticaoIndefinida(false)}
                    className="w-4 h-4 text-[#1B2A4A]"
                  />
                  <div>
                    <div className="text-sm font-semibold text-gray-800">Com data de término</div>
                    <div className="text-xs text-gray-500">Repetir até uma data específica</div>
                  </div>
                </label>

                {!repeticaoIndefinida && (
                  <input
                    type="date"
                    value={repeticaoFim}
                    min={dataInicio}
                    onChange={(e) => setRepeticaoFim(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white ml-6"
                  />
                )}

                <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="repeticao_fim"
                    checked={repeticaoIndefinida}
                    onChange={() => { setRepeticaoIndefinida(true); setRepeticaoFim(''); }}
                    className="w-4 h-4 text-[#1B2A4A]"
                  />
                  <div>
                    <div className="text-sm font-semibold text-gray-800">Sem data de término</div>
                    <div className="text-xs text-gray-500">Repetir indefinidamente (até 2 anos)</div>
                  </div>
                </label>
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => { setRepeticaoPopupOpen(false); setRepeticaoPendente(null); }}
                  className="flex-1 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!repeticaoIndefinida && !repeticaoFim}
                  onClick={() => {
                    if (repeticaoPendente) setRepeticao(repeticaoPendente);
                    setRepeticaoPopupOpen(false);
                    setRepeticaoPendente(null);
                  }}
                  className="flex-1 py-2 text-sm font-bold text-white bg-[#1B2A4A] hover:bg-[#152238] disabled:opacity-40 rounded-lg transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
