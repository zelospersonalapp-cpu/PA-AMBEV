import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { VAgenda, AreaEmpresa, Colaborador, Local } from '../types';
import { FileBarChart2, Download, Mail, RefreshCw, Filter, ChevronDown, X } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// ─── tipos ───────────────────────────────────────────────────────────────────
interface RateioArea {
  area_id: string;
  area_nome: string;
  dias: number;
  pct_uso: number;   // calculado automaticamente pelo uso
  pct_ajuste: number; // ajuste manual digitado pelo usuário
  valor: number;     // calculado pelo sistema
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

  // dados
  const [agendamentos, setAgendamentos] = useState<VAgenda[]>([]);
  const [areas, setAreas] = useState<AreaEmpresa[]>([]);
  const [solicitantes, setSolicitantes] = useState<Colaborador[]>([]);
  const [locais, setLocais] = useState<Local[]>([]);
  const [loading, setLoading] = useState(false);
  const [gerou, setGerou] = useState(false);

  // rateio
  const [modoRateio, setModoRateio] = useState<'proporcional' | 'direto'>('proporcional');
  const [valorAluguel, setValorAluguel] = useState('');
  const [rateio, setRateio] = useState<RateioArea[]>([]);
  const [valoresDiretos, setValoresDiretos] = useState<Record<string, string>>({}); // area_id -> valor string

  // Locais ordenados para dropdown (ug + setor_linha)
  const locaisOrdenados = [...locais].sort((a, b) => a.ug.localeCompare(b.ug));

  // Solicitantes filtrados pela busca
  const solicitantesFiltrados = solicitantes.filter(s =>
    s.nome.toLowerCase().includes(filtroSolicitanteBusca.toLowerCase())
  );

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

