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
  try {
    const session = await apiRequest(`/sessions/${sessionId}/score`, "PUT", {
      player_name: playerName,
      delta,
    });
    currentSession = session;
    renderLiveSession(session);
  } catch (e) {
    showToast(e.message, true);
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

  const userSvg = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

  let html = `<div class="qs-header">
    <div class="qs-title">Sessao Rapida</div>
    <div class="qs-meta">Primeiro a ${session.games_to_win} games</div>
    ${session.prize ? `<div class="qs-prize">${tIcons.trophy} ${esc(session.prize)}</div>` : ""}
    <div class="qs-status-badge ${session.status}">${isActive ? "Em andamento" : "Finalizada"}</div>
  </div>`;

  // Cards dos jogadores
  html += `<div class="qs-players-grid count-${sessionPlayers.length}">`;
  sessionPlayers
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
        ${isActive ? `
          <div class="qs-player-actions">
            <button class="qs-btn-score qs-btn-plus" onclick="addScore(${session.id},'${esc(p.player_name)}',1)">+1</button>
            ${p.wins > 0 ? `<button class="qs-btn-score qs-btn-minus" onclick="addScore(${session.id},'${esc(p.player_name)}',-1)">-1</button>` : ""}
          </div>
        ` : ""}
      </div>`;
    });
  html += `</div>`;

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
