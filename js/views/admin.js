// views/admin.js — GPR Core: painel do administrador (planos, usuários/assinaturas, templates, config).
// Só admins chegam aqui (gate no app.js + RLS no banco garante que não-admin não lê/escreve).
import { pageHead } from '../ui.js';
import { esc } from '../util.js';
import * as cloud from '../cloud.js';

const kpiBox = (l, v) => `<div class="card kpi k-blue"><div class="kpi-label">${l}</div><div class="kpi-value">${v}</div></div>`;
const flash = (b, ok) => { const t = b.textContent; b.textContent = ok ? '✓ Salvo' : 'Erro'; setTimeout(() => b.textContent = t.replace('✓ Salvo', 'Salvar').replace('Erro', 'Salvar') || 'Salvar', 1500); };

export function render(container) {
  container.innerHTML = `
    ${pageHead('GPR Core', 'Administração do SaaS — planos, usuários, templates de nicho e configurações')}
    <div id="gc-metrics" class="grid kpis"></div>
    <div class="card card-pad" id="gc-users" style="margin-top:14px"><strong>Usuários & assinaturas</strong><div class="hint" style="margin-top:6px">carregando…</div></div>
    <div class="grid grid-2" style="margin-top:14px">
      <div class="card card-pad" id="gc-plans"><strong>Planos</strong></div>
      <div class="card card-pad" id="gc-templates"><strong>Templates de nicho</strong></div>
    </div>
    <div class="card card-pad" id="gc-integr" style="margin-top:14px"><strong>Integrações</strong></div>
    <div class="card card-pad" id="gc-wa" style="margin-top:14px"><strong>IA no WhatsApp</strong></div>
    <div class="card card-pad" id="gc-config" style="margin-top:14px"><strong>Configurações</strong></div>`;
  loadMetrics(container); loadUsers(container); loadPlans(container); loadTemplates(container); loadIntegracoes(container); loadWaNumbers(container); loadConfig(container);
}

