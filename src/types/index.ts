export type PtaTipo = 'articulada' | 'tesourinha';
export type PtaStatus = 'disponivel' | 'em_uso' | 'em_manutencao' | 'avariada' | 'inativa';

export interface PTA {
  id: string;
  patrimonio: string;
  tipo: PtaTipo;
  modelo: string;
  fabricante: string;
  altura_max_m: number;
  capacidade_kg: number;
  num_serie?: string | null;
  nivel_bateria: number;
  status: PtaStatus;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Local {
  id: string;
  ug: string;
  setor_linha: string;
  ponto_ref?: string | null;
  descricao?: string | null;
  ativo: boolean;
  created_at?: string;
}

export type AreaTipo = 'area_interna' | 'empresa_terceira';

export interface AreaEmpresa {
  id: string;
  nome: string;
  tipo: AreaTipo;
  contato?: string | null;
  ativo: boolean;
  created_at?: string;
}

export type ColaboradorPapel = 'solicitante' | 'liberador' | 'operador' | 'admin';

export interface Colaborador {
  id: string;
  nome: string;
  matricula: string;
  area_empresa_id?: string | null;
  papel: ColaboradorPapel;
  contato?: string | null;
  ativo: boolean;
  created_at?: string;
}

export type FrequenciaRecorrencia = 'semanal' | 'quinzenal';

export interface Recorrencia {
  id: string;
  area_empresa_id: string;
  pta_id?: string | null;
  local_id: string;
  dia_semana: number; // 0=dom, 1=seg, 2=ter, 3=qua, 4=qui, 5=sex, 6=sáb
  frequencia: FrequenciaRecorrencia;
  prioritario: boolean;
  tipo_atividade: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  ativo: boolean;
  created_at?: string;
  // joined fields for UI
  area_empresa?: AreaEmpresa;
  pta?: PTA;
  local?: Local;
}

export type PrioridadeAgendamento = 'normal' | 'prioritario';
export type OrigemAgendamento = 'avulso' | 'recorrente';
export type StatusAgendamento = 'agendado' | 'liberado' | 'retirado' | 'em_uso' | 'concluido' | 'cancelado';

export interface Agendamento {
  id: string;
  pta_id: string;
  area_empresa_id: string;
  solicitante_id: string;
  local_id: string;
  data_inicio: string;
  data_fim: string;
  duracao_dias?: number;
  tipo_atividade: string;
  descricao?: string | null;
  prioridade: PrioridadeAgendamento;
  origem: OrigemAgendamento;
  recorrencia_id?: string | null;
  status: StatusAgendamento;
  liberado_por?: string | null;
  liberado_em?: string | null;
  retirado_por?: string | null;
  retirado_em?: string | null;
  assinatura_retirada?: boolean;
  devolvido_em?: string | null;
  entregou_no_prazo?: boolean | null;
  entregou_local_combinado?: boolean | null;
  posicionou_carregamento?: boolean | null;
  obs_sla?: string | null;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface VAgenda {
  id: string;
  pta_id: string;
  patrimonio?: string;
  pta_patrimonio?: string;
  tipo_pta?: PtaTipo;
  pta_tipo?: PtaTipo;
  modelo_pta?: string;
  pta_modelo?: string;
  area_empresa_id: string;
  area_nome?: string;
  nome_area?: string;
  solicitante_id: string;
  solicitante_nome?: string;
  nome_solicitante?: string;
  local_id: string;
  ug?: string;
  setor_linha?: string;
  ponto_ref?: string;
  local_descricao?: string;
  data_inicio: string;
  data_fim: string;
  duracao_dias?: number;
  tipo_atividade: string;
  descricao?: string | null;
  prioridade: PrioridadeAgendamento;
  origem: OrigemAgendamento;
  recorrencia_id?: string | null;
  status: StatusAgendamento;
  liberado_por?: string | null;
  liberador_nome?: string | null;
  liberado_em?: string | null;
  retirado_por?: string | null;
  retirador_nome?: string | null;
  retirado_em?: string | null;
  assinatura_retirada?: boolean;
  devolvido_em?: string | null;
  entregou_no_prazo?: boolean | null;
  entregou_local_combinado?: boolean | null;
  posicionou_carregamento?: boolean | null;
  obs_sla?: string | null;
  observacoes?: string | null;
}

export type SeveridadeAvaria = 'baixa' | 'media' | 'alta' | 'critica';
export type StatusAvaria = 'aberta' | 'em_manutencao' | 'resolvida';

export interface Avaria {
  id: string;
  pta_id: string;
  agendamento_id?: string | null;
  reportado_por: string;
  data_avaria: string;
  descricao: string;
  severidade: SeveridadeAvaria;
  tipo_anomalia?: string | null;
  status: StatusAvaria;
  custo_estimado?: number | null;
  fotos?: string[] | null;
  resolvido_em?: string | null;
  resolvido_por?: string | null;
  observacoes?: string | null;
  created_at?: string;
  // joined
  pta?: PTA;
  reportador?: Colaborador;
  resolvedor?: Colaborador;
}

export type TipoChecklist = 'retirada' | 'devolucao';
export type EstadoGeralChecklist = 'ok' | 'com_ressalvas' | 'avariado';

export interface Checklist {
  id: string;
  agendamento_id: string;
  tipo: TipoChecklist;
  nivel_bateria: number;
  estado_geral: EstadoGeralChecklist;
  avarias_visiveis?: string | null;
  fotos?: string[] | null;
  realizado_por: string;
  realizado_em: string;
  assinatura_ok: boolean;
  observacoes?: string | null;
  created_at?: string;
}

export interface VConfiabilidadeAreas {
  area_id: string;
  area_nome: string;
  total_concluidos: number;
  pct_no_prazo: number;
  pct_local_ok: number;
  pct_carregamento: number;
  score_confiabilidade: number;
}

export interface VAvariasPTA {
  pta_id: string;
  patrimonio: string;
  modelo?: string;
  tipo: PtaTipo;
  total_avarias: number;
  avarias_abertas: number;
  ultima_avaria?: string | null;
}