  // recalcular rateio sempre que agendamentos ou valor mudar
  useEffect(() => {
    calcularRateio(agendamentos, rateio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agendamentos, valorAluguel]);

  const calcularRateio = (dados: VAgenda[], rateioAtual: RateioArea[]) => {
    // agrupar por área
    const map: Record<string, { nome: string; dias: number }> = {};
    dados.forEach(a => {
      const id = a.area_empresa_id || '__sem_area__';
      const nome = (a as any).area_empresa || a.area_nome || a.nome_area || (a.area_empresa_id ? a.area_empresa_id : 'Sem área');
      const dur = a.duracao_dias ?? 1;
      if (!map[id]) map[id] = { nome, dias: 0 };
      map[id].dias += dur;
    });
    const totalDias = Object.values(map).reduce((s, v) => s + v.dias, 0);
    const valor = parseFloat(valorAluguel.replace(/\./g, '').replace(',', '.')) || 0;

    const novo: RateioArea[] = Object.entries(map).map(([id, v]) => {
      const pctUso = totalDias > 0 ? (v.dias / totalDias) * 100 : 0;
      // preservar ajuste manual se já existia
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
      };
    });

    // normalizar: redistribuir para que a soma fique 100%
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

  const gerarRelatorio = async () => {
    setLoading(true);
    setGerou(false);
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

  // ── dados filtrados para tabela ──────────────────────────────────────────
  const dados = agendamentos;

  // ── total dias no período ────────────────────────────────────────────────
  const totalDias = dados.reduce((s, a) => s + (a.duracao_dias ?? 1), 0);

  // ── soma rateio ──────────────────────────────────────────────────────────
  const totalRateio = rateio.reduce((s, r) => s + r.valor, 0);

  // ── exportar PDF ─────────────────────────────────────────────────────────
  const exportarPDF = () => {
    const valorNum = parseFloat(valorAluguel.replace(/\./g, '').replace(',', '.')) || 0;

    const buildPdf = (logoDataUrl: string | null) => {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // logo
      if (logoDataUrl) {
        try { doc.addImage(logoDataUrl, 'PNG', 10, 8, 22, 22); } catch (_) { /* sem logo */ }
      }

      // cabeçalho
      doc.setFontSize(14);
      doc.setTextColor(27, 42, 74);
      doc.text('AmBev Facilities — Relatório de Uso de PTAs', 38, 16);
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text(`Período: ${fmt(dataIni)} a ${fmt(dataFim)}   |   Gerado em: ${fmt(today())}`, 38, 22);
      doc.text(`Total de registros: ${dados.length}   |   Total de dias-uso: ${totalDias}`, 38, 27);

      // tabela uso
      doc.setFontSize(11);
      doc.setTextColor(27, 42, 74);
      doc.text('Detalhes de Uso', 10, 38);

      autoTable(doc, {
        startY: 42,
        head: [['Data Início', 'Data Fim', 'PTA', 'Solicitante', 'Área / Empresa', 'Local (UG)', 'Atividade', 'Dias', 'Status']],
        body: dados.map(a => [
          fmt(a.data_inicio),
          fmt(a.data_fim),
          a.patrimonio || a.pta_patrimonio || '',
          a.solicitante_nome || a.nome_solicitante || '',
          (a as any).area_empresa || a.area_nome || a.nome_area || '',
          a.ug || '',
          a.tipo_atividade || '',
          String(a.duracao_dias ?? 1),
          a.status || '',
        ]),
        styles: { fontSize: 7.5, cellPadding: 1.5 },
        headStyles: { fillColor: [27, 42, 74], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 10, right: 10 },
      });

      // tabela rateio
      if (rateio.length > 0 && valorNum > 0) {
        const finalY = (doc as any).lastAutoTable.finalY + 8;
        doc.setFontSize(11);
        doc.setTextColor(27, 42, 74);
        doc.text(`Rateio de Custos — Aluguel total: ${fmtCurrency(valorNum)}`, 10, finalY);

        autoTable(doc, {
          startY: finalY + 4,
          head: [['Área / Empresa', 'Dias de Uso', '% Uso', 'Ajuste %', '% Final', 'Valor a Pagar']],
          body: rateio.map(r => {
            const pctFinal = Math.max(0, r.pct_uso + r.pct_ajuste);
            return [
              r.area_nome,
              String(r.dias),
              r.pct_uso.toFixed(1) + '%',
              (r.pct_ajuste >= 0 ? '+' : '') + r.pct_ajuste.toFixed(1) + '%',
              pctFinal.toFixed(1) + '%',
              fmtCurrency(r.valor),
            ];
          }),
          foot: [['TOTAL', String(totalDias), '—', '—', '—', fmtCurrency(totalRateio)]],
          styles: { fontSize: 8 },
          headStyles: { fillColor: [27, 42, 74], textColor: 255, fontStyle: 'bold' },
          footStyles: { fillColor: [240, 245, 255], textColor: [27, 42, 74], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          margin: { left: 10, right: 10 },
        });
      }

      // rodapé
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text('AmBev Facilities — PPM — Controle Inteligente de Plataformas Elevatórias', 10, doc.internal.pageSize.height - 6);

      doc.save(`relatorio-uso-ptas-${dataIni}-a-${dataFim}.pdf`);
    };

    // Tentar carregar logo via canvas; gerar PDF com ou sem ela
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
    img.src = '/logo-pta.png';
  };

  // ── exportar Excel ───────────────────────────────────────────────────────
  const exportarExcel = () => {
    const valorNum = parseFloat(valorAluguel.replace(/\./g, '').replace(',', '.')) || 0;

    const linhasUso = dados.map(a => ({
      'Data Início': fmt(a.data_inicio),
      'Data Fim': fmt(a.data_fim),
      'PTA (Patrimônio)': a.patrimonio || a.pta_patrimonio || '',
      'Solicitante': a.solicitante_nome || a.nome_solicitante || '',
      'Área / Empresa': (a as any).area_empresa || a.area_nome || a.nome_area || '',
      'Local (UG)': a.ug || '',
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

    // larguras
    ws1['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 14 }, { wch: 20 }, { wch: 6 }, { wch: 12 }];
    ws2['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 16 }];

    XLSX.utils.book_append_sheet(wb, ws1, 'Uso de PTAs');
    XLSX.utils.book_append_sheet(wb, ws2, 'Rateio de Custos');

    // aba resumo
    const resumo = [
      { Info: 'Período', Valor: `${fmt(dataIni)} a ${fmt(dataFim)}` },
      { Info: 'Total de registros', Valor: dados.length },
      { Info: 'Total de dias-uso', Valor: totalDias },
      { Info: 'Valor total do aluguel', Valor: valorNum },
      { Info: 'Total rateado', Valor: parseFloat(totalRateio.toFixed(2)) },
    ];
    const ws3 = XLSX.utils.json_to_sheet(resumo);
    ws3['!cols'] = [{ wch: 24 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Resumo');

    XLSX.writeFile(wb, `relatorio-uso-ptas-${dataIni}-a-${dataFim}.xlsx`);
  };

  // ── compartilhar por e-mail (Outlook Web) ────────────────────────────────
  const compartilharEmail = () => {
    const valorNum = parseFloat(valorAluguel.replace(/\./g, '').replace(',', '.')) || 0;
    const linhasRateio = rateio
      .map(r => {
        const pctFinal = Math.max(0, r.pct_uso + r.pct_ajuste);
        return `- ${r.area_nome}: ${r.dias} dias (${pctFinal.toFixed(1)}%) → ${fmtCurrency(r.valor)}`;
      })
      .join('%0D%0A');

    const subject = encodeURIComponent(`[Facilities] Relatório de Uso de PTAs — ${fmt(dataIni)} a ${fmt(dataFim)}`);
    const body = encodeURIComponent(
      `Prezados,\n\nSegue o relatório de uso das Plataformas Elevatórias (PTAs) referente ao período de ${fmt(dataIni)} a ${fmt(dataFim)}.\n\n` +
      `Total de registros: ${dados.length}\n` +
      `Total de dias-uso: ${totalDias}\n` +
      `Valor total do aluguel: ${valorNum > 0 ? fmtCurrency(valorNum) : 'Não informado'}\n\n` +
      `RATEIO POR ÁREA:\n${rateio.map(r => {
        const pctFinal = Math.max(0, r.pct_uso + r.pct_ajuste);
        return `- ${r.area_nome}: ${r.dias} dias (${pctFinal.toFixed(1)}%) → ${fmtCurrency(r.valor)}`;
      }).join('\n')}\n\n` +
      `Relatório completo gerado pelo Sistema de Gestão de PTAs — AmBev Facilities.\n\nAtenciosamente,\nCentro de Inteligência Facilities`
    ).replace(/%0A/g, '%0D%0A');

    // Outlook Web
    const outlookUrl = `https://outlook.office.com/mail/deeplink/compose?subject=${subject}&body=${body}`;
    window.open(outlookUrl, '_blank');
  };

  // ── salvar rateio no banco ───────────────────────────────────────────────
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
      // tabela pode não existir ainda — avisa sem travar
      alert('Não foi possível salvar o rateio no banco. A tabela "rateio_custo_ptas" precisa ser criada. Use a exportação PDF/Excel.');
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
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-[#1B2A4A]" />
          <span className="text-sm font-bold text-[#1B2A4A]">Filtros do Relatório</span>
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
                  placeholder="Digite ou selecione o solicitante..."
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
                    {l.ug}{l.setor_linha ? ` · ${l.setor_linha}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end mt-3">
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

      {/* resultados */}
      {gerou && (
        <>
          {/* cards resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
              <p className="text-xs text-gray-500 font-medium mb-1">Registros</p>
              <p className="text-2xl font-extrabold text-[#1B2A4A]">{dados.length}</p>
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

          {/* tabela de uso */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1B2A4A]">Detalhes de Uso no Período</h3>
              <span className="text-xs text-gray-500">{dados.length} registro(s)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#1B2A4A] text-white">
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Data Início</th>
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Data Fim</th>
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">PTA</th>
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Solicitante</th>
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Área / Empresa</th>
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Local (UG)</th>
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Atividade</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Dias</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                        Nenhum registro encontrado no período.
                      </td>
                    </tr>
                  ) : (
                    dados.map((a, i) => (
                      <tr key={a.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2 whitespace-nowrap">{fmt(a.data_inicio)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{fmt(a.data_fim)}</td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap">{a.patrimonio || a.pta_patrimonio || '—'}</td>
                        <td className="px-3 py-2 uppercase">{a.solicitante_nome || a.nome_solicitante || '—'}</td>
                        <td className="px-3 py-2 uppercase">{(a as any).area_empresa || a.area_nome || a.nome_area || '—'}</td>
                        <td className="px-3 py-2 font-mono">{a.ug || '—'}</td>
                        <td className="px-3 py-2">{a.tipo_atividade || '—'}</td>
                        <td className="px-3 py-2 text-center font-bold">{a.duracao_dias ?? 1}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                            a.status === 'concluido' ? 'bg-green-100 text-green-700' :
                            a.status === 'cancelado' ? 'bg-red-100 text-red-600' :
                            a.status === 'em_uso' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* rateio */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <h3 className="text-sm font-bold text-[#1B2A4A]">Rateio de Custos por Área</h3>
                {/* toggle modo */}
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
                    <input
                      type="text"
                      value={valorAluguel}
                      onChange={e => setValorAluguel(e.target.value)}
                      placeholder="Ex: 20000,00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5D800] focus:border-amber-400 font-mono"
                    />
                  </div>
                  <button
                    onClick={() => calcularRateio(dados, rateio)}
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
                    // modo direto
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
                                value={valoresDiretos[r.area_id] || ''}
                                onChange={e => setValoresDiretos(prev => ({ ...prev, [r.area_id]: e.target.value }))}
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
