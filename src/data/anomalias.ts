export interface GrupoAnomalia {
  categoria: string;
  opcoes: string[];
}

export const GRUPOS_ANOMALIA: GrupoAnomalia[] = [
  {
    categoria: 'SISTEMA ELÉTRICO / BATERIA',
    opcoes: [
      'Bateria descarregada',
      'Bateria danificada / inchada',
      'Falha no carregador',
      'Curto-circuito elétrico',
      'Falha no painel de controle',
      'Fusível queimado',
      'Falha no motor elétrico',
      'Cabo elétrico danificado',
      'Sensor com defeito',
    ],
  },
  {
    categoria: 'SISTEMA HIDRÁULICO',
    opcoes: [
      'Vazamento de óleo hidráulico',
      'Falha na bomba hidráulica',
      'Cilindro hidráulico com vazamento',
      'Mangueira hidráulica rompida',
      'Pressão hidráulica insuficiente',
    ],
  },
  {
    categoria: 'ESTRUTURA / CHASSI',
    opcoes: [
      'Fissura ou trinca na estrutura',
      'Amassado / deformação na lança',
      'Parafuso ou porca faltando',
      'Soldagem quebrada',
      'Plataforma / cesto danificado',
      'Guarda-corpo danificado ou faltando',
      'Trava de segurança com defeito',
    ],
  },
  {
    categoria: 'SISTEMA DE LOCOMOÇÃO / RODAS',
    opcoes: [
      'Furo de pneu',
      'Pneu desgastado',
      'Roda danificada',
      'Falha no sistema de tração',
      'Freio com defeito',
      'Freio de estacionamento falhando',
      'Rolamento danificado',
    ],
  },
  {
    categoria: 'SISTEMA DE ARTICULAÇÃO / ELEVAÇÃO (PARA ARTICULADA)',
    opcoes: [
      'Falha na articulação do braço',
      'Lança não sobe / não desce',
      'Rotação da torre travada',
      'Junta rotativa com vazamento',
      'Falha no nivelamento automático',
    ],
  },
  {
    categoria: 'SISTEMA DE TESOURA (PARA TESOURINHA)',
    opcoes: [
      'Tesoura não sobe / não desce',
      'Falha no alinhamento da tesoura',
      'Pino da tesoura quebrado',
      'Cilindro da tesoura com vazamento',
    ],
  },
  {
    categoria: 'SEGURANÇA',
    opcoes: [
      'Alarme de inclinação disparando incorretamente',
      'Sensor de sobrepeso com defeito',
      'Sistema de emergência falhando',
      'Botão de parada de emergência com defeito',
      'Extintor vencido ou faltando',
      'Sinalização de segurança faltando',
    ],
  },
  {
    categoria: 'OUTROS',
    opcoes: [
      'Vazamento de combustível (para modelos a combustão)',
      'Superaquecimento do motor',
      'Falha no sistema de direção',
      'Ruído / vibração anormal',
      'Outro (descrever na observação)',
    ],
  },
];