async function loadIntegracoes(c) {
  const cfg = await cloud.adminGetIntegrations();
  const base = 'https://qdioqeejcneijctotyft.supabase.co/functions/v1/';
  const urlGreen = base + 'green-webhook', urlWa = base + 'whatsapp-webhook';
  const copia = (id, url) => `<span style="display:flex;gap:6px"><input value="${esc(url)}" readonly style="flex:1"><button class="btn btn-sm" data-copy="${esc(url)}" id="${id}">Copiar</button></span>`;
  c.querySelector('#gc-integr').innerHTML = `<strong>Integrações</strong>
    <p class="hint" style="margin:6px 0 12px">Plugue as chaves aqui — os webhooks usam direto. Guardadas só para o admin.</p>
    <div class="ig-sub">Cobrança (Green) + E-mail (Resend)</div>
    <label class="cfg-field">URL do webhook da Green ${copia('cp-green', urlGreen)}</label>
    <div class="grid grid-2" style="margin-top:10px">
      <label class="cfg-field">Resend — API key <input id="ig-resend" type="password" value="${esc(cfg.resend_api_key || '')}" placeholder="re_..."></label>
      <label class="cfg-field">Remetente (FROM_EMAIL) <input id="ig-from" value="${esc(cfg.from_email || '')}" placeholder="GPR <nao-responda@seudominio>"></label>
      <label class="cfg-field">URL do app (APP_URL) <input id="ig-app" value="${esc(cfg.app_url || '')}" placeholder="https://bragarpaulo.github.io/mapa-gestao-financeira/"></label>
      <label class="cfg-field">Green — segredo do webhook <input id="ig-green" type="password" value="${esc(cfg.green_webhook_secret || '')}" placeholder="segredo da Green"></label>
    </div>
    <div class="ig-sub" style="margin-top:16px">IA no WhatsApp</div>
    <label class="cfg-field">URL do webhook do WhatsApp (Meta) ${copia('cp-wa', urlWa)}</label>
    <div class="grid grid-2" style="margin-top:10px">
      <label class="cfg-field">Anthropic — API key <input id="ig-anthropic" type="password" value="${esc(cfg.anthropic_api_key || '')}" placeholder="sk-ant-..."></label>
      <label class="cfg-field">Modelo de IA <input id="ig-model" value="${esc(cfg.ai_model || '')}" placeholder="claude-sonnet-4-6"></label>
      <label class="cfg-field">WhatsApp — token (Meta) <input id="ig-watoken" type="password" value="${esc(cfg.wa_token || '')}" placeholder="EAAG..."></label>
      <label class="cfg-field">WhatsApp — Phone Number ID <input id="ig-waphone" value="${esc(cfg.wa_phone_id || '')}" placeholder="1234567890"></label>
      <label class="cfg-field">WhatsApp — Verify Token <input id="ig-waverify" value="${esc(cfg.wa_verify_token || '')}" placeholder="defina um texto qualquer"></label>
    </div>
    <button class="btn btn-sm btn-primary" id="ig-save" style="margin-top:14px">Salvar integrações</button>
    <p class="hint" style="margin-top:10px">💡 Resend também resolve o e-mail de <b>reset</b> (configure o SMTP do Resend em Authentication). Na Green, ligue cada oferta a um plano em <b>Planos</b>. No WhatsApp, autorize os números abaixo.</p>`;
  c.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => { try { navigator.clipboard.writeText(b.dataset.copy); } catch (e) {} const t = b.textContent; b.textContent = 'Copiado ✓'; setTimeout(() => b.textContent = t, 1300); });
  c.querySelector('#ig-save').onclick = async () => {
    const v = (id) => c.querySelector(id).value.trim();
    const ok = await cloud.adminSetIntegrations({
      resend_api_key: v('#ig-resend'), from_email: v('#ig-from'), app_url: v('#ig-app'), green_webhook_secret: v('#ig-green'),
      anthropic_api_key: v('#ig-anthropic'), ai_model: v('#ig-model'), wa_token: v('#ig-watoken'), wa_phone_id: v('#ig-waphone'), wa_verify_token: v('#ig-waverify'),
    });
    flash(c.querySelector('#ig-save'), ok);
  };
}

async function loadWaNumbers(c) {
  const [nums, users, uso] = [await cloud.adminListWaNumbers(), await cloud.adminListUsers(), await cloud.adminAiUsage()];
  const userOpts = users.map(u => `<option value="${u.id}">${esc(u.email || u.id)}</option>`).join('');
  const emailDe = (id) => { const u = users.find(x => x.id === id); return u ? (u.email || id) : id; };
  const rows = nums.map(n => `<tr><td>${esc(n.phone)}</td><td>${esc(emailDe(n.owner_id))}</td><td><button class="btn btn-sm" data-delwa="${esc(n.phone)}">Remover</button></td></tr>`).join('') || '<tr><td colspan="3" class="empty">Nenhum número autorizado.</td></tr>';
  c.querySelector('#gc-wa').innerHTML = `<strong>IA no WhatsApp — números autorizados</strong>
    <span class="hint"> · uso: ${uso.i + uso.o} tokens</span>
    <div class="table-wrap" style="box-shadow:none;margin-top:8px"><table>
      <thead><tr><th>Número (com DDI)</th><th>Usuário</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="toolbar" style="margin-top:8px;gap:6px">
      <input id="wa-new-phone" placeholder="5531999998888" style="width:160px">
      <select id="wa-new-user">${userOpts}</select>
      <button class="btn btn-sm" id="wa-add">+ Autorizar</button></div>`;
  c.querySelectorAll('[data-delwa]').forEach(b => b.onclick = async () => { await cloud.adminDelWaNumber(b.dataset.delwa); loadWaNumbers(c); });
  const add = c.querySelector('#wa-add');
  if (add) add.onclick = async () => {
    const phone = (c.querySelector('#wa-new-phone').value || '').replace(/\D/g, ''); const ownerId = c.querySelector('#wa-new-user').value;
    if (!phone || !ownerId) { alert('Informe número e usuário.'); return; }
    if (await cloud.adminAddWaNumber(phone, ownerId)) loadWaNumbers(c);
  };
}

