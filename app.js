/* ================================================
   Court Clash — Lógica principal
   Todas as chamadas à API usam URL e token do localStorage.
   ================================================ */

// ── Chaves do localStorage ────────────────────────────────────────────────

const LS_API_URL = "cc_api_url";
const LS_TOKEN   = "cc_token";

// ── Ícones SVG reutilizáveis (Feather-style) ──────────────────────────────

const SVG_ATTR = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const icons = {
  // Bola de tênis estilizada
  ball: (w = 20, h = 20) => `<svg ${SVG_ATTR} width="${w}" height="${h}"><circle cx="12" cy="12" r="10"/><path d="M18 12c-2 2-4 2-6 0s-4-2-6 0"/><path d="M12 2c0 4 2 6 0 10s0 6 0 10"/></svg>`,
  // Troféu
  trophy: (w = 14, h = 14) => `<svg ${SVG_ATTR} width="${w}" height="${h}"><path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2"/><path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 3h10v5a5 5 0 0 1-10 0V3z"/></svg>`,
  // Loading (relógio)
  clock: (w = 28, h = 28) => `<svg ${SVG_ATTR} width="${w}" height="${h}"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  // Alerta
  alert: (w = 28, h = 28) => `<svg ${SVG_ATTR} width="${w}" height="${h}"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  // Caixa vazia (inbox)
  inbox: (w = 28, h = 28) => `<svg ${SVG_ATTR} width="${w}" height="${h}"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
  // Gráfico de barras
  barChart: (w = 28, h = 28) => `<svg ${SVG_ATTR} width="${w}" height="${h}"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  // Trend up
  trendUp: (w = 18, h = 18) => `<svg ${SVG_ATTR} width="${w}" height="${h}"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  // Plus circle
  plusCircle: (w = 18, h = 18) => `<svg ${SVG_ATTR} width="${w}" height="${h}"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
  // Edit (lápis)
  edit: (w = 18, h = 18) => `<svg ${SVG_ATTR} width="${w}" height="${h}"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  // Check circle
  check: (w = 16, h = 16) => `<svg ${SVG_ATTR} width="${w}" height="${h}"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
};

// ── Estado global ─────────────────────────────────────────────────────────

let matches = [];
let players = [];
let editingId = null;   // null = criando, number = editando
let pendingAvatar = null; // base64 da foto selecionada

// ── Helpers de configuração ───────────────────────────────────────────────

function getApiUrl()   { return (localStorage.getItem(LS_API_URL) || "").replace(/\/+$/, ""); }
function getAuthToken(){ return localStorage.getItem(LS_TOKEN) || ""; }
function setConfig(url, token) {
  localStorage.setItem(LS_API_URL, url.replace(/\/+$/, ""));
  localStorage.setItem(LS_TOKEN, token);
}
function isConfigured(){ return !!getApiUrl() && !!getAuthToken(); }

// ── Toast ─────────────────────────────────────────────────────────────────

let toastTimer;
function showToast(msg, isError = false) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast" + (isError ? " toast-error" : "") + " show";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
}

// ── Requisição genérica à API ─────────────────────────────────────────────

