import React, { useState, useEffect } from 'react';
import { X, Battery, Camera, CheckSquare, AlertTriangle, Upload, UserCheck } from 'lucide-react';
import { supabase, uploadPtaPhoto } from '../lib/supabase';
import { useToast } from './Toast';
import type { Agendamento, Colaborador, PTA } from '../types';

interface ChecklistRetiradaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  agendamento: Agendamento;
  pta?: PTA | null;
}

export const ChecklistRetiradaModal: React.FC<ChecklistRetiradaModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  agendamento,
  pta,
}) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [solicitantes, setSolicitantes] = useState<Colaborador[]>([]);

  // Form states
  const [nivelBateria, setNivelBateria] = useState<number>(pta?.nivel_bateria ?? 100);
  const [estadoGeral, setEstadoGeral] = useState<'ok' | 'com_ressalvas' | 'avariado'>('ok');
  const [avariasVisiveis, setAvariasVisiveis] = useState('');
  const [retiradoPor, setRetiradoPor] = useState(agendamento.solicitante_id || '');
  const [assinaturaOk, setAssinaturaOk] = useState(false);
  const [observacoes, setObservacoes] = useState('');

  // Photos state
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    async function loadSolicitantes() {
      const { data } = await supabase
        .from('colaboradores')
        .select('*')
        .eq('ativo', true)
        .eq('papel', 'solicitante')
        .order('nome', { ascending: true });
      if (data) setSolicitantes(data);
    }

    loadSolicitantes();
    if (pta) {
      setNivelBateria(pta.nivel_bateria);
    }
  }, [isOpen, pta]);

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

    if (!retiradoPor) {
      toast.warning('Operador Obrigatório', 'Selecione quem está retirando a PTA.');
      return;
    }

    if (!assinaturaOk) {
      toast.warning(
        'Assinatura Obrigatória',
        'O operador deve confirmar a responsabilidade pela plataforma.'
      );
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

      // 2. Insert into checklists table
      const { error: checklistError } = await supabase.from('checklists').insert([
        {
          agendamento_id: agendamento.id,
          tipo: 'retirada',
          nivel_bateria: nivelBateria,
          estado_geral: estadoGeral,
          avarias_visiveis: avariasVisiveis || null,
          fotos: uploadedUrls.length > 0 ? uploadedUrls : [],
          realizado_por: retiradoPor,
          realizado_em: new Date().toISOString(),
          assinatura_ok: true,
          observacoes: observacoes || null,
        },
      ]);

      if (checklistError) throw checklistError;

      // 3. Update agendamentos
      const { error: agendamentoError } = await supabase
        .from('agendamentos')
        .update({
          status: 'em_uso',
          retirado_por: retiradoPor,
          retirado_em: new Date().toISOString(),
          assinatura_retirada: true,
        })
        .eq('id', agendamento.id);

      if (agendamentoError) throw agendamentoError;

      // 4. Update PTA status to 'em_uso' and current battery
      const { error: ptaError } = await supabase
        .from('ptas')
        .update({
          status: 'em_uso',
          nivel_bateria: nivelBateria,
        })
        .eq('id', agendamento.pta_id);

      if (ptaError) console.warn('Aviso ao atualizar status da PTA:', ptaError);

      toast.success(
        'Retirada Realizada com Sucesso',
        'Checklist registrado e PTA em uso pelo operador.'
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao registrar checklist de retirada:', err);
      toast.error('Erro na Retirada', err.message || 'Falha ao salvar checklist.');
    } finally {
      setLoading(false);
      setUploadingPhotos(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-xl shadow-2xl max-w-xl w-full border border-gray-200 overflow-hidden my-6">
        <div className="bg-[#1B2A4A] px-6 py-4 flex items-center justify-between border-b border-[#152238] text-white">
          <div className="flex items-center gap-2.5">
            <CheckSquare className="w-5 h-5 text-[#F5D800]" />
            <div>
              <h2 className="text-base font-bold leading-tight text-white">Checklist de Retirada de PTA</h2>
              <p className="text-xs text-gray-300 font-medium">
                Vistoria obrigatória antes de liberar o equipamento na fábrica
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
          {/* Operator who withdrew */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Operador Responsável pela Retirada *
            </label>
            <select
              value={retiradoPor}
              onChange={(e) => setRetiradoPor(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#1B2A4A]"
            >
              <option value="">Selecione o operador...</option>
              {solicitantes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Battery level */}
          <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Battery className="w-4 h-4 text-emerald-600" />
                Nível de Bateria Atual (%)
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
            <div className="flex justify-between text-[11px] text-gray-500 mt-1">
              <span>0% (Descarregada)</span>
              <span>50%</span>
              <span>100% (Carga total)</span>
            </div>
          </div>

          {/* General condition */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Estado Geral de Conservação *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 'ok', label: 'OK (Íntegro)', color: 'border-emerald-500 bg-emerald-50 text-emerald-800' },
                { val: 'com_ressalvas', label: 'Com Ressalvas', color: 'border-amber-500 bg-amber-50 text-amber-800' },
                { val: 'avariado', label: 'Avariado', color: 'border-rose-500 bg-rose-50 text-rose-800' },
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

          {/* Visible damages */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Avarias Visíveis / Riscos / Pneus / Guarda-corpo
            </label>
            <textarea
              value={avariasVisiveis}
              onChange={(e) => setAvariasVisiveis(e.target.value)}
              rows={2}
              placeholder="Descreva detalhes caso haja amassados, ressalvas pré-existentes ou observações mecânicas..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#F5D800]"
            />
          </div>

          {/* Photo uploads */}
          <div className="border border-dashed border-gray-300 rounded-lg p-3 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-gray-600" />
                Fotos da Vistoria
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

            {photoPreviews.length > 0 ? (
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
            ) : (
              <p className="text-[11px] text-gray-500 italic">
                Nenhuma foto anexada. Opcional para comprovação de estado inicial.
              </p>
            )}
          </div>

          {/* Confirmation & Signature */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={assinaturaOk}
                onChange={(e) => setAssinaturaOk(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500"
                required
              />
              <div className="text-xs text-amber-900 leading-relaxed">
                <strong className="block font-semibold">Assinatura Digital & Termo de Responsabilidade:</strong>
                Declaro ter conferido as condições operacionais da PTA, cinto de segurança, bateria e comando de emergência. Assumo a responsabilidade pelo uso seguro na fábrica.
              </div>
            </label>
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
              disabled={loading || !assinaturaOk}
              className="px-4 py-2 text-xs font-bold text-white bg-[#1B2A4A] hover:bg-[#152238] rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1.5 transition-colors"
            >
              {loading || uploadingPhotos ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{uploadingPhotos ? 'Enviando fotos...' : 'Registrando...'}</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4 text-[#F5D800]" />
                  <span>Confirmar Retirada e Liberar Uso</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