async function loadMetrics(c) {
  const m = await cloud.adminMetrics();
  c.querySelector('#gc-metrics').innerHTML = kpiBox('👥 Usuários', m.usuarios) + kpiBox('💳 Assinantes ativos', m.assinantes) + kpiBox('🗂️ Contas com dados', m.empresas);
}

async function loadUsers(c) {
  const [users, plans] = [await cloud.adminListUsers(), await cloud.adminListPlans()];
  const planOpts = (sel) => ['<option value="">— sem —</option>'].concat(plans.map(p => `<option value="${esc(p.code)}" ${sel === p.code ? 'selected' : ''}>${esc(p.code)} · ${esc(p.name)}</option>`)).join('');
  const stOpts = (sel) => ['pending', 'active', 'trialing', 'past_due', 'canceled'].map(s => `<option ${sel === s ? 'selected' : ''}>${s}</option>`).join('');
  const rows = users.map(u => `<tr data-id="${u.id}">
    <td>${esc(u.email || '(sem e-mail)')} ${u.is_admin ? '<span class="emp-tag">admin</span>' : ''}</td>
    <td><select class="us-plan">${planOpts(u.sub && u.sub.plan_code)}</select></td>
    <td><select class="us-status">${stOpts((u.sub && u.sub.status) || 'pending')}</select></td>
    <td><button class="btn btn-sm btn-primary" data-saveu="${u.id}">Salvar</button></td></tr>`).join('') || '<tr><td colspan="4" class="empty">Nenhum usuário ainda.</td></tr>';
  c.querySelector('#gc-users').innerHTML = `<strong>Usuários & assinaturas</strong>
    <div class="table-wrap" style="box-shadow:none;margin-top:8px"><table>
      <thead><tr><th>E-mail</th><th>Plano</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  c.querySelectorAll('[data-saveu]').forEach(b => b.onclick = async () => {
    const tr = b.closest('tr');
    const ok = await cloud.adminSetSubscription(b.dataset.saveu, tr.querySelector('.us-plan').value, tr.querySelector('.us-status').value);
    flash(b, ok);
  });
}

async function loadPlans(c) {
  const plans = await cloud.adminListPlans();
  const rows = plans.map(p => `<tr data-code="${esc(p.code)}">
    <td><strong>${esc(p.code)}</strong></td>
    <td><input class="pl-nome" value="${esc(p.name)}" style="min-width:130px"></td>
    <td><input class="pl-max" type="number" value="${p.max_companies}" style="width:52px"></td>
    <td><input class="pl-preco" type="number" step="0.01" value="${(p.price_cents || 0) / 100}" style="width:78px"></td>
    <td><input class="pl-oferta" value="${esc(p.green_offer_id || '')}" placeholder="id da oferta" style="width:110px"></td>
    <td><input class="pl-niche" value="${esc(p.niche || '')}" placeholder="nicho" style="width:90px"></td>
    <td><button class="btn btn-sm btn-primary" data-savep="${esc(p.code)}">Salvar</button></td></tr>`).join('');
  c.querySelector('#gc-plans').innerHTML = `<strong>Planos</strong> <span class="hint">— "Oferta Green" liga a compra ao plano</span>
    <div class="table-wrap" style="box-shadow:none;margin-top:8px"><table>
      <thead><tr><th>Cód</th><th>Nome</th><th>Empr.</th><th>R$/mês</th><th>Oferta Green</th><th>Nicho</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  c.querySelectorAll('[data-savep]').forEach(b => b.onclick = async () => {
    const tr = b.closest('tr');
    const ok = await cloud.adminUpsertPlan({ code: b.dataset.savep, name: tr.querySelector('.pl-nome').value, max_companies: Number(tr.querySelector('.pl-max').value) || 1, price_cents: Math.round(Number(tr.querySelector('.pl-preco').value) * 100) || 0, green_offer_id: tr.querySelector('.pl-oferta').value.trim() || null, niche: tr.querySelector('.pl-niche').value.trim() || null });
    flash(b, ok);
  });
}

