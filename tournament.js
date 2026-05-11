/* ================================================
   Court Clash — Lógica de Torneios
   Carregado antes do app.js principal
   ================================================ */

let tournaments = [];
let activeTournamentId = null;
let pendingDeleteTournamentId = null;

// SVGs reutilizáveis para o torneio (evita emojis inconsistentes entre plataformas)
const tIcons = {
  calendar: '<svg class="t-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  clock: '<svg class="t-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  trophy: '<svg class="t-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2"/><path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 3h10v5a5 5 0 0 1-10 0V3z"/></svg>',
  active: '<svg class="t-icon" viewBox="0 0 24 24" width="12" height="12" fill="var(--yellow)" stroke="none"><circle cx="12" cy="12" r="6"/></svg>',
  finished: '<svg class="t-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
  gold: '<svg class="rank-medal-svg gold" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke-width="2"><circle cx="12" cy="12" r="9" fill="#FFD700" stroke="#DAA520"/><text x="12" y="16" text-anchor="middle" font-size="11" font-weight="800" fill="#8B6914">1</text></svg>',
  silver: '<svg class="rank-medal-svg silver" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke-width="2"><circle cx="12" cy="12" r="9" fill="#C0C0C0" stroke="#A0A0A0"/><text x="12" y="16" text-anchor="middle" font-size="11" font-weight="800" fill="#555">2</text></svg>',
  bronze: '<svg class="rank-medal-svg bronze" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke-width="2"><circle cx="12" cy="12" r="9" fill="#CD7F32" stroke="#A0662B"/><text x="12" y="16" text-anchor="middle" font-size="11" font-weight="800" fill="#5C3317">3</text></svg>',
};

// ── CRUD de torneios ──────────────────────────────────────────────────────

async function loadTournaments() {
  try {
    tournaments = await apiRequest("/tournaments");
    renderTournamentSection();
  } catch (e) {
    console.warn("Erro ao carregar torneios:", e.message);
  }
}

