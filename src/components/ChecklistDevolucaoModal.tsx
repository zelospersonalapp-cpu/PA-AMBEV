import React, { useState, useEffect } from 'react';
import {
  X,
  Battery,
  Camera,
  CheckSquare,
  AlertOctagon,
  Upload,
  CheckCircle2,
  Clock,
  MapPin,
  Zap,
} from 'lucide-react';
import { supabase, uploadPtaPhoto } from '../lib/supabase';
import { useToast } from './Toast';
import type { Agendamento, Colaborador, PTA, SeveridadeAvaria } from '../types';

interface ChecklistDevolucaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  agendamento: Agendamento;
  pta?: PTA | null;
}

export const ChecklistDevolucaoModal: React.FC<ChecklistDevolucaoModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  agendamento,
  pta,
}) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);

  // Devolucao form
  const [devolvidoPor, setDevolvidoPor] = useState(
    agendamento.retirado_por || agendamento.solicitante_id || ''
  );
  const [nivelBateria, setNivelBateria] = useState<number>(85);
  const [estadoGeral, setEstadoGeral] = useState<'ok' | 'com_ressalvas' | 'avariado'>('ok');
  const [avariasVisiveis, setAvariasVisiveis] = useState('');

  // 3 SLA Checks (Sim / Não)
  const [entregouNoPrazo, setEntregouNoPrazo] = useState<boolean>(true);
  const [entregouLocalCombinado, setEntregouLocalCombinado] = useState<boolean>(true);
  const [posicionouCarregamento, setPosicionouCarregamento] = useState<boolean>(true);
  const [obsSla, setObsSla] = useState('');

  // Auto create avaria if needed
  const [criarRegistroAvaria, setCriarRegistroAvaria] = useState(false);
  const [avariaSeveridade, setAvariaSeveridade] = useState<SeveridadeAvaria>('media');
  const [avariaDescricao, setAvariaDescricao] = useState('');

  // Photos state
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    async function loadColaboradores() {
      const { data } = await supabase
        .from('colaboradores')
        .select('*')
        .eq('ativo', true)
        .order('nome', { ascending: true });
      if (data) setColaboradores(data);
    }

    loadColaboradores();

    // Check if expected return date is passed
    const now = new Date();
    const dataFim = new Date(agendamento.data_fim);
    // If today is past data_fim, default entregouNoPrazo to false
    if (now.toISOString().substring(0, 10) > agendamento.data_fim.substring(0, 10)) {
      setEntregouNoPrazo(false);
    } else {
      setEntregouNoPrazo(true);
    }
  }, [isOpen, agendamento]);

  // If user changes estadoGeral to avariado, auto check criarRegistroAvaria
  useEffect(() => {
    if (estadoGeral === 'avariado') {
      setCriarRegistroAvaria(true);
    }
  }, [estadoGeral]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!devolvidoPor) {
      toast.warning('Colaborador Obrigatório', 'Selecione quem realizou a vistoria de devolução.');
      return;
    }

    setLoading(true);

    try {
      // 1. Upload photos if any
      const uploadedUrls: string[] = [];
      if (photoFiles.length > 0) {
        setUploadingPhotos(true);
        for (const file of photoFiles) {
          try {
            const url = await uploadPtaPhoto(file);
            uploadedUrls.push(url);
          } catch (uploadErr) {
            console.warn('Falha em upload individual:', uploadErr);
          }
        }
        setUploadingPhotos(false);
      }

      // 2. Insert checklist record
      const { error: checklistError } = await supabase.from('checklists').insert([
        {
          agendamento_id: agendamento.id,
          tipo: 'devolucao',
          nivel_bateria: nivelBateria,
          estado_geral: estadoGeral,
          avarias_visiveis: avariasVisiveis || null,
          fotos: uploadedUrls.length > 0 ? uploadedUrls : [],
          realizado_por: devolvidoPor,
          realizado_em: new Date().toISOString(),
          assinatura_ok: true,
          observacoes: obsSla || null,
        },
      ]);

      if (checklistError) throw checklistError;

      // 3. Optionally insert avaria if reported
      let hasSevereDamage = false;
      if (criarRegistroAvaria) {
        const { error: avariaError } = await supabase.from('avarias').insert([
          {
            pta_id: agendamento.pta_id,
            agendamento_id: agendamento.id,
            reportado_por: devolvidoPor,
            data_avaria: new Date().toISOString().substring(0, 10),
            descricao: avariaDescricao || avariasVisiveis || 'Avaria reportada na devolução da PTA.',
            severidade: avariaSeveridade,
            status: 'aberta',
            fotos: uploadedUrls.length > 0 ? uploadedUrls : [],
          },
        ]);

        if (avariaError) {
          console.warn('Aviso ao registrar avaria vinculada:', avariaError);
        } else {
          toast.info('Avaria Registrada', 'Ocorrência aberta no histórico de manutenção da PTA.');
          if (avariaSeveridade === 'alta' || avariaSeveridade === 'critica') {
            hasSevereDamage = true;
          }
        }
      }

      // 4. Update agendamento status to 'concluido' and set SLA fields
      const { error: agendamentoError } = await supabase
        .from('agendamentos')
        .update({
          status: 'concluido',
          devolvido_em: new Date().toISOString(),
          entregou_no_prazo: entregouNoPrazo,
          entregou_local_combinado: entregouLocalCombinado,
          posicionou_carregamento: posicionouCarregamento,
          obs_sla: obsSla || null,
        })
        .eq('id', agendamento.id);

      if (agendamentoError) throw agendamentoError;

      // 5. Update PTA status to 'disponivel' (or 'avariada' if severe damage occurred)
      const nextPtaStatus = hasSevereDamage || estadoGeral === 'avariado' ? 'avariada' : 'disponivel';
      const { error: ptaError } = await supabase
        .from('ptas')
        .update({
          status: nextPtaStatus,
          nivel_bateria: nivelBateria,
        })
        .eq('id', agendamento.pta_id);

      if (ptaError) console.warn('Aviso ao atualizar PTA:', ptaError);

      toast.success(
        'Devolução Concluída!',
        `Agendamento encerrado. Plataforma liberada com status "${nextPtaStatus}".`
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro na devolução:', err);
      toast.error('Falha na Devolução', err.message || 'Erro ao processar checklist de devolução.');
    } finally {
      setLoading(false);
      setUploadingPhotos(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-xl shadow-2xl max-w-xl w-full border border-gray-200 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-[#1B2A4A] text-white px-6 py-4 flex items-center justify-between border-b border-[#152238]">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#F5D800]" />
            <div>
              <h2 className="text-base font-bold text-white">Checklist de Devolução & SLA Facilities</h2>
              <p className="text-xs text-gray-300">
                Auditoria de entrega e conformidade de devolução da PTA
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white p-1 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
          {/* Who received */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Colaborador que Realizou a Conferência *
            </label>
            <select
              value={devolvidoPor}
              onChange={(e) => setDevolvidoPor(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#1B2A4A]"
            >
              <option value="">Selecione o responsável pela devolução...</option>
              {colaboradores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          {/* 3 SLA Checks Card */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center justify-between">
              <span>Auditoria de SLA Facilities (Indicadores AmBev)</span>
              <span className="text-[10px] px-2 py-0.5 bg-amber-200 text-amber-900 rounded font-semibold">
                Pontualidade & Regras
              </span>
            </div>

            {/* Check 1: Prazo */}
            <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-amber-200">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <div>
                  <div className="text-xs font-bold text-gray-900">1. Entregou no Prazo?</div>
                  <div className="text-[11px] text-gray-500">Dentro da vigência acordada na agenda</div>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setEntregouNoPrazo(true)}
                  className={`px-3 py-1 text-xs font-bold rounded ${
                    entregouNoPrazo
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  SIM
                </button>
                <button
                  type="button"
                  onClick={() => setEntregouNoPrazo(false)}
                  className={`px-3 py-1 text-xs font-bold rounded ${
                    !entregouNoPrazo
                      ? 'bg-rose-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  NÃO
                </button>
              </div>
            </div>

            {/* Check 2: Local */}
            <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-amber-200">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-600" />
                <div>
                  <div className="text-xs font-bold text-gray-900">2. Entregou no Local Combinado?</div>
                  <div className="text-[11px] text-gray-500">Estacionada na área/baias oficiais de PTAs</div>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setEntregouLocalCombinado(true)}
                  className={`px-3 py-1 text-xs font-bold rounded ${
                    entregouLocalCombinado
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  SIM
                </button>
                <button
                  type="button"
                  onClick={() => setEntregouLocalCombinado(false)}
                  className={`px-3 py-1 text-xs font-bold rounded ${
                    !entregouLocalCombinado
                      ? 'bg-rose-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  NÃO
                </button>
              </div>
            </div>

            {/* Check 3: Carregamento */}
            <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-amber-200">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-600" />
                <div>
                  <div className="text-xs font-bold text-gray-900">3. Plugou no Carregamento?</div>
                  <div className="text-[11px] text-gray-500">Conectada na tomada/carregador para o próximo usuário</div>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setPosicionouCarregamento(true)}
                  className={`px-3 py-1 text-xs font-bold rounded ${
                    posicionouCarregamento
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  SIM
                </button>
                <button
                  type="button"
                  onClick={() => setPosicionouCarregamento(false)}
                  className={`px-3 py-1 text-xs font-bold rounded ${
                    !posicionouCarregamento
                      ? 'bg-rose-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  NÃO
                </button>
              </div>
            </div>
          </div>

          {/* Battery level */}
          <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Battery className="w-4 h-4 text-emerald-600" />
                Nível de Bateria na Devolução (%)
              </label>
              <span className="text-sm font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-300">
                {nivelBateria}%
              </span>
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

          {/* Condition */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Estado Geral de Conservação na Devolução *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 'ok', label: 'OK (Sem danos)', color: 'border-emerald-500 bg-emerald-50 text-emerald-800' },
                { val: 'com_ressalvas', label: 'Com Ressalvas', color: 'border-amber-500 bg-amber-50 text-amber-800' },
                { val: 'avariado', label: 'Avariado / Danificado', color: 'border-rose-500 bg-rose-50 text-rose-800' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setEstadoGeral(opt.val as any)}
                  className={`py-2 px-2 text-xs font-semibold rounded-lg border text-center transition-all ${
                    estadoGeral === opt.val
                      ? `${opt.color} ring-2 ring-offset-1`
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Avaria Creation if damaged */}
          {(estadoGeral === 'avariado' || estadoGeral === 'com_ressalvas' || criarRegistroAvaria) && (
            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3.5 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={criarRegistroAvaria}
                  onChange={(e) => setCriarRegistroAvaria(e.target.checked)}
                  className="w-4 h-4 text-rose-600 rounded border-gray-300 focus:ring-rose-500"
                />
                <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                  <AlertOctagon className="w-4 h-4 text-rose-600" />
                  Abrir Ordem de Avaria & Manutenção para esta PTA
                </span>
              </label>

              {criarRegistroAvaria && (
                <div className="space-y-2.5 pt-2 border-t border-rose-200 text-xs">
                  <div>
                    <label className="block font-semibold text-rose-900 mb-1">
                      Severidade do Dano
                    </label>
                    <select
                      value={avariaSeveridade}
                      onChange={(e) => setAvariaSeveridade(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 border border-rose-300 rounded bg-white text-xs font-medium"
                    >
                      <option value="baixa">Baixa (estético, não impede uso)</option>
                      <option value="media">Média (requer atenção da manutenção)</option>
                      <option value="alta">Alta (bloqueia a PTA para uso)</option>
                      <option value="critica">Crítica (risco grave de segurança — bloqueio imediato)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-rose-900 mb-1">
                      Descrição da Avaria
                    </label>
                    <textarea
                      value={avariaDescricao}
                      onChange={(e) => setAvariaDescricao(e.target.value)}
                      rows={2}
                      placeholder="Descreva o que quebrou, amassou ou apresentou falha elétrica/mecânica..."
                      className="w-full px-2.5 py-1.5 border border-rose-300 rounded bg-white text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Photo uploads */}
          <div className="border border-dashed border-gray-300 rounded-lg p-3 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-gray-600" />
                Fotos da Devolução
              </label>
              <label className="cursor-pointer px-2.5 py-1 text-xs font-bold text-white bg-[#1B2A4A] hover:bg-[#152238] rounded shadow-xs inline-flex items-center gap-1 transition-colors">
                <Upload className="w-3 h-3 text-[#F5D800]" />
                <span>Adicionar Foto</span>
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

          {/* SLA Obs */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Observações Gerais de Devolução
            </label>
            <input
              type="text"
              value={obsSla}
              onChange={(e) => setObsSla(e.target.value)}
              placeholder="Justificativa de atraso ou observações de entrega..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#F5D800]"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-bold text-white bg-[#1B2A4A] hover:bg-[#152238] rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1.5 transition-colors"
            >
              {loading || uploadingPhotos ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Finalizando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#F5D800]" />
                  <span>Concluir e Liberar PTA</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