async function apiRequest(path, method = "GET", body = null) {
  const url = getApiUrl() + path;
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + getAuthToken(),
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Erro ${res.status}`);
  }
  return data;
}

// ── CRUD de partidas ──────────────────────────────────────────────────────

async function loadMatches() {
  try {
    renderLoading();
    matches = await apiRequest("/matches");
    renderApp();
  } catch (e) {
    renderError(e.message);
  }
}

async function createMatch(data) {
  await apiRequest("/matches", "POST", data);
  showToast("Confronto salvo com sucesso!");
  resetForm();
  showSection("secDashboard");
  await loadMatches();
}

async function updateMatch(id, data) {
  await apiRequest("/matches/" + id, "PUT", data);
  showToast("Confronto atualizado!");
  resetForm();
  showSection("secDashboard");
  await loadMatches();
}

async function deleteMatch(id) {
  await apiRequest("/matches/" + id, "DELETE");
  showToast("Confronto excluído.");
  await loadMatches();
}

// ── CRUD de jogadores ─────────────────────────────────────────────────────

async function loadPlayers() {
  try {
    players = await apiRequest("/players");
    populatePlayerSelects();
    renderPlayersList();
  } catch (e) {
    console.warn("Erro ao carregar jogadores:", e.message);
  }
}

async function savePlayer(name, avatar) {
  await apiRequest("/players", "POST", { name, avatar });
  showToast("Jogador adicionado!");
  await loadPlayers();
}

async function removePlayer(id) {
  await apiRequest("/players/" + id, "DELETE");
  showToast("Jogador removido.");
  await loadPlayers();
}

// Retorna o avatar base64/URL de um jogador pelo nome
function getPlayerAvatar(name) {
  const p = players.find(pl => pl.name === name);
  return p ? p.avatar : null;
}

// Redimensiona imagem para thumbnail 128x128 em base64
function resizeImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 128;
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");
        // Crop quadrado centralizado
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL("image/webp", 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Popula os selects de jogador no formulário de match
function populatePlayerSelects() {
  const s1 = document.getElementById("fPlayer1");
  const s2 = document.getElementById("fPlayer2");
  const cur1 = s1.value;
  const cur2 = s2.value;

  const opts = players.map(p => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join("");
  s1.innerHTML = `<option value="">Selecione...</option>` + opts;
  s2.innerHTML = `<option value="">Selecione...</option>` + opts;

  if (cur1) s1.value = cur1;
  if (cur2) s2.value = cur2;
  populateWinnerSelect();
}

// Renderiza lista de jogadores na Config
function renderPlayersList() {
  const el = document.getElementById("playersList");
  if (!players.length) {
    el.innerHTML = `<div class="state-message" style="padding:16px;">Nenhum jogador cadastrado.</div>`;
    return;
  }
  const userIcon = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  el.innerHTML = players.map(p => `
    <div class="card player-card">
      <div class="player-avatar">
        ${p.avatar ? `<img src="${p.avatar}" alt="${esc(p.name)}">` : userIcon}
      </div>
      <div class="player-info">
        <div class="name">${esc(p.name)}</div>
      </div>
      <button class="btn btn-danger btn-sm" onclick="removePlayer(${p.id})">Remover</button>
    </div>
  `).join("");
}

// ── Navegação ─────────────────────────────────────────────────────────────

function showSection(id) {
  // Se for ir para o formulário sem estar editando, garantir que está em modo "novo"
  if (id === "secForm" && editingId === null) {
    resetForm();
    document.getElementById("formTitle").innerHTML = icons.plusCircle() + " Novo confronto";
    document.getElementById("btnSaveMatch").textContent = "Salvar confronto";
    document.getElementById("editActions").classList.add("hidden");
  }

  ["secDashboard", "secForm", "secStats", "secSettings"].forEach(s => {
    document.getElementById(s).classList.toggle("hidden", s !== id);
  });

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.sec === id);
  });

  // Scroll para o topo ao trocar de seção
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── Formatação de placar ──────────────────────────────────────────────────

function formatScore(m) {
  let s = `${m.set1_p1}-${m.set1_p2}, ${m.set2_p1}-${m.set2_p2}`;
  if (m.set3_p1 !== null && m.set3_p2 !== null) {
    s += `, ${m.set3_p1}-${m.set3_p2}`;
  }
  return s;
}

// ── Cálculo de estatísticas ───────────────────────────────────────────────

function calculateStats(list) {
  if (!list.length) return null;

  // Descobrir os dois jogadores mais frequentes
  const freq = {};
  list.forEach(m => {
    freq[m.player1] = (freq[m.player1] || 0) + 1;
    freq[m.player2] = (freq[m.player2] || 0) + 1;
  });
  const players = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0]);
  if (players.length < 2) players.push("—");

  const [p1, p2] = players;
  const wins = { [p1]: 0, [p2]: 0 };
  list.forEach(m => { if (wins[m.winner] !== undefined) wins[m.winner]++; });

  const total = list.length;
  const winRate = {
    [p1]: total ? Math.round((wins[p1] / total) * 100) : 0,
    [p2]: total ? Math.round((wins[p2] / total) * 100) : 0,
  };

  // Ordenar por data asc para calcular sequências
  const sorted = [...list].sort((a, b) => a.match_date.localeCompare(b.match_date));

  // Sequência atual (do mais recente para trás)
  let currentStreakPlayer = sorted[sorted.length - 1].winner;
  let currentStreakCount = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].winner === currentStreakPlayer) currentStreakCount++;
    else break;
  }

  // Maior sequência
  let biggestStreakPlayer = sorted[0].winner;
  let biggestStreakCount = 0;
  let tempPlayer = null;
  let tempCount = 0;
  sorted.forEach(m => {
    if (m.winner === tempPlayer) { tempCount++; }
    else { tempPlayer = m.winner; tempCount = 1; }
    if (tempCount > biggestStreakCount) {
      biggestStreakCount = tempCount;
      biggestStreakPlayer = tempPlayer;
    }
  });

  // Forma recente (últimos 5)
  const recent = sorted.slice(-5);
  const recentForm = {};
  recentForm[p1] = recent.map(m => m.winner === p1 ? "V" : "D");
  recentForm[p2] = recent.map(m => m.winner === p2 ? "V" : "D");

  const leader = wins[p1] >= wins[p2] ? p1 : p2;
  const leadDiff = Math.abs(wins[p1] - wins[p2]);

  return {
    totalMatches: total,
    players: [p1, p2],
    wins,
    winRate,
    leader,
    leadDiff,
    lastWinner: sorted[sorted.length - 1].winner,
    currentStreakPlayer,
    currentStreakCount,
    biggestStreakPlayer,
    biggestStreakCount,
    recentForm,
  };
}

// ── Renderização ──────────────────────────────────────────────────────────

function renderLoading() {
  document.getElementById("h2hCard").innerHTML = `<div class="state-message"><div class="emoji">${icons.clock()}</div>Carregando confrontos...</div>`;
  document.getElementById("matchesList").innerHTML = "";
}

function renderError(msg) {
  document.getElementById("h2hCard").innerHTML = `<div class="state-message"><div class="emoji">${icons.alert()}</div>${msg}<br><small>Verifique sua conexão ou token.</small></div>`;
  document.getElementById("matchesList").innerHTML = "";
}

function renderApp() {
  const stats = calculateStats(matches);
  renderH2H(stats);
  renderMatchesList();
  renderStats(stats);
  populateWinnerSelect();
}

function renderH2H(stats) {
  const el = document.getElementById("h2hCard");

  if (!stats) {
    el.innerHTML = `<div class="state-message"><div class="emoji">${icons.ball(28, 28)}</div>Nenhum confronto registrado ainda.<br>Registre o primeiro jogo!</div>`;
    return;
  }

  const [p1, p2] = stats.players;
  const av1 = getPlayerAvatar(p1);
  const av2 = getPlayerAvatar(p2);
  const userSvg = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  el.innerHTML = `
    <div class="h2h-players">
      <div class="h2h-player">
        <div class="h2h-avatar">${av1 ? `<img src="${av1}" alt="${esc(p1)}">` : userSvg}</div>
        <div class="name">${esc(p1)}</div>
        <div class="wins">${stats.wins[p1]}</div>
      </div>
      <div class="h2h-vs">×</div>
      <div class="h2h-player">
        <div class="h2h-avatar">${av2 ? `<img src="${av2}" alt="${esc(p2)}">` : userSvg}</div>
        <div class="name">${esc(p2)}</div>
        <div class="wins">${stats.wins[p2]}</div>
      </div>
    </div>
    <div class="h2h-meta">
      <span class="h2h-leader">Líder: ${esc(stats.leader)} (+${stats.leadDiff})</span>
      <span>Sequência atual: ${esc(stats.currentStreakPlayer)} venceu ${stats.currentStreakCount} seguida${stats.currentStreakCount > 1 ? "s" : ""}</span>
    </div>
  `;
}

function renderMatchesList() {
  const el = document.getElementById("matchesList");

  if (!matches.length) {
    el.innerHTML = `<div class="state-message"><div class="emoji">${icons.inbox()}</div>Nenhum confronto ainda.</div>`;
    return;
  }

  el.innerHTML = matches.map(m => `
    <div class="card match-card">
      <div class="match-header">
        <span class="match-date">${formatDateBR(m.match_date)}</span>
        <span class="match-badge badge-winner">${icons.trophy()} ${esc(m.winner)}</span>
      </div>
      <div class="match-body">
        <div class="player-name ${m.winner === m.player1 ? "is-winner" : ""}">${esc(m.player1)}</div>
        <div class="score">${formatScore(m)}</div>
        <div class="player-name ${m.winner === m.player2 ? "is-winner" : ""}">${esc(m.player2)}</div>
      </div>
      ${m.notes ? `<div class="match-notes">"${esc(m.notes)}"</div>` : ""}
      <div class="match-actions">
        <button class="btn btn-outline btn-sm" onclick="startEdit(${m.id})">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDel(${m.id})">Excluir</button>
      </div>
    </div>
  `).join("");
}

function renderStats(stats) {
  const el = document.getElementById("statsContent");

  if (!stats) {
    el.innerHTML = `<div class="state-message"><div class="emoji">${icons.barChart()}</div>Sem dados para exibir ainda.</div>`;
    return;
  }

  const [p1, p2] = stats.players;

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${stats.totalMatches}</div>
        <div class="stat-label">Total de partidas</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.wins[p1]}</div>
        <div class="stat-label">Vitórias ${esc(p1)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.wins[p2]}</div>
        <div class="stat-label">Vitórias ${esc(p2)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.winRate[p1]}%</div>
        <div class="stat-label">Win rate ${esc(p1)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.winRate[p2]}%</div>
        <div class="stat-label">Win rate ${esc(p2)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.currentStreakCount}</div>
        <div class="stat-label">Sequência de ${esc(stats.currentStreakPlayer)}</div>
      </div>
      <div class="stat-card full">
        <div class="stat-value">${stats.biggestStreakCount}</div>
        <div class="stat-label">Maior sequência — ${esc(stats.biggestStreakPlayer)}</div>
      </div>
    </div>

    <h3 class="section-title" style="margin-top:24px;">${icons.trendUp()} Forma recente (últimos 5)</h3>
    <div class="card">
      <p style="font-size:.82rem;font-weight:600;margin-bottom:8px;">${esc(p1)}</p>
      <div class="form-recent">
        ${stats.recentForm[p1].map(r => `<span class="form-dot ${r === "V" ? "w" : "l"}">${r}</span>`).join("")}
      </div>
      <p style="font-size:.82rem;font-weight:600;margin:14px 0 8px;">${esc(p2)}</p>
      <div class="form-recent">
        ${stats.recentForm[p2].map(r => `<span class="form-dot ${r === "V" ? "w" : "l"}">${r}</span>`).join("")}
      </div>
    </div>
  `;
}