async function createTournamentFromForm() {
  const name = document.getElementById("tName").value.trim();
  const duration = document.getElementById("tDuration").value;
  const startDate = document.getElementById("tStartDate").value;
  const prize = document.getElementById("tPrize").value.trim();

  if (!name) { showToast("Digite o nome do torneio.", true); return; }
  if (!startDate) { showToast("Selecione a data de início.", true); return; }

  // Coletar jogadores selecionados
  const toggles = document.querySelectorAll("#tPlayersList .qs-player-toggle.selected");
  const selectedPlayers = Array.from(toggles).map(el => el.dataset.player);

  if (selectedPlayers.length < 2) {
    showToast("Selecione pelo menos 2 jogadores.", true);
    return;
  }

  try {
    await apiRequest("/tournaments", "POST", {
      name, duration, start_date: startDate,
      prize: prize || null,
      players: selectedPlayers,
    });
    showToast("Torneio criado!");
    document.getElementById("tournamentForm").classList.add("hidden");
    // Limpar form
    document.getElementById("tName").value = "";
    document.getElementById("tPrize").value = "";
    await loadTournaments();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function deleteTournament(id) {
  try {
    await apiRequest("/tournaments/" + id, "DELETE");
    showToast("Torneio excluído.");
    if (activeTournamentId === id) activeTournamentId = null;
    await loadTournaments();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function finishTournament(id) {
  try {
    await apiRequest("/tournaments/" + id, "PUT", { status: "finished" });
    showToast("Torneio finalizado!");
    await loadTournaments();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function addPlayerToTournament(tournamentId, playerName) {
  try {
    await apiRequest(`/tournaments/${tournamentId}/players`, "POST", { player_name: playerName });
    showToast(`${playerName} inscrito!`);
    await loadTournaments();
    await loadTournamentRanking(tournamentId);
  } catch (e) {
    showToast(e.message, true);
  }
}

async function removePlayerFromTournament(tournamentId, playerName) {
  try {
    await apiRequest(`/tournaments/${tournamentId}/players/${encodeURIComponent(playerName)}`, "DELETE");
    showToast(`${playerName} removido.`);
    await loadTournaments();
    await loadTournamentRanking(tournamentId);
  } catch (e) {
    showToast(e.message, true);
  }
}

async function loadTournamentRanking(tournamentId) {
  try {
    const data = await apiRequest(`/tournaments/${tournamentId}/ranking`);
    renderTournamentRanking(data);
  } catch (e) {
    document.getElementById("tournamentRanking").innerHTML =
      `<div class="ranking-empty">Erro ao carregar ranking.</div>`;
  }
}

// ── Renderização de torneios ──────────────────────────────────────────────

function renderTournamentSection() {
  const selector = document.getElementById("tournamentSelector");
  const sel = document.getElementById("selTournament");

  if (!tournaments.length) {
    selector.classList.add("hidden");
    document.getElementById("tournamentRanking").innerHTML =
      `<div class="ranking-empty">Nenhum torneio criado ainda.</div>`;
    return;
  }

  selector.classList.remove("hidden");
  const currentVal = sel.value;
  sel.innerHTML = `<option value="">Selecione um torneio...</option>` +
    tournaments.map(t => {
      const statusLabel = t.status === "finished" ? " (finalizado)" : "";
      return `<option value="${t.id}">${esc(t.name)}${statusLabel}</option>`;
    }).join("");

  // Restaurar seleção ou selecionar o primeiro ativo
  if (currentVal) {
    sel.value = currentVal;
  } else if (activeTournamentId) {
    sel.value = activeTournamentId;
  } else {
    const active = tournaments.find(t => t.status === "active");
    if (active) {
      sel.value = active.id;
      activeTournamentId = active.id;
    }
  }

  if (sel.value) {
    activeTournamentId = parseInt(sel.value);
    loadTournamentRanking(activeTournamentId);
  } else {
    document.getElementById("tournamentRanking").innerHTML =
      `<div class="ranking-empty">Selecione um torneio para ver o ranking.</div>`;
  }

  // Popular checkboxes do form de criação
  populateTournamentPlayersForm();
}

function populateTournamentPlayersForm() {
  const el = document.getElementById("tPlayersList");
  if (!players.length) {
    el.innerHTML = `<span style="font-size:.8rem;color:var(--text-sec)">Cadastre jogadores primeiro na aba Config.</span>`;
    return;
  }
  const userIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  el.innerHTML = players.map(p => {
    const av = p.avatar ? `<img src="${p.avatar}" style="width:28px;height:28px;border-radius:50%;object-fit:cover">` : userIcon;
    return `<div class="qs-player-toggle" data-player="${esc(p.name)}" onclick="this.classList.toggle('selected')">
      <div class="qs-toggle-check"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
      ${av}
      <span>${esc(p.name)}</span>
    </div>`;
  }).join("");
}

function renderTournamentRanking(data) {
  const el = document.getElementById("tournamentRanking");
  const t = data.tournament;
  const ranking = data.ranking;

  // Duração legível
  const durLabels = { "1m": "1 mês", "3m": "3 meses", "6m": "6 meses" };
  const durLabel = durLabels[t.duration] || t.duration;

  // Card do torneio
  let html = `
    <div class="tournament-info-card">
      <div class="t-name">${esc(t.name)}</div>
      <div class="t-meta">
        <span>${tIcons.calendar} ${formatDateBR(t.start_date)} → ${formatDateBR(t.end_date)}</span>
        <span>${tIcons.clock} ${durLabel} · ${data.matches_count} partida${data.matches_count !== 1 ? "s" : ""}</span>
      </div>
      ${t.prize ? `<span class="t-prize">${tIcons.trophy} ${esc(t.prize)}</span>` : ""}
      <span class="t-status ${t.status}">${t.status === "active" ? tIcons.active + " Ativo" : tIcons.finished + " Finalizado"}</span>
      <div class="tournament-actions">
        ${t.status === "active" ? `<button class="btn" onclick="finishTournament(${t.id})">Finalizar</button>` : ""}
        <button class="btn btn-del" onclick="confirmDelTournament(${t.id})">Excluir</button>
      </div>
    </div>`;

  // Inscrição rápida de jogador (apenas se ativo)
  if (t.status === "active") {
    const enrolledSet = new Set(t.players || []);
    const availablePlayers = players.filter(p => !enrolledSet.has(p.name));

    html += `<div class="enrolled-players">`;
    (t.players || []).forEach(name => {
      html += `<span class="enrolled-chip">${esc(name)}
        <span class="chip-remove" onclick="removePlayerFromTournament(${t.id},'${esc(name)}')">×</span>
      </span>`;
    });
    html += `</div>`;

    if (availablePlayers.length) {
      html += `<div class="tournament-enroll">
        <select id="enrollPlayer">
          <option value="">Adicionar jogador...</option>
          ${availablePlayers.map(p => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join("")}
        </select>
        <button class="btn btn-yellow btn-sm" onclick="enrollSelectedPlayer(${t.id})">+</button>
      </div>`;
    }
  }

  // Tabela de ranking
  if (!ranking.length || ranking.every(r => r.matches_played === 0)) {
    html += `<div class="ranking-empty" style="margin-top:16px">Nenhuma partida válida no período ainda.</div>`;
  } else {
    const medals = [tIcons.gold, tIcons.silver, tIcons.bronze];
    html += `<table class="ranking-table" style="margin-top:16px">
      <thead><tr>
        <th>#</th><th>Jogador</th><th>PTS</th><th>V</th><th>D</th><th>Sets</th><th>Games</th>
      </tr></thead><tbody>`;

    ranking.forEach(r => {
      const posDisplay = r.position <= 3
        ? `<span class="rank-medal">${medals[r.position - 1]}</span>`
        : `<span class="rank-pos">${r.position}°</span>`;

      html += `<tr>
        <td>${posDisplay}</td>
        <td>${esc(r.player_name)}</td>
        <td><span class="rank-pts">${r.points}</span></td>
        <td>${r.wins}</td>
        <td>${r.losses}</td>
        <td>${r.sets_won}</td>
        <td>${r.games_won}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
  }

  el.innerHTML = html;
}

function enrollSelectedPlayer(tournamentId) {
  const sel = document.getElementById("enrollPlayer");
  const name = sel.value;
  if (!name) { showToast("Selecione um jogador.", true); return; }
  addPlayerToTournament(tournamentId, name);
}

function confirmDelTournament(id) {
  pendingDeleteTournamentId = id;
  document.getElementById("confirmTournamentOverlay").classList.remove("hidden");
}