async function loadTemplates(c) {
  const ts = await cloud.adminListTemplates();
  const rows = ts.map(t => `<tr data-id="${esc(t.id)}">
    <td><strong>${esc(t.id)}</strong></td>
    <td><input class="tp-nome" value="${esc(t.nome)}" style="min-width:130px"></td>
    <td><input class="tp-niche" value="${esc(t.niche || '')}" style="width:96px"></td>
    <td style="text-align:center"><input type="checkbox" class="tp-active" ${t.active ? 'checked' : ''}></td>
    <td><button class="btn btn-sm btn-primary" data-savet="${esc(t.id)}">Salvar</button></td></tr>`).join('');
  c.querySelector('#gc-templates').innerHTML = `<strong>Templates de nicho</strong>
    <div class="table-wrap" style="box-shadow:none;margin-top:8px"><table>
      <thead><tr><th>ID</th><th>Nome</th><th>Nicho</th><th>Ativo</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="toolbar" style="margin-top:8px;gap:6px">
      <input id="tp-new-id" placeholder="slug (ex.: advogado)" style="width:130px">
      <input id="tp-new-nome" placeholder="Nome do template" style="min-width:150px">
      <button class="btn btn-sm" id="tp-add">+ Adicionar</button></div>`;
  c.querySelectorAll('[data-savet]').forEach(b => b.onclick = async () => {
    const tr = b.closest('tr');
    const ok = await cloud.adminUpsertTemplate({ id: b.dataset.savet, nome: tr.querySelector('.tp-nome').value, niche: tr.querySelector('.tp-niche').value, active: tr.querySelector('.tp-active').checked });
    flash(b, ok);
  });
  const add = c.querySelector('#tp-add');
  if (add) add.onclick = async () => {
    const id = (c.querySelector('#tp-new-id').value || '').trim().toLowerCase().replace(/\s+/g, '-');
    const nome = (c.querySelector('#tp-new-nome').value || '').trim();
    if (!id || !nome) { alert('Informe slug e nome.'); return; }
    if (await cloud.adminUpsertTemplate({ id, nome, active: true })) loadTemplates(c);
  };
}

async function loadConfig(c) {
  const cfg = await cloud.adminGetConfig();
  c.querySelector('#gc-config').innerHTML = `<strong>Configurações</strong>
    <div class="grid grid-2" style="margin-top:10px">
      <label class="cfg-field">Ao cancelar assinatura
        <select id="cfg-cancel"><option value="read_only" ${cfg.cancel_behavior === 'read_only' ? 'selected' : ''}>Somente leitura</option><option value="block" ${cfg.cancel_behavior === 'block' ? 'selected' : ''}>Bloquear acesso</option></select></label>
      <label class="cfg-field">Plano padrão (novo cliente)
        <input id="cfg-plano" value="${esc(cfg.plano_padrao || 'A')}" style="width:80px"></label>
    </div>
    <button class="btn btn-sm btn-primary" id="cfg-save" style="margin-top:12px">Salvar configurações</button>`;
  c.querySelector('#cfg-save').onclick = async () => {
    const ok = await cloud.adminSetConfig({ cancel_behavior: c.querySelector('#cfg-cancel').value, plano_padrao: c.querySelector('#cfg-plano').value });
    flash(c.querySelector('#cfg-save'), ok);
  };
}