// ── Formulário ────────────────────────────────────────────────────────────

function populateWinnerSelect() {
  const sel = document.getElementById("fWinner");
  const p1 = document.getElementById("fPlayer1").value.trim();
  const p2 = document.getElementById("fPlayer2").value.trim();

  const current = sel.value;
  sel.innerHTML = `<option value="">Selecione...</option>`;
  if (p1) sel.innerHTML += `<option value="${esc(p1)}">${esc(p1)}</option>`;
  if (p2 && p2 !== p1) sel.innerHTML += `<option value="${esc(p2)}">${esc(p2)}</option>`;
  if (current) sel.value = current;
}

function resetForm() {
  editingId = null;
  document.getElementById("formTitle").innerHTML = icons.plusCircle() + " Novo confronto";
  document.getElementById("btnSaveMatch").textContent = "Salvar confronto";
  document.getElementById("editActions").classList.add("hidden");

  document.getElementById("fDate").value = todayISO();

  ["fS1P1","fS1P2","fS2P1","fS2P2","fS3P1","fS3P2","fNotes"].forEach(id => {
    document.getElementById(id).value = "";
  });

  // Pré-selecionar jogadores do último confronto
  if (matches.length) {
    document.getElementById("fPlayer1").value = matches[0].player1;
    document.getElementById("fPlayer2").value = matches[0].player2;
  } else if (players.length >= 2) {
    document.getElementById("fPlayer1").value = players[0].name;
    document.getElementById("fPlayer2").value = players[1].name;
  }

  document.getElementById("fWinner").value = "";
  populateWinnerSelect();
}

