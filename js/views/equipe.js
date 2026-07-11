// views/equipe.js — lado do ASSINANTE (dono da conta): convidar equipe (mesmos dados) + autorizar
// números de WhatsApp da conta. Só o dono ativo vê esta tela (gate no app.js). Reusa as funções do cloud
// (RLS permite o dono gerir a própria conta; addMember via admin-actions com owner_id = ele mesmo).
import { pageHead } from '../ui.js';
import { esc } from '../util.js';
import * as cloud from '../cloud.js';

async function meuId() { const u = await cloud.currentUser(); return u ? u.id : null; }

// IA no WhatsApp OCULTA dos usuários (desativada até liberarmos oficialmente). Ligue aqui (true) p/ reativar
// — volta o card "IA no WhatsApp" nesta tela e o "& WhatsApp" no título/menu (ver app.js).
const WHATSAPP_IA_ATIVO = false;

export function render(container) {
  container.innerHTML = `
    ${pageHead(WHATSAPP_IA_ATIVO ? 'Equipe & WhatsApp' : 'Equipe', WHATSAPP_IA_ATIVO ? 'Convide sua equipe (mesmos dados da conta) e autorize números do WhatsApp para a IA' : 'Convide sua equipe — cada membro acessa os mesmos dados da conta')}
    <div class="card card-pad" id="eq-team"><div class="hint">carregando…</div></div>
    ${WHATSAPP_IA_ATIVO ? `<div class="card card-pad" id="eq-wa" style="margin-top:14px"><div class="hint">carregando…</div></div>` : ''}`;
  loadTeam(container);
  if (WHATSAPP_IA_ATIVO) loadWa(container);
}

async function loadTeam(c) {
  const id = await meuId(); if (!id) return;
  const [members, acc] = [await cloud.listMembers(id), await cloud.getMyAccess()];
  const seatMax = (acc && Number.isFinite(acc.seatLimit)) ? acc.seatLimit : 1;   // limite de membros do plano
  const lotado = members.length >= seatMax;
  const rows = members.map(m => `<tr><td>${esc(m.email || '')}</td><td>${esc(m.nome || '')}</td><td><button class="btn btn-sm" data-rm="${m.member_id}">Remover</button></td></tr>`).join('') || '<tr><td colspan="3" class="empty">Sem membros ainda.</td></tr>';
  c.querySelector('#eq-team').innerHTML = `<strong>Minha equipe</strong> <span class="hint">· ${members.length}/${seatMax} seats do seu plano</span>
    <p class="hint" style="margin:6px 0 10px">Cada membro recebe um login próprio e acessa os MESMOS dados da sua conta.</p>
    <div class="table-wrap" style="box-shadow:none"><table><thead><tr><th>E-mail</th><th>Nome</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="toolbar" style="gap:6px;margin-top:8px"><input id="eq-email" type="email" placeholder="e-mail do membro" style="width:220px" ${lotado ? 'disabled' : ''}><input id="eq-nome" type="text" placeholder="nome" ${lotado ? 'disabled' : ''}><button class="btn btn-sm btn-primary" id="eq-add" ${lotado ? 'disabled' : ''}>+ Convidar membro</button></div>
    <div id="eq-out" class="hint" style="margin-top:8px">${lotado ? `Limite de ${seatMax} membro(s) do seu plano atingido. Faça upgrade para adicionar mais.` : ''}</div>`;
  c.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => { if (confirm('Remover o acesso deste membro?')) { await cloud.removeMember(b.dataset.rm); loadTeam(c); } });
  c.querySelector('#eq-add').onclick = async () => {
    const email = c.querySelector('#eq-email').value.trim(), nome = c.querySelector('#eq-nome').value.trim();
    if (!email) { alert('Informe o e-mail.'); return; }
    if (members.length >= seatMax) { alert(`Limite de ${seatMax} membro(s) do seu plano atingido.`); return; }
    const r = await cloud.addMember(id, email, nome);
    if (r && r.ok) { c.querySelector('#eq-out').textContent = '✓ Convite enviado por e-mail.' + (r.senha ? ` Senha temporária: ${r.senha}` : ''); loadTeam(c); }
    else alert('Erro ao convidar: ' + (r && r.error || ''));
  };
}

async function loadWa(c) {
  const id = await meuId(); if (!id) return;
  const nums = await cloud.waNumbersDe(id);
  const rows = nums.map(w => `<tr><td>${esc(w.phone)}</td><td><button class="btn btn-sm" data-rmwa="${esc(w.phone)}">Remover</button></td></tr>`).join('') || '<tr><td colspan="2" class="empty">Nenhum número autorizado.</td></tr>';
  c.querySelector('#eq-wa').innerHTML = `<strong>IA no WhatsApp</strong>
    <p class="hint" style="margin:6px 0 10px">Autorize seu número (com DDI) para lançar despesas/vendas e pedir relatórios pelo WhatsApp.</p>
    <div class="table-wrap" style="box-shadow:none"><table><thead><tr><th>Número (com DDI)</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="toolbar" style="gap:6px;margin-top:8px"><input id="eq-wa-phone" type="text" placeholder="5531999998888" style="width:180px"><button class="btn btn-sm btn-primary" id="eq-wa-add">+ Autorizar</button></div>`;
  c.querySelectorAll('[data-rmwa]').forEach(b => b.onclick = async () => { await cloud.adminDelWaNumber(b.dataset.rmwa); loadWa(c); });
  c.querySelector('#eq-wa-add').onclick = async () => { const phone = (c.querySelector('#eq-wa-phone').value || '').replace(/\D/g, ''); if (!phone) { alert('Informe o número.'); return; } if (await cloud.adminAddWaNumber(phone, id)) loadWa(c); };
}
