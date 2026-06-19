// views/dre.js — Demonstração de Resultado (regime de competência).
import { getState } from '../store.js';
import { calcDRE } from '../calc.js';
import { renderDemonstrativo } from './demonstrativo.js';

export function render(container) {
  const s = getState();
  renderDemonstrativo(container, {
    titulo: 'DRE — Demonstração do Resultado do Exercício',
    sub: `Regime de competência (por Mês Competência) · ${s.empresa.anoVigente}`,
    result: calcDRE(s),
  });
}