function fillFormForEdit(id) {
  const m = matches.find(x => x.id === id);
  if (!m) return;

  editingId = id;
  document.getElementById("formTitle").innerHTML = icons.edit() + " Editar confronto";
  document.getElementById("btnSaveMatch").textContent = "Atualizar confronto";
  document.getElementById("editActions").classList.remove("hidden");

  document.getElementById("fPlayer1").value = m.player1;
  document.getElementById("fPlayer2").value = m.player2;
  document.getElementById("fDate").value = m.match_date;
  document.getElementById("fS1P1").value = m.set1_p1;
  document.getElementById("fS1P2").value = m.set1_p2;
  document.getElementById("fS2P1").value = m.set2_p1;
  document.getElementById("fS2P2").value = m.set2_p2;
  document.getElementById("fS3P1").value = m.set3_p1 ?? "";
  document.getElementById("fS3P2").value = m.set3_p2 ?? "";
  document.getElementById("fNotes").value = m.notes || "";

  populateWinnerSelect();
  document.getElementById("fWinner").value = m.winner;
}

function getFormData() {
  const p1 = document.getElementById("fPlayer1").value.trim();
  const p2 = document.getElementById("fPlayer2").value.trim();
  const dt = document.getElementById("fDate").value;
  const w  = document.getElementById("fWinner").value;

  if (!p1 || !p2) { showToast("Preencha os dois jogadores.", true); return null; }
  if (!dt)        { showToast("Preencha a data.", true); return null; }

  const s1p1 = parseInt(document.getElementById("fS1P1").value);
  const s1p2 = parseInt(document.getElementById("fS1P2").value);
  const s2p1 = parseInt(document.getElementById("fS2P1").value);
  const s2p2 = parseInt(document.getElementById("fS2P2").value);

  if ([s1p1, s1p2, s2p1, s2p2].some(isNaN)) {
    showToast("Preencha pelo menos Set 1 e Set 2.", true);
    return null;
  }

  if (!w) { showToast("Selecione o vencedor.", true); return null; }

  const s3p1 = document.getElementById("fS3P1").value;
  const s3p2 = document.getElementById("fS3P2").value;

  return {
    player1: p1,
    player2: p2,
    match_date: dt,
    set1_p1: s1p1, set1_p2: s1p2,
    set2_p1: s2p1, set2_p2: s2p2,
    set3_p1: s3p1 !== "" ? parseInt(s3p1) : null,
    set3_p2: s3p2 !== "" ? parseInt(s3p2) : null,
    winner: w,
    notes: document.getElementById("fNotes").value.trim() || null,
  };
}

