// views/dfc.js — Demonstração de Fluxo de Caixa anual (regime de caixa).
import { getState } from '../store.js';
import { calcDFC } from '../calc.js';
import { anoAtivo } from '../util.js';
import { renderDemonstrativo } from './demonstrativo.js';

export function render(container) {
  const s = getState();
  renderDemonstrativo(container, {
    titulo: 'DFC — Demonstrativo de Caixa (Anual)',
    sub: `Regime de caixa (recebimentos e pagamentos realizados) · ${anoAtivo(s)}`,
    result: calcDFC(s),
  });
}
