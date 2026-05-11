/* ================================================
   Court Clash — Sessão Rápida (Placar ao Vivo)
   Carregado antes do app.js principal
   ================================================ */

let currentSession = null;
let recentSessions = [];

// ── CRUD de sessões ──────────────────────────────────────────────────────

async function createQuickSession() {
  const selectedPlayers = getSelectedQsPlayers();

  if (selectedPlayers.length < 2) {
    showToast("Selecione pelo menos 2 jogadores.", true);
    return;
  }
  if (selectedPlayers.length > 4) {
    showToast("Maximo de 4 jogadores.", true);
    return;
  }

  const gamesToWin = parseInt(document.getElementById("qsGamesToWin").value) || 3;
  const prize = document.getElementById("qsPrize").value.trim();

  try {
    const session = await apiRequest("/sessions", "POST", {
      games_to_win: gamesToWin,
      prize: prize || null,
      players: selectedPlayers,
    });
    showToast("Sessao iniciada!");
    currentSession = session;
    renderLiveSession(session);
  } catch (e) {
    showToast(e.message, true);
  }
}

async function loadSession(id) {
  try {
    const session = await apiRequest("/sessions/" + id);
    currentSession = session;
    renderLiveSession(session);
  } catch (e) {
    showToast(e.message, true);
  }
}

async function addScore(sessionId, playerName, delta) {
  // Atualização otimista — muda o placar instantaneamente
  if (currentSession) {
    const p = currentSession.players.find(x => x.player_name === playerName);
    if (p) {
      p.wins = Math.max(0, p.wins + delta);
      renderLiveSession(currentSession);
    }
  }
  // Sincroniza com API em background
  try {
    const session = await apiRequest(`/sessions/${sessionId}/score`, "PUT", {
      player_name: playerName,
      delta,
    });
    currentSession = session;
    // Re-render com dados reais do servidor
    renderLiveSession(session);
  } catch (e) {
    // Reverte se falhar — recarrega do servidor
    showToast(e.message, true);
    const session = await apiRequest(`/sessions/${sessionId}`).catch(() => null);
    if (session) { currentSession = session; renderLiveSession(session); }
  }
}