// ── Editar / Excluir ──────────────────────────────────────────────────────

function startEdit(id) {
  fillFormForEdit(id);
  showSection("secForm");
}

let pendingDeleteId = null;

function confirmDel(id) {
  pendingDeleteId = id;
  document.getElementById("confirmOverlay").classList.remove("hidden");
}

// ── Helpers ───────────────────────────────────────────────────────────────

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function todayISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}

function formatDateBR(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ── Inicialização ─────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  // Decidir tela inicial
  if (!isConfigured()) {
    document.getElementById("setupScreen").classList.remove("hidden");
    document.getElementById("appMain").classList.add("hidden");
  } else {
    document.getElementById("setupScreen").classList.add("hidden");
    document.getElementById("appMain").classList.remove("hidden");
    loadPlayers();
    loadMatches();
  }

  // ── Tela de setup ──────────────────────────────────────────────────────
  document.getElementById("setupSave").addEventListener("click", () => {
    const url = document.getElementById("setupUrl").value.trim();
    const token = document.getElementById("setupToken").value.trim();
    if (!url || !token) { showToast("Preencha URL e token.", true); return; }
    setConfig(url, token);
    document.getElementById("setupScreen").classList.add("hidden");
    document.getElementById("appMain").classList.remove("hidden");
    loadPlayers();
    loadMatches();
  });

  // ── Configurações ─────────────────────────────────────────────────────
  document.getElementById("cfgSave").addEventListener("click", () => {
    const url = document.getElementById("cfgUrl").value.trim();
    const token = document.getElementById("cfgToken").value.trim();
    if (!url || !token) { showToast("Preencha URL e token.", true); return; }
    setConfig(url, token);
    showToast("Configurações salvas!");
    loadPlayers();
    loadMatches();
    showSection("secDashboard");
  });

  document.getElementById("cfgUrl").value = getApiUrl();
  document.getElementById("cfgToken").value = getAuthToken();

  // ── Jogadores ─────────────────────────────────────────────────────────
  document.getElementById("btnPickAvatar").addEventListener("click", () => {
    document.getElementById("pAvatar").click();
  });

  document.getElementById("pAvatar").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    pendingAvatar = await resizeImage(file);
    document.getElementById("avatarPreview").innerHTML = `<img src="${pendingAvatar}">`;
  });

  document.getElementById("btnSavePlayer").addEventListener("click", async () => {
    const name = document.getElementById("pName").value.trim();
    if (!name) { showToast("Digite o nome do jogador.", true); return; }
    try {
      await savePlayer(name, pendingAvatar);
      document.getElementById("pName").value = "";
      pendingAvatar = null;
      document.getElementById("avatarPreview").innerHTML = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
      document.getElementById("pAvatar").value = "";
    } catch (e) {
      showToast(e.message, true);
    }
  });

  // ── Navegação ─────────────────────────────────────────────────────────
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => showSection(btn.dataset.sec));
  });

  document.getElementById("btnNewMatch").addEventListener("click", () => {
    resetForm();
    showSection("secForm");
  });

  // ── Formulário ────────────────────────────────────────────────────────
  // Atualizar select de vencedor quando os jogadores mudam
  document.getElementById("fPlayer1").addEventListener("change", populateWinnerSelect);
  document.getElementById("fPlayer2").addEventListener("change", populateWinnerSelect);

  document.getElementById("btnSaveMatch").addEventListener("click", async () => {
    const data = getFormData();
    if (!data) return;
    try {
      if (editingId !== null) {
        await updateMatch(editingId, data);
      } else {
        await createMatch(data);
      }
    } catch (e) {
      showToast(e.message, true);
    }
  });

  document.getElementById("btnCancelEdit").addEventListener("click", () => {
    resetForm();
    showSection("secDashboard");
  });

  // ── Confirmação de exclusão ───────────────────────────────────────────
  document.getElementById("confirmCancel").addEventListener("click", () => {
    pendingDeleteId = null;
    document.getElementById("confirmOverlay").classList.add("hidden");
  });

  document.getElementById("confirmDelete").addEventListener("click", async () => {
    document.getElementById("confirmOverlay").classList.add("hidden");
    if (pendingDeleteId !== null) {
      try {
        await deleteMatch(pendingDeleteId);
      } catch (e) {
        showToast(e.message, true);
      }
      pendingDeleteId = null;
    }
  });
});
