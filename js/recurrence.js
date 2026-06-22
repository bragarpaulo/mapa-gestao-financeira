// recurrence.js — gera as parcelas de um lançamento recorrente (venda ou despesa).
// Mantemos o helper isolado para reuso em vendas.js, despesas.js e testes.
import { uid } from './util.js';
import { PERIODOS_RECORRENCIA } from './config.js';
import { parseISO, addMeses, formatISO, mesAno } from './util.js';

const passoMeses = (periodo) => (PERIODOS_RECORRENCIA.find(p => p.id === periodo) || {}).meses || 0;

// Gera as parcelas a partir de um lançamento base (vai ser passado pro novaVenda/novaDespesa).
//
// - base:        objeto venda/despesa "molde" (sem id; valores, descrição, categoria etc.).
// - periodo:     'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'.
// - dataInicio:  ISO YYYY-MM-DD do PRIMEIRO vencimento (incluído).
// - dataFim:     ISO YYYY-MM-DD do ÚLTIMO vencimento (incluído; trava o loop).
// - tipo:        'venda' | 'despesa' — define qual campo recebe a data.
//
// Retorna array com N cópias (mesmo recorrenciaId). N >= 1 ou [] se inválido.
export function expandirRecorrencia(base, periodo, dataInicio, dataFim, tipo = 'despesa') {
  const passo = passoMeses(periodo);
  if (!passo) return [];
  const d0 = parseISO(dataInicio), dF = parseISO(dataFim);
  if (!d0 || !dF || dF < d0) return [];
  const recId = uid('rec');
  const out = [];
  let iso = dataInicio, guard = 0;
  while (iso && parseISO(iso) <= dF && guard++ < 600) {
    const linha = { ...base, recorrenciaId: recId, recorrenciaPeriodo: periodo, recorrenciaFim: dataFim };
    if (tipo === 'venda') {
      linha.dataVencimento = iso;
      if (!linha.dataVenda) linha.dataVenda = iso;     // útil pro mês de competência (regime de vendas)
    } else {
      linha.dataVencimento = iso;
      if (!linha.mesCompetencia) linha.mesCompetencia = mesAno(iso);  // competência mês a mês
    }
    out.push(linha);
    iso = addMeses(iso, passo);
  }
  return out;
}

// Helpers de UI ------------------------------------------------------------
export const nomeRecorrencia = (id) => (PERIODOS_RECORRENCIA.find(p => p.id === id) || {}).nome || '';