async function finishSession(id) {
  try {
    const session = await apiRequest(`/sessions/${id}/finish`, "PUT");
    currentSession = session;
    showToast("Sessao finalizada!");
    renderLiveSession(session);
    loadRecentSessions();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function deleteSession(id) {
  try {
    await apiRequest("/sessions/" + id, "DELETE");
    showToast("Sessao excluida.");
    currentSession = null;
    document.getElementById("liveSessionArea").classList.add("hidden");
    document.getElementById("quickSessionForm").classList.remove("hidden");
    loadRecentSessions();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function loadRecentSessions() {
  try {
    recentSessions = await apiRequest("/sessions");
    renderRecentSessions();
  } catch (e) {
    // Silenciar
  }
}

// ── Renderização ─────────────────────────────────────────────────────────

function renderQuickSessionForm() {
  const el = document.getElementById("qsPlayersList");
  if (!players.length) {
    el.innerHTML = `<span style="font-size:.8rem;color:var(--text-sec)">Cadastre jogadores primeiro na aba Config.</span>`;
    return;
  }
  const userIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  el.innerHTML = players.map(p => {
    const av = p.avatar ? `<img src="${p.avatar}" style="width:28px;height:28px;border-radius:50%;object-fit:cover">` : userIcon;
    return `<div class="qs-player-toggle" data-player="${esc(p.name)}" onclick="toggleQsPlayer(this)">
      <div class="qs-toggle-check"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
      ${av}
      <span>${esc(p.name)}</span>
    </div>`;
  }).join("");
}

function toggleQsPlayer(el) {
  el.classList.toggle("selected");
}

function getSelectedQsPlayers() {
  const els = document.querySelectorAll("#qsPlayersList .qs-player-toggle.selected");
  return Array.from(els).map(el => el.dataset.player);
}

function renderLiveSession(session) {
  document.getElementById("quickSessionForm").classList.add("hidden");
  const area = document.getElementById("liveSessionArea");
  area.classList.remove("hidden");

  const isActive = session.status === "active";
  const sessionPlayers = session.players || [];
  const maxWins = Math.max(...sessionPlayers.map(p => p.wins), 0);
  const rounds = getSessionRounds(session.id);

  const userSvg = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

  // Header
  let html = `<div class="qs-header">
    <div class="qs-title">Sessao Rapida</div>
    <div class="qs-meta">Primeiro a ${session.games_to_win} games</div>
    ${session.prize ? `<div class="qs-prize">${tIcons.trophy} ${esc(session.prize)}</div>` : ""}
    <div class="qs-status-badge ${session.status}">${isActive ? "Em andamento" : "Finalizada"}</div>
  </div>`;

  // Placar geral dos jogadores
  html += `<div class="qs-players-grid count-${sessionPlayers.length}">`;
  [...sessionPlayers]
    .sort((a, b) => b.wins - a.wins)
    .forEach((p, i) => {
      const av = getPlayerAvatar(p.player_name);
      const isLeader = p.wins === maxWins && p.wins > 0;
      const leaderClass = isLeader ? "qs-leader" : "";
      const posClass = i === 0 && !isActive && p.wins > 0 ? "qs-winner" : "";

      html += `<div class="qs-player-card ${leaderClass} ${posClass}">
        <div class="qs-player-avatar">${av ? `<img src="${av}" alt="${esc(p.player_name)}">` : userSvg}</div>
        <div class="qs-player-name">${esc(p.player_name)}</div>
        <div class="qs-player-score">${p.wins}</div>
      </div>`;
    });
  html += `</div>`;

  // Registrar rodada (só se ativo)
  if (isActive) {
    const playerNames = sessionPlayers.map(p => p.player_name);
    html += `<div class="card qs-round-form">
      <div class="qs-round-title">Registrar rodada</div>
      <div class="qs-round-select">
        <select id="qsRoundP1" class="qs-select">
          ${playerNames.map((n, i) => `<option value="${esc(n)}" ${i === 0 ? "selected" : ""}>${esc(n)}</option>`).join("")}
        </select>
        <span class="qs-vs">vs</span>
        <select id="qsRoundP2" class="qs-select">
          ${playerNames.map((n, i) => `<option value="${esc(n)}" ${i === 1 ? "selected" : ""}>${esc(n)}</option>`).join("")}
        </select>
      </div>
      <div class="qs-round-scores" id="qsRoundScores">
        <!-- Botões gerados dinamicamente -->
      </div>
    </div>`;
  }

  // Histórico de rodadas
  if (rounds.length) {
    html += `<div class="qs-rounds-history">
      <div class="qs-round-title" style="margin-bottom:8px">Rodadas (${rounds.length})</div>
      ${rounds.map((r, i) => `<div class="qs-round-entry">
        <span class="qs-round-num">#${i + 1}</span>
        <span class="qs-round-result"><strong>${esc(r.winner)}</strong> ${r.scoreW}-${r.scoreL} ${esc(r.loser)}</span>
      </div>`).reverse().join("")}
    </div>`;
  }

  // Ações
  if (isActive) {
    html += `<div class="qs-actions">
      <button class="btn btn-primary" onclick="finishSession(${session.id})">Finalizar Sessao</button>
      <button class="btn btn-danger btn-sm" onclick="deleteSession(${session.id})">Excluir</button>
    </div>`;
  } else {
    html += `<div class="qs-actions">
      <button class="btn btn-outline" onclick="backToSessionForm()">Nova sessao</button>
      <button class="btn btn-danger btn-sm" onclick="deleteSession(${session.id})">Excluir</button>
    </div>`;
  }

  area.innerHTML = html;

  // Gerar botões de placar após renderizar
  if (isActive) {
    generateScoreButtons(session);
    // Atualizar botões quando selects mudam
    document.getElementById("qsRoundP1").addEventListener("change", () => generateScoreButtons(session));
    document.getElementById("qsRoundP2").addEventListener("change", () => generateScoreButtons(session));
  }
}

// Gera botões de placar rápido (3-0, 3-1, 3-2, etc.)
function generateScoreButtons(session) {
  const p1 = document.getElementById("qsRoundP1").value;
  const p2 = document.getElementById("qsRoundP2").value;
  const container = document.getElementById("qsRoundScores");
  const g = session.games_to_win;

  if (p1 === p2) {
    container.innerHTML = `<span style="font-size:.78rem;color:var(--text-sec)">Selecione dois jogadores diferentes.</span>`;
    return;
  }

  // Gerar placares possíveis (g-0, g-1, g-2, ...)
  let buttons = "";
  for (let lost = 0; lost < g; lost++) {
    buttons += `<button class="qs-score-btn" onclick="registerRound(${session.id},'${esc(p1)}','${esc(p2)}',${g},${lost})">${esc(p1)} ${g}-${lost}</button>`;
  }
  for (let lost = 0; lost < g; lost++) {
    buttons += `<button class="qs-score-btn" onclick="registerRound(${session.id},'${esc(p2)}','${esc(p1)}',${g},${lost})">${esc(p2)} ${g}-${lost}</button>`;
  }

  container.innerHTML = buttons;
}

// Registra uma rodada: vencedor, perdedor, placar
async function registerRound(sessionId, winner, loser, scoreW, scoreL) {
  // Salvar rodada no localStorage
  saveSessionRound(sessionId, { winner, loser, scoreW, scoreL, time: new Date().toISOString() });

  // Atualização otimista
  if (currentSession) {
    const p = currentSession.players.find(x => x.player_name === winner);
    if (p) { p.wins += 1; renderLiveSession(currentSession); }
  }

  // Sincronizar com API
  try {
    const session = await apiRequest(`/sessions/${sessionId}/score`, "PUT", {
      player_name: winner,
      delta: 1,
    });
    currentSession = session;
    renderLiveSession(session);
  } catch (e) {
    showToast(e.message, true);
    const session = await apiRequest(`/sessions/${sessionId}`).catch(() => null);
    if (session) { currentSession = session; renderLiveSession(session); }
  }
}

// Persistência das rodadas em localStorage
function getSessionRounds(sessionId) {
  try {
    return JSON.parse(localStorage.getItem(`qs_rounds_${sessionId}`)) || [];
  } catch { return []; }
}

function saveSessionRound(sessionId, round) {
  const rounds = getSessionRounds(sessionId);
  rounds.push(round);
  localStorage.setItem(`qs_rounds_${sessionId}`, JSON.stringify(rounds));
}

function backToSessionForm() {
  currentSession = null;
  document.getElementById("liveSessionArea").classList.add("hidden");
  document.getElementById("quickSessionForm").classList.remove("hidden");
}

function renderRecentSessions() {
  const el = document.getElementById("recentSessionsList");
  if (!el) return;

  if (!recentSessions.length) {
    el.innerHTML = "";
    return;
  }

  const userSvg = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

  el.innerHTML = `<h3 class="section-title" style="margin-top:24px;">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v4l3 3"/></svg>
    Sessoes Rapidas
  </h3>` + recentSessions.slice(0, 5).map(s => {
    const sessionPlayers = s.players || [];
    const sortedPlayers = [...sessionPlayers].sort((a, b) => b.wins - a.wins);
    const statusClass = s.status === "active" ? "active" : "finished";
    const dateStr = s.started_at ? formatDateBR(s.started_at.split("T")[0]) : "";

    return `<div class="card qs-recent-card" onclick="loadSession(${s.id});showSection('secForm');">
      <div class="qs-recent-header">
        <span class="match-date">${dateStr}</span>
        <span class="qs-status-badge ${statusClass}">${s.status === "active" ? "Em andamento" : "Finalizada"}</span>
      </div>
      <div class="qs-recent-players">
        ${sortedPlayers.map(p => {
          const av = getPlayerAvatar(p.player_name);
          return `<span class="qs-recent-player">${av ? `<img src="${av}" style="width:20px;height:20px;border-radius:50%;object-fit:cover">` : userSvg} ${esc(p.player_name)} <strong>${p.wins}</strong></span>`;
        }).join("")}
      </div>
      ${s.prize ? `<div class="qs-recent-prize">${esc(s.prize)}</div>` : ""}
    </div>`;
  }).join("");
}
