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


// Componente auxiliar: busca e exibe o agendamento conflitante
const ConflitoBusca: React.FC<{
  ptaId: string;
  dataInicio: string;
  dataFim: string;
  onCancelarConflito: (id: string) => void;
}> = ({ ptaId, dataInicio, dataFim, onCancelarConflito }) => {
  const [agendamento, setAgendamento] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('v_agenda')
        .select('*')
        .eq('pta_id', ptaId)
        .not('status', 'in', '("cancelado","concluido")')
        .lte('data_inicio', dataFim)
        .gte('data_fim', dataInicio)
        .limit(1)
        .maybeSingle();
      setAgendamento(data);
      setLoading(false);
    })();
  }, [ptaId, dataInicio, dataFim]);

  if (loading) return <p className="text-xs text-gray-400 animate-pulse">Buscando agendamento conflitante...</p>;
  if (!agendamento) return null;

  const dtIni = new Date(agendamento.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR');
  const dtFim = new Date(agendamento.data_fim + 'T00:00:00').toLocaleDateString('pt-BR');

  return (
    <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs space-y-2">
      <p className="font-bold text-rose-800">📋 Agendamento em conflito:</p>
      <p className="text-rose-700">
        <strong>{agendamento.area_empresa || agendamento.solicitante || 'Área'}</strong>
        {' — '}{dtIni}{dtIni !== dtFim ? ` até ${dtFim}` : ''}
      </p>
      <p className="text-rose-600">Status: <strong>{agendamento.status?.toUpperCase()}</strong></p>
      <button
        type="button"
        onClick={() => onCancelarConflito(agendamento.id)}
        className="w-full py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
      >
        ❌ Cancelar este agendamento e liberar a PTA
      </button>
    </div>
  );
};

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
  const [notifPopupOpen, setNotifPopupOpen] = useState(false);
  const [notifData, setNotifData] = useState<{ptaPatrimonio: string; ptaTipo: string; dataRetirada: string; dataEntrega: string; solicitanteNome: string; solicitanteContato: string} | null>(null);
  const [novoSolNome, setNovoSolNome] = useState('');
  const [novoSolContato, setNovoSolContato] = useState('');
  const [novoSolAreaId, setNovoSolAreaId] = useState('');
  const [savingSol, setSavingSol] = useState(false);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [conflictAgendamento, setConflictAgendamento] = useState<any | null>(null);
  const [erroPopup, setErroPopup] = useState<string | null>(null);
  const [agendamentoConflitante, setAgendamentoConflitante] = useState<any | null>(null);
  const [conflitoPtaId, setConflitoPtaId] = useState<string | null>(null);
  const [conflitoDataInicio, setConflitoDataInicio] = useState<string | null>(null);
  const [conflitoDataFim, setConflitoDataFim] = useState<string | null>(null);
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
    setErroPopup(null);
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
    let abriuPopup = false;

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

        // Abrir popup de notificação
        const ptaSel = ptas.find((p) => p.id === ptaId);
        const solSel = colaboradores.find((c) => c.id === solicitanteId) || filteredColaboradores.find((c) => c.id === solicitanteId);
        setNotifData({
          ptaPatrimonio: ptaSel?.patrimonio || ptaId,
          ptaTipo: ptaSel?.tipo === 'articulada' ? 'Articulada' : 'Tesourinha',
          dataRetirada: dataInicio,
          dataEntrega: dataFim,
          solicitanteNome: solSel?.nome || 'Solicitante',
          solicitanteContato: solSel?.contato || '',
        });
        setNotifPopupOpen(true);
        abriuPopup = true;

        // Gerar repetições se selecionado
        if (repeticao !== 'nenhuma') {
          const intervaloDias = repeticao === 'diaria' ? 1 : repeticao === 'semanal' ? 7 : repeticao === 'quinzenal' ? 14 : 30;
          const maxRep = repeticao === 'diaria' ? 30 : repeticao === 'mensal' ? 12 : 26;
          const duracaoDias = Math.max(1, Math.round((new Date(dataFim).getTime() - new Date(dataInicio).getTime()) / 86400000));
          const extras: any[] = [];
          for (let i = 1; i <= maxRep; i++) {
            const ini = new Date(dataInicio);
            ini.setDate(ini.getDate() + intervaloDias * i);
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

      if (!abriuPopup) { onSuccess(); onClose(); }
    } catch (err: any) {
      console.error('Erro ao salvar agendamento:', err);
      // Explicit UX requirement: handle exclusion_violation 23P01
      const friendlyMessage = formatSupabaseError(err);
      setErroPopup(friendlyMessage);
      setConflitoPtaId(ptaId);
      setConflitoDataInicio(dataInicio);
      setConflitoDataFim(dataFim);
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
                  Apenas este agendamento específico será cancelado. Os demais agendamentos recorrentes da mesma série continuam ativos.
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


          {/* POPUP DE NOTIFICAÇÃO PÓS-AGENDAMENTO */}
          {notifPopupOpen && notifData && (() => {
            const dtRet = new Date(notifData.dataRetirada + 'T00:00:00').toLocaleDateString('pt-BR');
            const dtEnt = new Date(notifData.dataEntrega + 'T00:00:00').toLocaleDateString('pt-BR');
            const msgTexto = `Olá, ${notifData.solicitanteNome}! Seu agendamento da PTA ${notifData.ptaPatrimonio} (${notifData.ptaTipo}) foi confirmado pelo Facilities. ✅

📅 Retirada: ${dtRet}
📅 Devolução: ${dtEnt}

Para que tudo corra bem, siga as instruções abaixo:

1️⃣ ANTES DE RETIRAR: faça o Check de Extrato da PTA — confira nível de bateria, avarias visíveis e o funcionamento dos controles.

2️⃣ RETIRADA: desconecte do carregador com cuidado e transite somente por locais autorizados.

3️⃣ DURANTE O USO: utilize apenas no local combinado. Qualquer avaria ou problema técnico, avise o Facilities IMEDIATAMENTE.

4️⃣ NA DEVOLUÇÃO: faça um novo Check de Extrato e entregue a PTA limpa e sem danos no local de origem.

5️⃣ CARREGAMENTO: logo após devolver, conecte a PTA no MESMO carregador que estava sendo usado.

6️⃣ SE FICAR PARA O DIA SEGUINTE: deixe a plataforma carregando no local onde ela ficará, antes de encerrar o turno.

⚠️ Nunca deixe a PTA descarregada ou sem supervisão fora da área designada.

Qualquer dúvida, é só chamar o Facilities. Bom trabalho! 👷`;

            const msgWpp = encodeURIComponent(msgTexto);
            const telContato = notifData.solicitanteContato.replace(/\D/g, '');
            const wppUrl = telContato
              ? `https://wa.me/55${telContato}?text=${msgWpp}`
              : `https://wa.me/?text=${msgWpp}`;
            const mailSubject = encodeURIComponent(`Agendamento PTA ${notifData.ptaPatrimonio} confirmado — Retirada em ${dtRet}`);
            const mailBody = encodeURIComponent(msgTexto);
            const mailUrl = `mailto:?subject=${mailSubject}&body=${mailBody}`;

            return (
              <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-gray-200 overflow-hidden">
                  {/* Header */}
                  <div className="bg-[#1B2A4A] px-5 py-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-white text-sm">✅ Agendamento Confirmado!</h3>
                      <p className="text-blue-200 text-[11px] mt-0.5">PTA {notifData.ptaPatrimonio} — {notifData.ptaTipo}</p>
                    </div>
                    <button onClick={() => { setNotifPopupOpen(false); onSuccess(); onClose(); }} className="text-gray-300 hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                      <p className="font-bold mb-1">📋 Notificação para: {notifData.solicitanteNome}</p>
                      <p>Retirada: <strong>{dtRet}</strong> | Entrega: <strong>{dtEnt}</strong></p>
                    </div>

                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 text-[11px] text-gray-700 space-y-1.5 max-h-48 overflow-y-auto leading-relaxed">
                      <p className="font-bold text-gray-900 text-xs">📨 Resumo da mensagem que será enviada:</p>
                      <p>1️⃣ <strong>Check de Extrato</strong> antes de retirar (bateria, avarias, controles)</p>
                      <p>2️⃣ Desconectar do carregador com cuidado e transitar somente por locais autorizados</p>
                      <p>3️⃣ Usar somente no <strong>local combinado</strong></p>
                      <p>4️⃣ Avisar o Facilities <strong>imediatamente</strong> em caso de avaria ou problema técnico</p>
                      <p>5️⃣ Novo <strong>Check de Extrato</strong> na devolução</p>
                      <p>6️⃣ Reconectar no <strong>mesmo carregador</strong> logo após devolver</p>
                      <p>7️⃣ Se pernoitar, deixar a PTA <strong>carregando</strong> no local onde ficará</p>
                      <p>🚫 Em hipótese alguma deixar de devolver a PTA no <strong>mesmo dia</strong>, salvo alinhamento prévio com o Facilities</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <a
                        href={wppUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-bold text-sm rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                          <path d="M12 0C5.374 0 0 5.373 0 12c0 2.112.549 4.094 1.508 5.814L0 24l6.336-1.482A11.945 11.945 0 0012 24c6.626 0 12-5.373 12-12S18.626 0 12 0zm0 21.818a9.818 9.818 0 01-5.006-1.37l-.36-.214-3.724.977.994-3.63-.235-.374A9.818 9.818 0 1112 21.818z"/>
                        </svg>
                        WhatsApp
                      </a>
                      <a
                        href={mailUrl}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-[#1B2A4A] hover:bg-[#152238] text-white font-bold text-sm rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        E-mail
                      </a>
                    </div>

                    <button
                      onClick={() => { setNotifPopupOpen(false); onSuccess(); onClose(); }}
                      className="w-full py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Fechar sem enviar
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

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
                  onClick={() => setRepeticao(opt.val)}
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
                {repeticao === 'diaria' && '⚠️ Serão criados 30 agendamentos diários a partir desta data.'}
                {repeticao === 'semanal' && '⚠️ Serão criados 26 agendamentos semanais (≈ 6 meses).'}
                {repeticao === 'quinzenal' && '⚠️ Serão criados 26 agendamentos quinzenais (≈ 1 ano).'}
                {repeticao === 'mensal' && '⚠️ Serão criados 12 agendamentos mensais (1 ano).'}
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

        {/* Popup de erro no agendamento */}
        {erroPopup && (
          <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full border border-rose-200 overflow-hidden">
              {/* Header */}
              <div className="bg-rose-600 px-5 py-3.5 flex items-center gap-2.5">
                <span className="text-xl">⚠️</span>
                <span className="text-sm font-bold text-white">Conflito no Agendamento</span>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-sm text-gray-700 leading-relaxed">
                  Esta PTA já está reservada nesse período. O que deseja fazer?
                </p>

                {/* Buscar agendamento conflitante e exibir */}
                {conflitoPtaId && conflitoDataInicio && (
                  <ConflitoBusca
                    ptaId={conflitoPtaId}
                    dataInicio={conflitoDataInicio}
                    dataFim={conflitoDataFim || conflitoDataInicio}
                    onCancelarConflito={async (agendamentoId: string) => {
                      const { error } = await supabase
                        .from('agendamentos')
                        .update({ status: 'cancelado' })
                        .eq('id', agendamentoId);
                      if (!error) {
                        setErroPopup(null);
                        setConflitoPtaId(null);
                        setConflitoDataInicio(null);
                        setConflitoDataFim(null);
                        toast.success('Cancelado', 'Agendamento conflitante cancelado. Tente confirmar novamente.');
                      }
                    }}
                  />
                )}

                {/* Opções */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setErroPopup(null);
                      setConflitoPtaId(null);
                      setConflitoDataInicio(null);
                      setConflitoDataFim(null);
                    }}
                    className="w-full py-2.5 text-sm font-bold text-white bg-[#1B2A4A] hover:bg-[#152238] rounded-lg transition-colors"
                  >
                    🔄 Alterar data ou PTA e tentar novamente
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setErroPopup(null);
                      setConflitoPtaId(null);
                      setConflitoDataInicio(null);
                      setConflitoDataFim(null);
                      onClose();
                    }}
                    className="w-full py-2.5 text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
