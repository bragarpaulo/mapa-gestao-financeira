// access.js — decisão PURA de acesso do usuário (sem I/O), a partir dos dados já buscados.
// Isolada aqui para ser testável offline (test/verify.mjs) e para manter getMyAccess (cloud.js) enxuto.
//
// Regras:
//   admin                      → acesso total (ilimitado).
//   assinatura ATIVA/trialing  → edita, com os limites do plano.
//   assinatura CANCELADA/atras.→ conforme cancel_behavior (só-leitura ou bloqueio).
//   SEM assinatura ou PENDENTE  → se a liberação grátis geral (free_signup) está LIGADA (padrão),
//                                 entra com ACESSO TOTAL GRÁTIS (plano "free"); senão, modo DEMO.
//
// Entradas de decideAccess({ isAdmin, sub, cfg }):
//   isAdmin : boolean
//   sub     : null | { status, plan_code, plan?: { max_companies, max_seats } }   (plan já resolvido)
//   cfg     : app_config.geral → { cancel_behavior?, free_signup?, free_max_companies?, free_max_seats? }
//
// free_signup é LIGADO por padrão: só é considerado desligado quando explicitamente === false.

export const DEMO_ACCESS = { admin: false, demo: true, readOnly: true, planLimit: 0, seatLimit: 0, status: 'none', plan: null };

export function freeAccessFrom(cfg = {}) {
  return {
    admin: false, demo: false, readOnly: false,
    planLimit: Number(cfg.free_max_companies) || 99,   // 99 ≈ ilimitado (empresas são gate client-side)
    seatLimit: 1,   // equipe: o servidor (user_max_seats) dá 1 sem assinatura paga; NÃO prometer mais que isso na UI
    status: 'active', plan: 'free',
  };
}

export function freeSignupOn(cfg = {}) {
  return (cfg || {}).free_signup !== false;   // ausente/true → ligado; só false desliga
}

export function decideAccess({ isAdmin = false, sub = null, cfg = {} } = {}) {
  cfg = cfg || {};
  if (isAdmin) return { admin: true, demo: false, readOnly: false, planLimit: Infinity, seatLimit: Infinity, status: 'active', plan: null };

  const semAssinaturaAtiva = () => (freeSignupOn(cfg) ? freeAccessFrom(cfg) : { ...DEMO_ACCESS });

  if (!sub) return semAssinaturaAtiva();                         // nunca assinou
  const status = sub.status || 'pending';

  if (['active', 'trialing'].includes(status)) {                // assinante pago ativo
    const pl = sub.plan || null;
    const planLimit = (pl && Number.isFinite(pl.max_companies)) ? pl.max_companies : 1;
    const seatLimit = (pl && Number.isFinite(pl.max_seats)) ? pl.max_seats : 1;
    return { admin: false, demo: false, readOnly: false, planLimit, seatLimit, status, plan: sub.plan_code || null };
  }

  if (['canceled', 'past_due'].includes(status)) {              // assinou e caiu → cancel_behavior
    const cancelBehavior = cfg.cancel_behavior || 'read_only';
    return { admin: false, demo: false, readOnly: cancelBehavior === 'read_only', planLimit: 0, seatLimit: 0, status, plan: sub.plan_code || null };
  }

  return semAssinaturaAtiva();                                   // pending → grátis (se ligado) ou demo
}
