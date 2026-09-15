import type { PtaStatus, StatusAgendamento, SeveridadeAvaria, StatusAvaria } from '../types';

export function formatDateBR(dateString?: string | null): string {
  if (!dateString) return '-';
  try {
    // If it's pure YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    }
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatDateTimeBR(dateString?: string | null): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export function getPtaStatusConfig(status: PtaStatus) {
  switch (status) {
    case 'disponivel':
      return {
        label: 'Disponível',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-300',
        dot: 'bg-emerald-500',
      };
    case 'em_uso':
      return {
        label: 'Em Uso',
        bg: 'bg-blue-50 text-blue-700 border-blue-300',
        dot: 'bg-blue-500',
      };
    case 'em_manutencao':
      return {
        label: 'Em Manutenção',
        bg: 'bg-amber-50 text-amber-700 border-amber-300',
        dot: 'bg-amber-500',
      };
    case 'avariada':
      return {
        label: 'Avariada',
        bg: 'bg-rose-50 text-rose-700 border-rose-300',
        dot: 'bg-rose-500',
      };
    case 'inativa':
    default:
      return {
        label: 'Inativa',
        bg: 'bg-slate-100 text-slate-700 border-slate-300',
        dot: 'bg-slate-400',
      };
  }
}

export function getAgendamentoStatusConfig(status: StatusAgendamento) {
  switch (status) {
    case 'agendado':
      return {
        label: 'Agendado',
        bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        dot: 'bg-indigo-500',
      };
    case 'liberado':
      return {
        label: 'Liberado',
        bg: 'bg-sky-50 text-sky-700 border-sky-300',
        dot: 'bg-sky-500',
      };
    case 'retirado':
      return {
        label: 'Retirado',
        bg: 'bg-cyan-50 text-cyan-800 border-cyan-300',
        dot: 'bg-cyan-600',
      };
    case 'em_uso':
      return {
        label: 'Em Uso',
        bg: 'bg-blue-50 text-blue-700 border-blue-300',
        dot: 'bg-blue-600',
      };
    case 'concluido':
      return {
        label: 'Concluído',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-300',
        dot: 'bg-emerald-500',
      };
    case 'cancelado':
      return {
        label: 'Cancelado',
        bg: 'bg-slate-100 text-slate-600 border-slate-300',
        dot: 'bg-slate-400',
      };
    default:
      return {
        label: status,
        bg: 'bg-gray-100 text-gray-700 border-gray-300',
        dot: 'bg-gray-400',
      };
  }
}

export function getSeveridadeAvariaConfig(severidade: SeveridadeAvaria) {
  switch (severidade) {
    case 'baixa':
      return {
        label: 'Baixa',
        badge: 'bg-slate-100 text-slate-700 border-slate-300',
      };
    case 'media':
      return {
        label: 'Média',
        badge: 'bg-amber-100 text-amber-800 border-amber-300',
      };
    case 'alta':
      return {
        label: 'Alta (Bloqueia PTA)',
        badge: 'bg-orange-100 text-orange-800 border-orange-300',
      };
    case 'critica':
      return {
        label: 'Crítica (Bloqueia PTA)',
        badge: 'bg-rose-100 text-rose-800 border-rose-400 font-semibold',
      };
    default:
      return {
        label: severidade,
        badge: 'bg-slate-100 text-slate-700 border-slate-300',
      };
  }
}

export function getStatusAvariaConfig(status: StatusAvaria) {
  switch (status) {
    case 'aberta':
      return {
        label: 'Aberta',
        badge: 'bg-rose-50 text-rose-700 border-rose-300',
      };
    case 'em_manutencao':
      return {
        label: 'Em Manutenção',
        badge: 'bg-amber-50 text-amber-700 border-amber-300',
      };
    case 'resolvida':
      return {
        label: 'Resolvida',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-300',
      };
    default:
      return {
        label: status,
        badge: 'bg-slate-100 text-slate-700 border-slate-300',
      };
  }
}

export function getDayOfWeekName(dayNumber: number): string {
  const days = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];
  return days[dayNumber] ?? `Dia ${dayNumber}`;
}
