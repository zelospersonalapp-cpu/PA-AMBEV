import React from 'react';
import { Settings, ShieldAlert, ShieldCheck, Info } from 'lucide-react';
import { usePendenciaLock } from '../lib/usePendenciaLock';

export const Configuracoes: React.FC = () => {
  const { enabled, setEnabled } = usePendenciaLock();

  return (
    <div className="space-y-6">
      {/* Header da página */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 flex items-center gap-4">
        <div className="bg-[#1B2A4A] rounded-xl p-3">
          <Settings className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Configurações do Sistema</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Controles administrativos do Gestão de PTAs — AMBEV Facilities
          </p>
        </div>
      </div>

      {/* Seção: Regras de Agendamento */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#1B2A4A]" />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
            Regras de Agendamento
          </span>
        </div>

        <div className="p-5">
          {/* Card do toggle */}
          <div className={`rounded-xl border-2 p-5 transition-colors ${
            enabled
              ? 'border-red-200 bg-red-50'
              : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="flex items-start justify-between gap-6">
              {/* Info */}
              <div className="flex items-start gap-3 flex-1">
                <div className={`mt-0.5 rounded-full p-2 ${
                  enabled ? 'bg-red-100' : 'bg-gray-200'
                }`}>
                  {enabled
                    ? <ShieldAlert className="w-5 h-5 text-red-700" />
                    : <ShieldCheck className="w-5 h-5 text-gray-500" />
                  }
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">
                    Bloqueio por Pendências Vencidas
                  </p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-lg">
                    Quando <strong>ativo</strong>, impede a criação de novos agendamentos enquanto
                    existirem PTAs com data de devolução vencida e status em aberto
                    (agendado, liberado ou retirado). O operador precisará resolver ou
                    cancelar cada pendência antes de prosseguir.
                  </p>
                </div>
              </div>

              {/* Toggle switch */}
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none ${
                  enabled
                    ? 'bg-red-600 border-red-600'
                    : 'bg-gray-300 border-gray-300'
                }`}
                role="switch"
                aria-checked={enabled}
                title={enabled ? 'Clique para desativar' : 'Clique para ativar'}
              >
                <span
                  className={`inline-block h-6 w-6 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                    enabled ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Status pill */}
            <div className="mt-4 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                enabled
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'bg-gray-200 text-gray-600 border border-gray-300'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-red-500' : 'bg-gray-400'}`} />
                {enabled ? 'BLOQUEIO ATIVO' : 'BLOQUEIO DESATIVADO'}
              </span>
              <span className="text-[11px] text-gray-400">
                {enabled
                  ? 'Novos agendamentos serão travados se houver pendências vencidas.'
                  : 'Novos agendamentos podem ser criados livremente.'}
              </span>
            </div>
          </div>

          {/* Aviso informativo */}
          <div className="mt-4 flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-lg p-3.5">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 leading-relaxed">
              <strong>Recomendação:</strong> Ative este bloqueio somente após comunicar a equipe
              operacional sobre a nova funcionalidade. A configuração é salva localmente neste
              dispositivo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
