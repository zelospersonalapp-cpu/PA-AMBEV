import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { VAgenda, AreaEmpresa, Colaborador, Local } from '../types';
import { FileBarChart2, Download, Mail, RefreshCw, Filter, ChevronDown, X, ArrowDownCircle, ArrowUpCircle, CheckSquare } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// ─── tipos ───────────────────────────────────────────────────────────────────
interface RateioArea {
  area_id: string;
  area_nome: string;
  dias: number;
  pct_uso: number;
  pct_ajuste: number;
  valor: number;
  // ids dos agendamentos que compõem este rateio
  agendamento_ids: string[];
}

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmt = (d: string) => {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

const fmtCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const today = () => {
  const d = new Date();
  return d.toISOString().slice(0, 10);
};

const firstOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

// máscara monetária: converte "25500" → "25.500,00"
const aplicarMascaraMonetaria = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10);
  return (num / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ─── logo Facilities CRJ para PDF ────────────────────────────────────────────
// Carregado de /logo-facilities-crj.png (fundo branco, ícone preto) no exportarPDF

// ─── componente ──────────────────────────────────────────────────────────────
export const RelatorioUso: React.FC = () => {
  // filtros
  const [dataIni, setDataIni] = useState(firstOfMonth());
  const [dataFim, setDataFim] = useState(today());
  const [filtroPor, setFiltroPor] = useState<'solicitante' | 'area' | 'local'>('area');
  const [filtroSolicitanteId, setFiltroSolicitanteId] = useState('');
  const [filtroSolicitanteBusca, setFiltroSolicitanteBusca] = useState('');
  const [solicitanteDropdownOpen, setSolicitanteDropdownOpen] = useState(false);
  const [filtroArea, setFiltroArea] = useState('');
  const [filtroLocalUg, setFiltroLocalUg] = useState('');
  const filtrouAlgumCampo = filtroArea !== '' || filtroLocalUg !== '' || filtroSolicitanteId !== '';

  // dados
  const [agendamentos, setAgendamentos] = useState<VAgenda[]>([]);
  const [areas, setAreas] = useState<AreaEmpresa[]>([]);
  const [solicitantes, setSolicitantes] = useState<Colaborador[]>([]);
  const [locais, setLocais] = useState<Local[]>([]);
  const [loading, setLoading] = useState(false);
  const [gerou, setGerou] = useState(false);

  // seleção de linhas
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  // itens movidos para rateio manual (ids)
  const [itensManuaisRateio, setItensManuaisRateio] = useState<string[]>([]);

  // rateio
  const [modoRateio, setModoRateio] = useState<'proporcional' | 'direto'>('proporcional');
  const [valorAluguel, setValorAluguel] = useState('');
  const [rateio, setRateio] = useState<RateioArea[]>([]);
  const [valoresDiretos, setValoresDiretos] = useState<Record<string, string>>({});

  // Locais ordenados para dropdown
  const locaisOrdenados = [...locais].sort((a, b) => a.ug.localeCompare(b.ug));

  // Solicitantes filtrados
  const solicitantesFiltrados = solicitantes.filter(s =>
    s.nome.toLowerCase().includes(filtroSolicitanteBusca.toLowerCase())
  );

  // dados visíveis na tabela = todos os agendamentos EXCETO os que foram para rateio manual
  const dadosTabela = agendamentos.filter(a => !itensManuaisRateio.includes(a.id));
  // dados no painel de rateio manual
  const dadosRateioManual = agendamentos.filter(a => itensManuaisRateio.includes(a.id));

  useEffect(() => {
    Promise.all([
      supabase.from('areas_empresas').select('*').order('nome', { ascending: true }),
      supabase.from('colaboradores').select('*').eq('papel', 'solicitante').eq('ativo', true).order('nome', { ascending: true }),
      supabase.from('locais').select('*').eq('ativo', true).order('ug', { ascending: true }),
    ]).then(([areasRes, solRes, locaisRes]) => {
      if (areasRes.data) setAreas(areasRes.data as AreaEmpresa[]);
      if (solRes.data) setSolicitantes(solRes.data as Colaborador[]);
      if (locaisRes.data) setLocais(locaisRes.data as Local[]);
    });
  }, []);

  useEffect(() => {
    calcularRateio(dadosRateioManual, rateio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agendamentos, valorAluguel, itensManuaisRateio]);

  const calcularRateio = (dados: VAgenda[], rateioAtual: RateioArea[]) => {
    const map: Record<string, { nome: string; dias: number; ids: string[] }> = {};
    dados.forEach(a => {
      const id = a.area_empresa_id || '__sem_area__';
      const nome = (a as any).area_empresa || a.area_nome || a.nome_area || (a.area_empresa_id ? a.area_empresa_id : 'Sem área');
      const dur = a.duracao_dias ?? 1;
      if (!map[id]) map[id] = { nome, dias: 0, ids: [] };
      map[id].dias += dur;
      map[id].ids.push(a.id);
    });
    const totalDias = Object.values(map).reduce((s, v) => s + v.dias, 0);
    const valor = parseFloat(valorAluguel.replace(/\./g, '').replace(',', '.')) || 0;

    const novo: RateioArea[] = Object.entries(map).map(([id, v]) => {
      const pctUso = totalDias > 0 ? (v.dias / totalDias) * 100 : 0;
      const anterior = rateioAtual.find(r => r.area_id === id);
      const pctAjuste = anterior ? anterior.pct_ajuste : 0;
      const pctFinal = Math.max(0, pctUso + pctAjuste);
      return {
        area_id: id,
        area_nome: v.nome,
        dias: v.dias,
        pct_uso: pctUso,
        pct_ajuste: pctAjuste,
        valor: valor * (pctFinal / 100),
        agendamento_ids: v.ids,
      };
    });
    setRateio(novo);
  };

  const atualizarAjuste = (area_id: string, ajuste: number) => {
    const novo = rateio.map(r => {
      if (r.area_id !== area_id) return r;
      const pctFinal = Math.max(0, r.pct_uso + ajuste);
      const valor = (parseFloat(valorAluguel.replace(/\./g, '').replace(',', '.')) || 0) * (pctFinal / 100);
      return { ...r, pct_ajuste: ajuste, valor };
    });
    setRateio(novo);
  };

  const limparFiltros = () => {
    setDataIni(firstOfMonth());
    setDataFim(today());
    setFiltroPor('area');
    setFiltroArea('');
    setFiltroLocalUg('');
    setFiltroSolicitanteId('');
    setFiltroSolicitanteBusca('');
  };

  const gerarRelatorio = async () => {
    setLoading(true);
    setGerou(false);
    setSelecionados(new Set());
    setItensManuaisRateio([]);
    let query = supabase
      .from('v_agenda')
      .select('*')
      .gte('data_inicio', dataIni)
      .lte('data_inicio', dataFim)
      .order('data_inicio', { ascending: true });

    if (filtroPor === 'solicitante' && filtroSolicitanteId) {
      query = query.eq('solicitante_id', filtroSolicitanteId);
    }
    if (filtroPor === 'area' && filtroArea) {
      query = query.eq('area_empresa_id', filtroArea);
    }
    if (filtroPor === 'local' && filtroLocalUg) {
      query = query.eq('local_id', filtroLocalUg);
    }

    const { data, error } = await query;
    if (!error && data) {
      setAgendamentos(data as VAgenda[]);
      calcularRateio(data as VAgenda[], rateio);
      setGerou(true);
    }
    setLoading(false);
  };

  // ── seleção ──────────────────────────────────────────────────────────────
  const toggleSelecionado = (id: string) => {
    setSelecionados(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const toggleSelecionarTodos = () => {
    if (selecionados.size === dadosTabela.length && dadosTabela.length > 0) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(dadosTabela.map(a => a.id)));
    }
  };

  const moverParaRateio = () => {
    if (selecionados.size === 0) return;
    setItensManuaisRateio(prev => {
      const novo = [...prev];
      selecionados.forEach(id => { if (!novo.includes(id)) novo.push(id); });
      return novo;
    });
    setSelecionados(new Set());
  };

  const devolverParaLista = (id: string) => {
    setItensManuaisRateio(prev => prev.filter(i => i !== id));
  };

  // ── totais ───────────────────────────────────────────────────────────────
  const totalDias = dadosTabela.reduce((s, a) => s + (a.duracao_dias ?? 1), 0) +
    dadosRateioManual.reduce((s, a) => s + (a.duracao_dias ?? 1), 0);
  const totalRateio = rateio.reduce((s, r) => s + r.valor, 0);

  // ── exportar PDF ─────────────────────────────────────────────────────────
  const exportarPDF = () => {
    const valorNum = parseFloat(valorAluguel.replace(/\./g, '').replace(',', '.')) || 0;
    const todosAgendamentos = agendamentos;

    const buildPdf = (logoDataUrl: string | null) => {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const W = doc.internal.pageSize.width;

      // ── cabeçalho com fundo escuro ──────────────────────────────────────
      doc.setFillColor(27, 42, 74);
      doc.rect(0, 0, W, 32, 'F');

      // logo (fundo escuro, logo branca)
      if (logoDataUrl) {
        try { doc.addImage(logoDataUrl, 'PNG', 8, 4, 24, 24); } catch (_) { /* sem logo */ }
      }

      // texto do cabeçalho
      doc.setFontSize(15);
      doc.setTextColor(245, 216, 0); // amarelo AmBev
      doc.setFont('helvetica', 'bold');
      doc.text('AmBev Facilities — Relatório de Uso de PTAs', 38, 13);

      doc.setFontSize(8.5);
      doc.setTextColor(200, 210, 230);
      doc.setFont('helvetica', 'normal');
      doc.text(`Período: ${fmt(dataIni)} a ${fmt(dataFim)}   |   Gerado em: ${fmt(today())}`, 38, 20);
      doc.text(`Total de registros: ${todosAgendamentos.length}   |   Total de dias-uso: ${totalDias}${valorNum > 0 ? `   |   Aluguel total: ${fmtCurrency(valorNum)}` : ''}`, 38, 26);

      // ── tabela de uso ───────────────────────────────────────────────────
      doc.setFontSize(10);
      doc.setTextColor(27, 42, 74);
      doc.setFont('helvetica', 'bold');
      doc.text('Detalhes de Uso', 10, 40);

      autoTable(doc, {
        startY: 44,
        head: [['Data Início', 'Data Fim', 'PTA', 'Solicitante', 'Área / Empresa', 'Local de Instalação', 'Centro cst OBZ', 'Atividade', 'Dias', 'Status']],
        body: todosAgendamentos.map(a => [
          fmt(a.data_inicio),
          fmt(a.data_fim),
          a.patrimonio || a.pta_patrimonio || '',
          a.solicitante_nome || a.nome_solicitante || '',
          (a as any).area_empresa || a.area_nome || a.nome_area || '',
          a.ponto_ref || a.local_descricao || a.ug || '',
          a.centro_cst_obz || '',
          a.tipo_atividade || '',
          String(a.duracao_dias ?? 1),
          a.status || '',
        ]),
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [27, 42, 74], textColor: [245, 216, 0], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 10, right: 10 },
      });

      // ── tabela rateio ───────────────────────────────────────────────────
      if (rateio.length > 0 && valorNum > 0) {
        const finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(10);
        doc.setTextColor(27, 42, 74);
        doc.setFont('helvetica', 'bold');
        doc.text(`Rateio de Custos — Aluguel total: ${fmtCurrency(valorNum)}`, 10, finalY);

        autoTable(doc, {
          startY: finalY + 4,
          head: [['Área / Empresa', 'Dias de Uso', '% Uso', 'Ajuste %', '% Final', 'Valor a Pagar', 'Centro de Custo (OBZ)']],
          body: rateio.map(r => {
            const pctFinal = Math.max(0, r.pct_uso + r.pct_ajuste);
            // pegar OBZ dos agendamentos desta área
            const obzSet = new Set(
              todosAgendamentos
                .filter(a => r.agendamento_ids.includes(a.id) && a.centro_cst_obz)
                .map(a => a.centro_cst_obz!)
            );
            return [
              r.area_nome,
              String(r.dias),
              r.pct_uso.toFixed(1) + '%',
              (r.pct_ajuste >= 0 ? '+' : '') + r.pct_ajuste.toFixed(1) + '%',
              pctFinal.toFixed(1) + '%',
              fmtCurrency(r.valor),
              [...obzSet].join(', ') || '—',
            ];
          }),
          foot: [['TOTAL', String(totalDias), '—', '—', '—', fmtCurrency(totalRateio), '']],
          styles: { fontSize: 8 },
          headStyles: { fillColor: [27, 42, 74], textColor: [245, 216, 0], fontStyle: 'bold' },
          footStyles: { fillColor: [240, 245, 255], textColor: [27, 42, 74], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          margin: { left: 10, right: 10 },
        });
      }

      // ── rodapé ──────────────────────────────────────────────────────────
      const pageH = doc.internal.pageSize.height;
      doc.setFillColor(27, 42, 74);
      doc.rect(0, pageH - 10, W, 10, 'F');
      doc.setFontSize(7);
      doc.setTextColor(200, 210, 230);
      doc.setFont('helvetica', 'normal');
      doc.text('AmBev Facilities — PPM — Controle Inteligente de Plataformas Elevatórias', 10, pageH - 3.5);
      doc.text(`Gerado em ${fmt(today())}`, W - 10, pageH - 3.5, { align: 'right' });

      doc.save(`relatorio-uso-ptas-${dataIni}-a-${dataFim}.pdf`);
    };

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        buildPdf(canvas.toDataURL('image/png'));
      } else {
        buildPdf(null);
      }
    };
    img.onerror = () => buildPdf(null);
    img.src = '/logo-facilities-crj.png';
  };

  // ── exportar Excel ───────────────────────────────────────────────────────
  const exportarExcel = () => {
    const valorNum = parseFloat(valorAluguel.replace(/\./g, '').replace(',', '.')) || 0;
    const todosAgendamentos = agendamentos;

    const linhasUso = todosAgendamentos.map(a => ({
      'Data Início': fmt(a.data_inicio),
      'Data Fim': fmt(a.data_fim),
      'PTA (Patrimônio)': a.patrimonio || a.pta_patrimonio || '',
      'Solicitante': a.solicitante_nome || a.nome_solicitante || '',
      'Área / Empresa': (a as any).area_empresa || a.area_nome || a.nome_area || '',
      'Local de Instalação': a.ponto_ref || a.local_descricao || a.ug || '',
      'Centro cst OBZ': a.centro_cst_obz || '',
      'Atividade': a.tipo_atividade || '',
      'Dias': a.duracao_dias ?? 1,
      'Status': a.status || '',
    }));

    const linhasRateio = rateio.map(r => {
      const pctFinal = Math.max(0, r.pct_uso + r.pct_ajuste);
      return {
        'Área / Empresa': r.area_nome,
        'Dias de Uso': r.dias,
        '% Uso (automático)': parseFloat(r.pct_uso.toFixed(2)),
        'Ajuste %': r.pct_ajuste,
        '% Final': parseFloat(pctFinal.toFixed(2)),
        'Valor a Pagar (R$)': parseFloat(r.valor.toFixed(2)),
      };
    });

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(linhasUso);
    const ws2 = XLSX.utils.json_to_sheet(linhasRateio);

    ws1['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 6 }, { wch: 12 }];
    ws2['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 16 }];

    XLSX.utils.book_append_sheet(wb, ws1, 'Uso de PTAs');
    XLSX.utils.book_append_sheet(wb, ws2, 'Rateio de Custos');

    const resumo = [
      { Info: 'Período', Valor: `${fmt(dataIni)} a ${fmt(dataFim)}` },
      { Info: 'Total de registros', Valor: todosAgendamentos.length },
      { Info: 'Total de dias-uso', Valor: totalDias },
      { Info: 'Valor total do aluguel', Valor: valorNum },
      { Info: 'Total rateado', Valor: parseFloat(totalRateio.toFixed(2)) },
    ];
    const ws3 = XLSX.utils.json_to_sheet(resumo);
    ws3['!cols'] = [{ wch: 24 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Resumo');

    XLSX.writeFile(wb, `relatorio-uso-ptas-${dataIni}-a-${dataFim}.xlsx`);
  };

  // ── compartilhar por e-mail corporativo ──────────────────────────────────
  const compartilharEmail = () => {
    const valorNum = parseFloat(valorAluguel.replace(/\./g, '').replace(',', '.')) || 0;
    const periodoStr = `${fmt(dataIni)} a ${fmt(dataFim)}`;

    const linhasRateioTexto = rateio
      .map(r => {
        const pctFinal = Math.max(0, r.pct_uso + r.pct_ajuste);
        return `    • ${r.area_nome}: ${r.dias} dias (${pctFinal.toFixed(1)}%) → ${fmtCurrency(r.valor)}`;
      })
      .join('\n');

    const subject = `[Facilities CRJ] Relatório de Uso de PTAs — ${periodoStr}`;

    const body =
`Prezados,

Encaminhamos o Relatório de Uso das Plataformas Elevatórias (PTAs) referente ao período de ${periodoStr}, gerado pelo Sistema de Gestão de PTAs — Centro de Inteligência Facilities CRJ.

─────────────────────────────────────────
SUMÁRIO DO PERÍODO
─────────────────────────────────────────
  • Período de referência: ${periodoStr}
  • Total de registros: ${agendamentos.length}
  • Total de dias-uso: ${totalDias}
${valorNum > 0 ? `  • Valor total do aluguel: ${fmtCurrency(valorNum)}` : ''}

─────────────────────────────────────────
ALOCAÇÃO DE CUSTOS POR CENTRO DE CUSTO
─────────────────────────────────────────
Conforme apuração do período, os valores a serem alocados nos respectivos centros de custo são:

${linhasRateioTexto}

${valorNum > 0 ? `  TOTAL RATEADO: ${fmtCurrency(totalRateio)}` : ''}

─────────────────────────────────────────

Solicitamos que os valores acima sejam lançados nos centros de custo (OBZ) de cada área conforme indicado.

Em caso de dúvidas ou necessidade de ajustes no rateio, favor entrar em contato com a equipe de Facilities.

Atenciosamente,

Centro de Inteligência Facilities — CRJ
AmBev | Plataformas Elevatórias (PTAs)
Sistema de Gestão de PTAs — PPM Facilities`;

    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body).replace(/%0A/g, '%0D%0A');

    const outlookUrl = `https://outlook.office.com/mail/deeplink/compose?subject=${encodedSubject}&body=${encodedBody}`;
    window.open(outlookUrl, '_blank');
  };

  // ── salvar rateio ────────────────────────────────────────────────────────
  const salvarRateio = async () => {
    const valorNum = parseFloat(valorAluguel.replace(/\./g, '').replace(',', '.')) || 0;

    const registros = modoRateio === 'direto'
      ? rateio.map(r => ({
          area_empresa_id: r.area_id,
          periodo_ini: dataIni,
          periodo_fim: dataFim,
          dias_uso: r.dias,
          pct_uso: null,
          pct_ajuste: null,
          pct_final: null,
          valor_aluguel: null,
          valor_rateado: parseFloat((valoresDiretos[r.area_id] || '0').replace(/\./g, '').replace(',', '.')) || 0,
          criado_em: new Date().toISOString(),
        }))
      : rateio.map(r => ({
          area_empresa_id: r.area_id,
          periodo_ini: dataIni,
          periodo_fim: dataFim,
          dias_uso: r.dias,
          pct_uso: parseFloat(r.pct_uso.toFixed(4)),
          pct_ajuste: r.pct_ajuste,
          pct_final: parseFloat(Math.max(0, r.pct_uso + r.pct_ajuste).toFixed(4)),
          valor_aluguel: valorNum,
          valor_rateado: parseFloat(r.valor.toFixed(2)),
          criado_em: new Date().toISOString(),
        }));

    const { error } = await supabase.from('rateio_custo_ptas').upsert(registros, {
      onConflict: 'area_empresa_id,periodo_ini,periodo_fim',
    });
    if (error) {
      alert('Não foi possível salvar o rateio no banco. Verifique a tabela "rateio_custo_ptas".');
    } else {
      alert('Rateio salvo com sucesso!');
    }
  };

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1B2A4A] flex items-center justify-center shadow">
            <FileBarChart2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1B2A4A]">Relatório de Uso</h2>
            <p className="text-xs text-gray-500">Uso de PTAs, rateio de custos e exportação</p>
          </div>
        </div>
        {gerou && (
          <div className="flex items-center gap-2">
            <button
              onClick={exportarPDF}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
            <button
              onClick={exportarExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white text-xs font-bold shadow transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Excel
            </button>
            <button
              onClick={compartilharEmail}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0078D4] hover:bg-[#006CBE] text-white text-xs font-bold shadow transition-colors"
            >
              <Mail className="w-3.5 h-3.5" /> E-mail
            </button>
          </div>
        )}
      </div>

      {/* painel de filtros */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#1B2A4A]" />
            <span className="text-sm font-bold text-[#1B2A4A]">Filtros do Relatório</span>
          </div>
          {filtrouAlgumCampo && (
            <button
              onClick={limparFiltros}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-gray-300 text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:text-red-600 hover:border-red-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Limpar Filtros
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* período */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Data Início</label>
            <input
              type="date"
              value={dataIni}
              onChange={e => setDataIni(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5D800] focus:border-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Data Fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5D800] focus:border-amber-400"
            />
          </div>
          {/* filtrar por */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Filtrar por</label>
            <select
              value={filtroPor}
              onChange={e => setFiltroPor(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5D800] focus:border-amber-400"
            >
              <option value="area">Área / Empresa</option>
              <option value="solicitante">Solicitante</option>
              <option value="local">Local de Instalação</option>
            </select>
          </div>
          {/* valor do filtro */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              {filtroPor === 'area' ? 'Área' : filtroPor === 'solicitante' ? 'Solicitante' : 'Local de Instalação'}
              <span className="font-normal text-gray-400 ml-1">(deixe vazio para todos)</span>
            </label>
            {filtroPor === 'area' ? (
              <select
                value={filtroArea}
                onChange={e => setFiltroArea(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5D800] focus:border-amber-400"
              >
                <option value="">Todas as áreas</option>
                {areas.map(a => (
                  <option key={a.id} value={a.id}>{a.nome}</option>
                ))}
              </select>
            ) : filtroPor === 'solicitante' ? (
              <div className="relative">
                <input
                  type="text"
                  value={filtroSolicitanteBusca}
                  onChange={e => {
                    setFiltroSolicitanteBusca(e.target.value);
                    setFiltroSolicitanteId('');
                    setSolicitanteDropdownOpen(true);
                  }}
                  onFocus={() => setSolicitanteDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setSolicitanteDropdownOpen(false), 150)}
                  placeholder="Digite ou selecione..."
                  autoComplete="off"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5D800] focus:border-amber-400 uppercase"
                />
                {filtroSolicitanteBusca && filtroSolicitanteId && (
                  <button
                    type="button"
                    onClick={() => { setFiltroSolicitanteBusca(''); setFiltroSolicitanteId(''); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  ><X className="w-3.5 h-3.5" /></button>
                )}
                {solicitanteDropdownOpen && solicitantesFiltrados.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    <div
                      className="px-3 py-2 text-xs text-gray-400 cursor-pointer hover:bg-gray-50"
                      onMouseDown={() => { setFiltroSolicitanteBusca(''); setFiltroSolicitanteId(''); setSolicitanteDropdownOpen(false); }}
                    >Todos os solicitantes</div>
                    {solicitantesFiltrados.map(s => (
                      <div
                        key={s.id}
                        onMouseDown={() => {
                          setFiltroSolicitanteId(s.id);
                          setFiltroSolicitanteBusca(s.nome);
                          setSolicitanteDropdownOpen(false);
                        }}
                        className={`px-3 py-2 text-sm uppercase cursor-pointer hover:bg-amber-50 hover:text-[#1B2A4A] transition-colors ${filtroSolicitanteId === s.id ? 'bg-amber-50 font-bold text-[#1B2A4A]' : ''}`}
                      >{s.nome}</div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <select
                value={filtroLocalUg}
                onChange={e => setFiltroLocalUg(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5D800] focus:border-amber-400"
              >
                <option value="">Todos os locais</option>
                {locaisOrdenados.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.ug}{l.setor_linha ? ` · ${l.setor_linha}` : ''}{(l as any).ponto_ref ? ` — ${(l as any).ponto_ref}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          {/* botão limpar sempre visível abaixo quando não está no topo */}
          <div />
          <div className="flex items-center gap-2">
            {(dataIni !== firstOfMonth() || dataFim !== today()) && (
              <button
                onClick={limparFiltros}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-500 hover:text-red-600 hover:border-red-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Limpar
              </button>
            )}
            <button
              onClick={gerarRelatorio}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#1B2A4A] hover:bg-[#243656] text-white text-sm font-bold shadow transition-colors disabled:opacity-60"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
              {loading ? 'Carregando...' : 'Gerar Relatório'}
            </button>
          </div>
        </div>
      </div>

      {/* resultados */}
      {gerou && (
        <>
          {/* cards resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
              <p className="text-xs text-gray-500 font-medium mb-1">Registros</p>
              <p className="text-2xl font-extrabold text-[#1B2A4A]">{agendamentos.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
              <p className="text-xs text-gray-500 font-medium mb-1">Dias-uso Total</p>
              <p className="text-2xl font-extrabold text-[#1B2A4A]">{totalDias}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
              <p className="text-xs text-gray-500 font-medium mb-1">Áreas envolvidas</p>
              <p className="text-2xl font-extrabold text-[#1B2A4A]">{rateio.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
              <p className="text-xs text-gray-500 font-medium mb-1">Total rateado</p>
              <p className="text-lg font-extrabold text-green-700">
                {totalRateio > 0 ? fmtCurrency(totalRateio) : '—'}
              </p>
            </div>
          </div>

          {/* tabela de uso com checkboxes */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold text-[#1B2A4A]">Detalhes de Uso no Período</h3>
                <span className="text-xs text-gray-500">{dadosTabela.length} registro(s)</span>
                {dadosRateioManual.length > 0 && (
                  <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                    {dadosRateioManual.length} no rateio
                  </span>
                )}
              </div>
              {selecionados.size > 0 && (
                <button
                  onClick={moverParaRateio}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow transition-colors"
                >
                  <ArrowDownCircle className="w-3.5 h-3.5" />
                  Mover {selecionados.size} para Rateio ↓
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-[#1B2A4A] text-white">
                    <th className="px-2 py-2 text-center w-7">
                      <input
                        type="checkbox"
                        checked={dadosTabela.length > 0 && selecionados.size === dadosTabela.length}
                        ref={el => { if (el) el.indeterminate = selecionados.size > 0 && selecionados.size < dadosTabela.length; }}
                        onChange={toggleSelecionarTodos}
                        className="w-3 h-3 rounded accent-amber-400 cursor-pointer"
                        title="Selecionar todos"
                      />
                    </th>
                    <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Início</th>
                    <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Fim</th>
                    <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">PTA</th>
                    <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Solicitante</th>
                    <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Área</th>
                    <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Local de Instalação</th>
                    <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">OBZ</th>
                    <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Atividade</th>
                    <th className="px-2 py-2 text-center font-semibold">Dias</th>
                    <th className="px-2 py-2 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dadosTabela.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-gray-400">
                        {dadosRateioManual.length > 0
                          ? 'Todos os registros foram movidos para o Rateio abaixo.'
                          : 'Nenhum registro encontrado no período.'}
                      </td>
                    </tr>
                  ) : (
                    dadosTabela.map((a, i) => {
                      const sel = selecionados.has(a.id);
                      return (
                        <tr
                          key={a.id}
                          className={`cursor-pointer transition-colors ${sel ? 'bg-amber-50 border-l-4 border-l-amber-400' : i % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-amber-50/30'}`}
                          onClick={() => toggleSelecionado(a.id)}
                        >
                          <td className="px-2 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={sel}
                              onChange={() => toggleSelecionado(a.id)}
                              className="w-3 h-3 rounded accent-amber-400 cursor-pointer"
                            />
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{fmt(a.data_inicio)}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{fmt(a.data_fim)}</td>
                          <td className="px-2 py-1.5 font-mono whitespace-nowrap">{a.patrimonio || a.pta_patrimonio || '—'}</td>
                          <td className="px-2 py-1.5 uppercase">{a.solicitante_nome || a.nome_solicitante || '—'}</td>
                          <td className="px-2 py-1.5 uppercase">{(a as any).area_empresa || a.area_nome || a.nome_area || '—'}</td>
                          <td className="px-2 py-1.5">{a.ponto_ref || a.local_descricao || a.ug || '—'}</td>
                          <td className="px-2 py-1.5 font-mono text-amber-700">{a.centro_cst_obz || '—'}</td>
                          <td className="px-2 py-1.5">{a.tipo_atividade || '—'}</td>
                          <td className="px-2 py-1.5 text-center font-bold">{a.duracao_dias ?? 1}</td>
                          <td className="px-2 py-1.5">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              a.status === 'concluido' ? 'bg-green-100 text-green-700' :
                              a.status === 'cancelado' ? 'bg-red-100 text-red-600' :
                              a.status === 'em_uso' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {a.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* painel de itens no rateio manual */}
          {dadosRateioManual.length > 0 && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-amber-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowDownCircle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-bold text-amber-800">
                    Itens selecionados para Rateio ({dadosRateioManual.length})
                  </span>
                </div>
                <span className="text-xs text-amber-600">Clique em ↑ para devolver à lista</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-amber-100 text-amber-900">
                      <th className="px-2 py-2 text-center w-7">↑</th>
                      <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Início</th>
                      <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Fim</th>
                      <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">PTA</th>
                      <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Solicitante</th>
                      <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Área</th>
                      <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Local de Instalação</th>
                      <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">OBZ</th>
                      <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Atividade</th>
                      <th className="px-2 py-2 text-center font-semibold">Dias</th>
                      <th className="px-2 py-2 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dadosRateioManual.map((a, i) => (
                      <tr key={a.id} className={i % 2 === 0 ? 'bg-amber-50' : 'bg-amber-100/40'}>
                        <td className="px-2 py-1.5 text-center">
                          <button
                            onClick={() => devolverParaLista(a.id)}
                            title="Devolver para a lista"
                            className="w-5 h-5 rounded-full bg-white border border-amber-300 hover:bg-amber-200 flex items-center justify-center text-amber-700 font-bold transition-colors mx-auto"
                          >
                            <ArrowUpCircle className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{fmt(a.data_inicio)}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{fmt(a.data_fim)}</td>
                        <td className="px-2 py-1.5 font-mono whitespace-nowrap">{a.patrimonio || a.pta_patrimonio || '—'}</td>
                        <td className="px-2 py-1.5 uppercase">{a.solicitante_nome || a.nome_solicitante || '—'}</td>
                        <td className="px-2 py-1.5 uppercase">{(a as any).area_empresa || a.area_nome || a.nome_area || '—'}</td>
                        <td className="px-2 py-1.5">{a.ponto_ref || a.local_descricao || a.ug || '—'}</td>
                        <td className="px-2 py-1.5 font-mono text-amber-700">{a.centro_cst_obz || '—'}</td>
                        <td className="px-2 py-1.5">{a.tipo_atividade || '—'}</td>
                        <td className="px-2 py-1.5 text-center font-bold">{a.duracao_dias ?? 1}</td>
                        <td className="px-2 py-1.5">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            a.status === 'concluido' ? 'bg-green-100 text-green-700' :
                            a.status === 'cancelado' ? 'bg-red-100 text-red-600' :
                            a.status === 'em_uso' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* rateio */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <h3 className="text-sm font-bold text-[#1B2A4A]">Rateio de Custos por Área</h3>
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                  <button
                    onClick={() => setModoRateio('proporcional')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${modoRateio === 'proporcional' ? 'bg-[#1B2A4A] text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Calcular por %
                  </button>
                  <button
                    onClick={() => setModoRateio('direto')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${modoRateio === 'direto' ? 'bg-[#1B2A4A] text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Valor Direto
                  </button>
                </div>
              </div>

              {modoRateio === 'proporcional' && (
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                  <div className="flex-1 max-w-xs">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Valor Total do Aluguel (R$)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-mono">R$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={valorAluguel}
                        onChange={e => {
                          const masked = aplicarMascaraMonetaria(e.target.value);
                          setValorAluguel(masked);
                        }}
                        placeholder="0,00"
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5D800] focus:border-amber-400 font-mono"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => calcularRateio(agendamentos, rateio)}
                    className="px-4 py-2 rounded-lg bg-[#1B2A4A] hover:bg-[#243656] text-white text-xs font-bold transition-colors"
                  >
                    Recalcular
                  </button>
                  {rateio.length > 0 && (
                    <button
                      onClick={salvarRateio}
                      className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors"
                    >
                      Salvar Rateio
                    </button>
                  )}
                </div>
              )}

              {modoRateio === 'direto' && (
                <div className="flex items-center gap-3">
                  <p className="text-xs text-gray-500">Digite o valor que cada área deve pagar diretamente na tabela abaixo.</p>
                  {rateio.length > 0 && (
                    <button
                      onClick={salvarRateio}
                      className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors whitespace-nowrap"
                    >
                      Salvar Rateio
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#1B2A4A] text-white">
                    <th className="px-3 py-2.5 text-left font-semibold">Área / Empresa</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Dias de Uso</th>
                    {modoRateio === 'proporcional' ? (
                      <>
                        <th className="px-3 py-2.5 text-center font-semibold">% pelo Uso</th>
                        <th className="px-3 py-2.5 text-center font-semibold">Ajuste %</th>
                        <th className="px-3 py-2.5 text-center font-semibold">% Final</th>
                      </>
                    ) : null}
                    <th className="px-3 py-2.5 text-right font-semibold">Valor a Pagar</th>
                  </tr>
                </thead>
                <tbody>
                  {rateio.length === 0 ? (
                    <tr>
                      <td colSpan={modoRateio === 'proporcional' ? 6 : 3} className="px-4 py-8 text-center text-gray-400">
                        Gere o relatório para ver o rateio.
                      </td>
                    </tr>
                  ) : modoRateio === 'proporcional' ? (
                    rateio.map((r, i) => {
                      const pctFinal = Math.max(0, r.pct_uso + r.pct_ajuste);
                      return (
                        <tr key={r.area_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2 font-semibold uppercase">{r.area_nome}</td>
                          <td className="px-3 py-2 text-center font-bold">{r.dias}</td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">
                              {r.pct_uso.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => atualizarAjuste(r.area_id, parseFloat((r.pct_ajuste - 1).toFixed(1)))}
                                className="w-5 h-5 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-700 font-bold text-sm leading-none"
                              >−</button>
                              <input
                                type="number"
                                step="0.1"
                                value={r.pct_ajuste}
                                onChange={e => atualizarAjuste(r.area_id, parseFloat(e.target.value) || 0)}
                                className="w-14 text-center px-1 py-0.5 border border-gray-300 rounded text-xs font-mono focus:ring-1 focus:ring-amber-400"
                              />
                              <button
                                onClick={() => atualizarAjuste(r.area_id, parseFloat((r.pct_ajuste + 1).toFixed(1)))}
                                className="w-5 h-5 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-700 font-bold text-sm leading-none"
                              >+</button>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded font-bold ${
                              pctFinal > r.pct_uso ? 'bg-amber-50 text-amber-700' :
                              pctFinal < r.pct_uso ? 'bg-purple-50 text-purple-700' :
                              'bg-gray-50 text-gray-600'
                            }`}>
                              {pctFinal.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-green-700">
                            {(parseFloat(valorAluguel.replace(/\./g, '').replace(',', '.')) || 0) > 0
                              ? fmtCurrency(r.valor)
                              : '—'}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    rateio.map((r, i) => {
                      const valorDireto = parseFloat((valoresDiretos[r.area_id] || '').replace(/\./g, '').replace(',', '.')) || 0;
                      return (
                        <tr key={r.area_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2 font-semibold uppercase">{r.area_nome}</td>
                          <td className="px-3 py-2 text-center font-bold">{r.dias}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-gray-400 text-xs">R$</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={valoresDiretos[r.area_id] || ''}
                                onChange={e => {
                                  const masked = aplicarMascaraMonetaria(e.target.value);
                                  setValoresDiretos(prev => ({ ...prev, [r.area_id]: masked }));
                                }}
                                placeholder="0,00"
                                className="w-28 text-right px-2 py-1 border border-gray-300 rounded text-xs font-mono focus:ring-1 focus:ring-amber-400 font-bold text-green-700"
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {rateio.length > 0 && (
                  <tfoot>
                    <tr className="bg-[#F0F4FF] border-t-2 border-[#1B2A4A]">
                      <td className="px-3 py-2.5 font-extrabold text-[#1B2A4A] uppercase">Total</td>
                      <td className="px-3 py-2.5 text-center font-extrabold text-[#1B2A4A]">{totalDias}</td>
                      {modoRateio === 'proporcional' ? (
                        <>
                          <td className="px-3 py-2.5 text-center font-extrabold text-[#1B2A4A]">100%</td>
                          <td className="px-3 py-2.5 text-center">—</td>
                          <td className="px-3 py-2.5 text-center">—</td>
                        </>
                      ) : null}
                      <td className="px-3 py-2.5 text-right font-extrabold text-green-700 text-sm">
                        {modoRateio === 'proporcional'
                          ? (totalRateio > 0 ? fmtCurrency(totalRateio) : '—')
                          : (() => {
                              const soma = Object.values(valoresDiretos).reduce((s, v) => s + (parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0), 0);
                              return soma > 0 ? fmtCurrency(soma) : '—';
                            })()
                        }
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      {!gerou && !loading && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <FileBarChart2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Configure os filtros e clique em <strong>Gerar Relatório</strong></p>
          <p className="text-xs text-gray-400 mt-1">O sistema buscará os agendamentos do período e calculará o rateio automaticamente.</p>
        </div>
      )}
    </div>
  );
};
