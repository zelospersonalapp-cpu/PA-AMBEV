import React, { useState, useEffect } from 'react';
import {
  AlertOctagon,
  PlusCircle,
  Wrench,
  CheckCircle,
  Filter,
  Camera,
  Upload,
  X,
  Clock,
  Truck,
  User,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { supabase, uploadPtaPhoto } from '../lib/supabase';
import { useToast } from '../components/Toast';
import type { Avaria, PTA, Colaborador, Agendamento, VAvariasPTA, SeveridadeAvaria, StatusAvaria } from '../types';
import { formatDateBR, formatDateTimeBR, getSeveridadeAvariaConfig, getStatusAvariaConfig } from '../lib/formatters';
import { GRUPOS_ANOMALIA } from '../data/anomalias';

export const Avarias: React.FC = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [avarias, setAvarias] = useState<Avaria[]>([]);
  const [resumoPtas, setResumoPtas] = useState<VAvariasPTA[]>([]);

  // Auxiliary
  const [ptas, setPtas] = useState<PTA[]>([]);
  const [areasEmpresas, setAreasEmpresas] = useState<{ id: string; nome: string }[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterSeveridade, setFilterSeveridade] = useState<string>('');
  const [filterPta, setFilterPta] = useState<string>('');

  // New Avaria Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form
  const [ptaId, setPtaId] = useState('');
  const [agendamentoId, setAgendamentoId] = useState('');
  const [reportadoPor, setReportadoPor] = useState('');
  const [operadorId, setOperadorId] = useState('');
  const [solicitantes, setSolicitantes] = useState<Colaborador[]>([]);
  const [dataAvaria, setDataAvaria] = useState(new Date().toISOString().substring(0, 10));
  const [descricao, setDescricao] = useState('');
  const [severidade, setSeveridade] = useState<SeveridadeAvaria>('media');
  const [tipoAnomalia, setTipoAnomalia] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  // Resolve modal
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedAvariaForResolve, setSelectedAvariaForResolve] = useState<Avaria | null>(null);
  const [resolvidoPor, setResolvidoPor] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [avariasRes, resumoRes, ptasRes, areasRes, colabsRes, agRes, solRes] = await Promise.all([
        supabase.from('avarias').select('*').order('data_avaria', { ascending: false }),
        supabase.from('v_avarias_pta').select('*'),
        supabase.from('ptas').select('*').order('patrimonio', { ascending: true }),
        supabase.from('areas_empresas').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('colaboradores').select('*').eq('ativo', true).eq('papel', 'liberador').order('nome', { ascending: true }),
        supabase.from('colaboradores').select('*').eq('ativo', true).eq('papel', 'solicitante').order('nome', { ascending: true }),
        supabase.from('agendamentos').select('*').order('created_at', { ascending: false }).limit(50),
      ]);

      if (avariasRes.data) setAvarias(avariasRes.data);
      if (resumoRes.data) setResumoPtas(resumoRes.data);
      if (ptasRes.data) setPtas(ptasRes.data);
      if (areasRes.data) setAreasEmpresas(areasRes.data);
      if (colabsRes.data) setColaboradores(colabsRes.data);
      if (solRes?.data) setSolicitantes(solRes.data);
      if (agRes.data) setAgendamentos(agRes.data);
    } catch (err: any) {
      console.error('Erro ao carregar avarias:', err);
      toast.error('Erro ao carregar dados', err.message);
    } finally {
      setLoading(false);
    }
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files) as File[];
    setPhotoFiles((prev) => [...prev, ...files]);

    files.forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateAvaria = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ptaId) {
      toast.warning('Selecione a PTA', 'Identifique a plataforma danificada.');
      return;
    }
    if (!reportadoPor) {
      toast.warning('Identifique o Relator', 'Selecione a área / empresa que comunicou a avaria.');
      return;
    }
    if (!tipoAnomalia) {
      toast.warning('Tipo de Anomalia Obrigatório', 'Selecione o tipo de anomalia pré-definido.');
      return;
    }
    if (!descricao.trim()) {
      toast.warning('Descrição Obrigatória', 'Explique o dano ou falha ocorrida.');
      return;
    }

    setSaving(true);
    try {
      // 1. Upload photos if any
      const uploadedUrls: string[] = [];
      if (photoFiles.length > 0) {
        setUploading(true);
        for (const file of photoFiles) {
          try {
            const url = await uploadPtaPhoto(file);
            uploadedUrls.push(url);
          } catch (uploadErr) {
            console.warn('Falha no upload da foto de avaria:', uploadErr);
          }
        }
        setUploading(false);
      }

      // 2. Insert avaria
      const payload: any = {
        pta_id: ptaId,
        operador_id: operadorId || null,
        reportado_por: reportadoPor,
        data_avaria: dataAvaria,
        descricao: descricao.trim(),
        severidade,
        tipo_anomalia: tipoAnomalia,
        status: 'aberta',
        fotos: uploadedUrls.length > 0 ? uploadedUrls : [],
        observacoes: observacoes.trim() || null,
      };

      let { error } = await supabase.from('avarias').insert([payload]);

      // If column does not exist yet (error 42703), save without it and notify
      if (error && (error.code === '42703' || error.message?.includes('tipo_anomalia'))) {
        console.warn('Coluna tipo_anomalia ainda não criada no Supabase. Salvando com fallback...');
        const fallbackPayload = { ...payload };
        delete fallbackPayload.tipo_anomalia;
        const fallbackRes = await supabase.from('avarias').insert([fallbackPayload]);
        if (fallbackRes.error) {
          throw fallbackRes.error;
        }
        toast.warning(
          'Avaria Salva (Coluna no Supabase pendente)',
          'Para persistir o Tipo de Anomalia, execute no SQL Editor do Supabase: ALTER TABLE avarias ADD COLUMN IF NOT EXISTS tipo_anomalia text;'
        );
        error = null;
      } else if (error) {
        throw error;
      }

      // Notice about automatic block for severe
      if (severidade === 'alta' || severidade === 'critica') {
        toast.warning(
          'Avaria Crítica / Alta Registrada',
          'A PTA foi automaticamente bloqueada no sistema para preservar a segurança operacional.'
        );
      } else {
        toast.success('Ocorrência Aberta', 'Avaria registrada com sucesso.');
      }

      setModalOpen(false);
      // Reset form
      setPtaId('');
      setAgendamentoId('');
      setDescricao('');
      setTipoAnomalia('');
      setObservacoes('');
      setPhotoFiles([]);
      setPhotoPreviews([]);
      loadData();
    } catch (err: any) {
      console.error('Erro ao salvar avaria:', err);
      toast.error('Erro ao registrar avaria', err.message);
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const handleMarcarManutencao = async (avaria: Avaria) => {
    try {
      const { error } = await supabase
        .from('avarias')
        .update({ status: 'em_manutencao' })
        .eq('id', avaria.id);

      if (error) throw error;

      // Update PTA status to em_manutencao
      await supabase.from('ptas').update({ status: 'em_manutencao' }).eq('id', avaria.pta_id);

      toast.info('Status Atualizado', 'Avaria e PTA marcadas em manutenção.');
      loadData();
    } catch (err: any) {
      toast.error('Falha na atualização', err.message);
    }
  };

  const handleResolverAvariaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAvariaForResolve) return;
    if (!resolvidoPor) {
      toast.warning('Técnico Responsável', 'Selecione quem executou o reparo da PTA.');
      return;
    }

    try {
      const { error } = await supabase
        .from('avarias')
        .update({
          status: 'resolvida',
          resolvido_em: new Date().toISOString(),
          resolvido_por: resolvidoPor,
        })
        .eq('id', selectedAvariaForResolve.id);

      if (error) throw error;

      // Check if there are other open avarias for this PTA
      const { data: otherOpen } = await supabase
        .from('avarias')
        .select('id')
        .eq('pta_id', selectedAvariaForResolve.pta_id)
        .neq('id', selectedAvariaForResolve.id)
        .neq('status', 'resolvida');

      if (!otherOpen || otherOpen.length === 0) {
        // Safe to liberate PTA back to 'disponivel'
        await supabase
          .from('ptas')
          .update({ status: 'disponivel' })
          .eq('id', selectedAvariaForResolve.pta_id);
      }

      toast.success(
        'Avaria Resolvida!',
        'Ordem concluída. Plataforma apta para voltar às operações.'
      );
      setResolveDialogOpen(false);
      setSelectedAvariaForResolve(null);
      loadData();
    } catch (err: any) {
      toast.error('Erro ao resolver avaria', err.message);
    }
  };

  const filteredAvarias = avarias.filter((a) => {
    if (filterStatus && a.status !== filterStatus) return false;
    if (filterSeveridade && a.severidade !== filterSeveridade) return false;
    if (filterPta && a.pta_id !== filterPta) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#1A1A1A] flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-rose-500" />
            Gestão de Avarias & Manutenção de PTAs
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Registro de ocorrências, fotos de inspeção, bloqueio automático de segurança e resolução técnica.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1B2A4A] hover:bg-[#152238] text-white font-bold text-xs sm:text-sm rounded-lg shadow-xs transition-colors"
        >
          <PlusCircle className="w-4 h-4 text-[#F5D800]" />
          <span>Registrar Nova Avaria</span>
        </button>
      </div>

      {/* Overview Cards by PTA (v_avarias_pta) */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
        <div className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center justify-between">
          <span>Histórico Consolidado por Plataforma (v_avarias_pta)</span>
          <span className="text-gray-400 font-normal">Monitoramento Preventivo</span>
        </div>

        {resumoPtas.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Nenhum registro de avaria acumulado.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {resumoPtas.map((r) => (
              <div
                key={r.pta_id}
                onClick={() => setFilterPta(filterPta === r.pta_id ? '' : r.pta_id)}
                className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                  filterPta === r.pta_id
                    ? 'border-[#F5D800] bg-amber-50/50 ring-2 ring-[#F5D800]'
                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="font-bold text-gray-900 truncate">{r.patrimonio}</div>
                <div className="text-[11px] text-gray-500 capitalize">{r.tipo}</div>
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span>Total: <strong>{r.total_avarias}</strong></span>
                  {r.avarias_abertas > 0 ? (
                    <span className="text-rose-600 font-bold">{r.avarias_abertas} abertas</span>
                  ) : (
                    <span className="text-emerald-600 font-bold">0</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5 text-amber-500" />
          <span>Filtros</span>
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
        >
          <option value="">Todos os Status</option>
          <option value="aberta">Aberta</option>
          <option value="em_manutencao">Em Manutenção</option>
          <option value="resolvida">Resolvida</option>
        </select>

        <select
          value={filterSeveridade}
          onChange={(e) => setFilterSeveridade(e.target.value)}
          className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
        >
          <option value="">Todas as Severidades</option>
          <option value="baixa">Baixa</option>
          <option value="media">Média</option>
          <option value="alta">Alta</option>
          <option value="critica">Crítica</option>
        </select>

        <select
          value={filterPta}
          onChange={(e) => setFilterPta(e.target.value)}
          className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
        >
          <option value="">Todas as PTAs</option>
          {ptas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.patrimonio} ({p.tipo})
            </option>
          ))}
        </select>

        {(filterStatus || filterSeveridade || filterPta) && (
          <button
            onClick={() => {
              setFilterStatus('');
              setFilterSeveridade('');
              setFilterPta('');
            }}
            className="text-xs text-rose-600 font-semibold hover:underline"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Avarias Table / Cards */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-[#F5D800] border-t-transparent rounded-full animate-spin" />
          <span>Carregando avarias...</span>
        </div>
      ) : filteredAvarias.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-gray-900">Nenhuma avaria registrada</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            O parque de plataformas está em conformidade mecânica e operacional.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAvarias.map((avaria) => {
            const ptaObj = ptas.find((p) => p.id === avaria.pta_id);
            const reporter = areasEmpresas.find((a) => a.id === avaria.reportado_por) || colaboradores.find((c) => c.id === avaria.reportado_por);
            const resolver = colaboradores.find((c) => c.id === avaria.resolvido_por);
            const severidadeConf = getSeveridadeAvariaConfig(avaria.severidade);
            const statusConf = getStatusAvariaConfig(avaria.status);

            return (
              <div
                key={avaria.id}
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-3 hover:border-amber-400 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-gray-500" />
                      {ptaObj?.patrimonio || 'PTA'} ({ptaObj?.modelo || 'Plataforma'})
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${severidadeConf.badge}`}
                    >
                      Severidade: {severidadeConf.label}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusConf.badge}`}
                    >
                      {statusConf.label}
                    </span>

                    {avaria.tipo_anomalia && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1B2A4A] text-[#93C5FD] border border-[#243656]">
                        {avaria.tipo_anomalia}
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-gray-400 font-medium">
                    Reportado em: {formatDateBR(avaria.data_avaria)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="md:col-span-2 space-y-1">
                    <div className="font-semibold text-gray-700">Descrição do Problema:</div>
                    <p className="text-gray-900 bg-gray-50 p-2.5 rounded-lg border border-gray-200 leading-relaxed">
                      {avaria.descricao}
                    </p>

                    {/* Photos list */}
                    {avaria.fotos && avaria.fotos.length > 0 && (
                      <div className="pt-2">
                        <div className="text-[11px] font-semibold text-gray-500 mb-1">
                          Fotos do Laudo Técnico:
                        </div>
                        <div className="flex gap-2">
                          {avaria.fotos.map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="w-14 h-14 rounded border border-gray-300 overflow-hidden block hover:opacity-80 transition-opacity"
                            >
                              <img
                                src={url}
                                alt="Foto Avaria"
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 bg-gray-50/60 p-3 rounded-lg border border-gray-200 text-xs">
                    <div>
                      <span className="text-gray-500 block">Reportado por:</span>
                      <strong className="text-gray-900">{reporter?.nome || 'Operador/Técnico'}</strong>
                    </div>

                    {avaria.custo_estimado && (
                      <div>
                        <span className="text-gray-500 block">Custo Estimado de Reparo:</span>
                        <strong className="text-emerald-700">
                          R$ {Number(avaria.custo_estimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                    )}

                    {avaria.status === 'resolvida' && (
                      <div className="pt-2 border-t border-gray-200 text-emerald-800">
                        <span className="block text-[11px]">Resolvido por: <strong>{resolver?.nome || 'Facilities'}</strong></span>
                        <span className="text-[10px] text-gray-500">
                          {formatDateTimeBR(avaria.resolvido_em)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                {avaria.status !== 'resolvida' && (
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                    {avaria.status === 'aberta' && (
                      <button
                        type="button"
                        onClick={() => handleMarcarManutencao(avaria)}
                        className="px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Mover para Manutenção</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAvariaForResolve(avaria);
                        setResolvidoPor('');
                        setResolveDialogOpen(true);
                      }}
                      className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#1B2A4A] hover:bg-[#152238] rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-[#F5D800]" />
                      <span>Concluir Reparo e Liberar PTA</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Registrar Nova Avaria */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full border border-gray-200 overflow-hidden my-6">
            <div className="bg-[#1B2A4A] text-white px-6 py-4 flex items-center justify-between border-b border-[#152238]">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-[#F5D800]" />
                <h2 className="text-base font-bold">Registrar Ocorrência / Avaria</h2>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-300 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAvaria} className="p-6 space-y-3.5 max-h-[78vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Plataforma Elevatória (PTA) *
                </label>
                <select
                  value={ptaId}
                  onChange={(e) => setPtaId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">Selecione a PTA...</option>
                  {ptas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.patrimonio} — {p.modelo} ({p.tipo})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Reportado por *
                  </label>
                  <select
                    value={reportadoPor}
                    onChange={(e) => setReportadoPor(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">Selecione o responsável...</option>
                    {colaboradores.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Operador que estava usando *
                  </label>
                  <select
                    value={operadorId}
                    onChange={(e) => setOperadorId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">Selecione o operador...</option>
                    {solicitantes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Data da Ocorrência *
                  </label>
                  <input
                    type="date"
                    value={dataAvaria}
                    onChange={(e) => setDataAvaria(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Severidade da Avaria *
                </label>
                <select
                  value={severidade}
                  onChange={(e) => setSeveridade(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-medium"
                >
                  <option value="baixa">Baixa (estético, não afeta operação)</option>
                  <option value="media">Média (desgaste moderado)</option>
                  <option value="alta">Alta (Bloquear a PTA)</option>
                  <option value="critica">Crítica (Risco grave de acidente)</option>
                </select>
                {(severidade === 'alta' || severidade === 'critica') && (
                  <p className="text-[11px] text-rose-600 mt-1 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Regra do sistema: Severidades Alta e Crítica desabilitam novas reservas desta PTA.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Tipo de Anomalia *
                </label>
                <select
                  value={tipoAnomalia}
                  onChange={(e) => setTipoAnomalia(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-medium text-gray-900"
                >
                  <option value="">Selecione o tipo de anomalia...</option>
                  {GRUPOS_ANOMALIA.map((grupo) => (
                    <optgroup key={grupo.categoria} label={grupo.categoria}>
                      {grupo.opcoes.map((opcao) => (
                        <option key={opcao} value={opcao}>
                          {opcao}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Descrição Detalhada do Dano *
                </label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  required
                  rows={3}
                  placeholder="Relate o que aconteceu, componentes afetados (comando, bateria, cesto, rodas)..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                />
              </div>


              {/* Photos upload for avaria */}
              <div className="border border-dashed border-gray-300 rounded-lg p-3 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-gray-600" />
                    Fotos da Avaria
                  </label>
                  <label className="cursor-pointer px-2.5 py-1 text-xs font-bold text-white bg-[#1B2A4A] hover:bg-[#152238] rounded shadow-xs inline-flex items-center gap-1 transition-colors">
                    <Upload className="w-3 h-3 text-[#F5D800]" />
                    <span>Adicionar</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </label>
                </div>

                {photoPreviews.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {photoPreviews.map((preview, index) => (
                      <div key={index} className="relative group rounded-md overflow-hidden border border-gray-300 h-16 bg-black">
                        <img
                          src={preview}
                          alt="Prévia"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute top-1 right-1 p-0.5 bg-rose-600 text-white rounded-full opacity-80 hover:opacity-100"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
                  disabled={saving || uploading}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#1B2A4A] hover:bg-[#152238] rounded-lg shadow-xs disabled:opacity-50 transition-colors"
                >
                  {saving || uploading ? 'Registrando...' : 'Salvar Avaria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Dialog */}
      {resolveDialogOpen && selectedAvariaForResolve && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 border border-gray-200">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-1">
              <CheckCircle className="w-5 h-5 text-[#1B2A4A]" />
              Finalizar Reparo e Liberar PTA
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Confirme que os reparos mecânicos e elétricos foram concluídos com segurança.
            </p>

            <form onSubmit={handleResolverAvariaSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Técnico / Responsável pela Solução *
                </label>
                <select
                  value={resolvidoPor}
                  onChange={(e) => setResolvidoPor(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">Selecione o técnico...</option>
                  {colaboradores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.matricula})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResolveDialogOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#1B2A4A] hover:bg-[#152238] rounded-lg shadow-xs transition-colors"
                >
                  Confirmar e Liberar PTA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
