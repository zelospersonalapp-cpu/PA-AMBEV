import React, { useState } from 'react';
import { Settings, ShieldAlert, ShieldCheck, Info, Lock, Eye, EyeOff, KeyRound, CheckCircle } from 'lucide-react';
import { usePendenciaLock } from '../lib/usePendenciaLock';

// ----- helpers de senha -----
const SENHA_KEY = 'ppm_config_senha_hash';
const DEFAULT_HASH = 'ambev'; // senha padrão administrativa

function hashSimples(s: string): string {
  // hash determinístico simples (não criptográfico — apenas ofusca no localStorage)
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return 'h' + Math.abs(h).toString(36);
}

function getSenhaHash(): string {
  try { return localStorage.getItem(SENHA_KEY) || hashSimples(DEFAULT_HASH); }
  catch { return hashSimples(DEFAULT_HASH); }
}

function setSenhaHash(nova: string) {
  try { localStorage.setItem(SENHA_KEY, hashSimples(nova)); } catch {}
}

function verificarSenha(tentativa: string): boolean {
  return hashSimples(tentativa) === getSenhaHash();
}

// ----- modal de senha -----
interface ModalSenhaProps {
  titulo: string;
  descricao: string;
  onConfirm: (senha: string) => void;
  onCancel: () => void;
}

const ModalSenha: React.FC<ModalSenhaProps> = ({ titulo, descricao, onConfirm, onCancel }) => {
  const [senha, setSenha] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState('');

  function handleConfirm() {
    if (!verificarSenha(senha)) {
      setErro('Senha incorreta. Tente novamente.');
      setSenha('');
      return;
    }
    onConfirm(senha);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-[#1B2A4A] rounded-xl p-2.5">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-sm">{titulo}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{descricao}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <input
              autoFocus
              type={mostrar ? 'text' : 'password'}
              value={senha}
              onChange={e => { setSenha(e.target.value); setErro(''); }}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              placeholder="Digite a senha"
              className={`w-full border rounded-lg px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 ${
                erro ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-blue-300'
              }`}
            />
            <button
              type="button"
              onClick={() => setMostrar(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {mostrar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {erro && (
            <p className="text-xs text-red-600 font-medium">{erro}</p>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!senha}
            className="flex-1 px-4 py-2 rounded-lg bg-[#1B2A4A] text-white text-sm font-bold hover:bg-[#152238] transition-colors disabled:opacity-40"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

// ----- página principal -----
export const Configuracoes: React.FC = () => {
  const { enabled, setEnabled } = usePendenciaLock();

  // modal de confirmação de toggle
  const [modalToggleAberto, setModalToggleAberto] = useState(false);

  // seção alterar senha
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaConfirm, setSenhaConfirm] = useState('');
  const [mostrarSenhas, setMostrarSenhas] = useState(false);
  const [erroSenha, setErroSenha] = useState('');
  const [sucessoSenha, setSucessoSenha] = useState(false);

  function handleToggleClick() {
    setModalToggleAberto(true);
  }

  function handleToggleConfirmado() {
    setModalToggleAberto(false);
    setEnabled(!enabled);
  }

  function handleAlterarSenha(e: React.FormEvent) {
    e.preventDefault();
    setErroSenha('');
    setSucessoSenha(false);

    if (!verificarSenha(senhaAtual)) {
      setErroSenha('Senha atual incorreta.');
      return;
    }
    if (senhaNova.length < 4) {
      setErroSenha('A nova senha deve ter pelo menos 4 caracteres.');
      return;
    }
    if (senhaNova !== senhaConfirm) {
      setErroSenha('As senhas não coincidem.');
      return;
    }

    setSenhaHash(senhaNova);
    setSucessoSenha(true);
    setSenhaAtual('');
    setSenhaNova('');
    setSenhaConfirm('');
    setTimeout(() => setSucessoSenha(false), 4000);
  }

  return (
    <div className="space-y-6">
      {/* Modal de senha para toggle */}
      {modalToggleAberto && (
        <ModalSenha
          titulo={enabled ? 'Desativar Bloqueio' : 'Ativar Bloqueio'}
          descricao="Esta ação requer a senha administrativa."
          onConfirm={handleToggleConfirmado}
          onCancel={() => setModalToggleAberto(false)}
        />
      )}

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
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900 text-sm">
                      Bloqueio por Pendências Vencidas
                    </p>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1B2A4A]/10 text-[10px] font-bold text-[#1B2A4A]">
                      <Lock className="w-2.5 h-2.5" /> PROTEGIDO
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-lg">
                    Quando <strong>ativo</strong>, impede a criação de novos agendamentos enquanto
                    existirem PTAs com data de devolução vencida e status em aberto
                    (agendado, liberado ou retirado). O operador precisará resolver ou
                    cancelar cada pendência antes de prosseguir.
                  </p>
                </div>
              </div>

              {/* Toggle switch — agora pede senha */}
              <button
                type="button"
                onClick={handleToggleClick}
                className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none ${
                  enabled
                    ? 'bg-red-600 border-red-600'
                    : 'bg-gray-300 border-gray-300'
                }`}
                role="switch"
                aria-checked={enabled}
                title={enabled ? 'Clique para desativar (requer senha)' : 'Clique para ativar (requer senha)'}
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

      {/* Seção: Segurança — Alterar senha */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#1B2A4A]" />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
            Segurança
          </span>
        </div>

        <div className="p-5">
          <div className="max-w-md">
            <p className="text-sm font-semibold text-gray-800 mb-1">Alterar Senha Administrativa</p>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              A senha protege alterações nas configurações do sistema. A senha padrão inicial é <code className="bg-gray-100 px-1 rounded text-gray-700">ambev</code>.
            </p>

            <form onSubmit={handleAlterarSenha} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Senha atual</label>
                <div className="relative">
                  <input
                    type={mostrarSenhas ? 'text' : 'password'}
                    value={senhaAtual}
                    onChange={e => { setSenhaAtual(e.target.value); setErroSenha(''); }}
                    placeholder="••••••"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <button type="button" onClick={() => setMostrarSenhas(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {mostrarSenhas ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nova senha</label>
                <input
                  type={mostrarSenhas ? 'text' : 'password'}
                  value={senhaNova}
                  onChange={e => { setSenhaNova(e.target.value); setErroSenha(''); }}
                  placeholder="Mínimo 4 caracteres"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Confirmar nova senha</label>
                <input
                  type={mostrarSenhas ? 'text' : 'password'}
                  value={senhaConfirm}
                  onChange={e => { setSenhaConfirm(e.target.value); setErroSenha(''); }}
                  placeholder="Repita a nova senha"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              {erroSenha && (
                <p className="text-xs text-red-600 font-medium">{erroSenha}</p>
              )}

              {sucessoSenha && (
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-semibold">Senha alterada com sucesso!</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!senhaAtual || !senhaNova || !senhaConfirm}
                className="px-5 py-2 bg-[#1B2A4A] text-white text-sm font-bold rounded-lg hover:bg-[#152238] transition-colors disabled:opacity-40"
              >
                Salvar nova senha
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
