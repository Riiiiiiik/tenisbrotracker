/**
 * Court Clash - Cloudflare Worker
 *
 * Variáveis de ambiente necessárias (configurar no painel Cloudflare):
 *   AUTH_TOKEN      → token secreto que o frontend vai enviar
 *   DB              → binding do banco D1
 *   VAPID_PUBLIC_KEY  → chave pública VAPID (base64url)
 *   VAPID_PRIVATE_KEY → chave privada VAPID (base64url)
 *   VAPID_SUBJECT     → "mailto:seu@email.com"
 */

// ── Helpers de resposta ───────────────────────────────────────────────────────

/**
 * Retorna uma resposta JSON padronizada com headers CORS.
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

/**
 * Retorna uma resposta de erro padronizada.
 */
function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

/**
 * Responde ao preflight CORS (requisições OPTIONS).
 */
function handleCors() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

// ── Autenticação ──────────────────────────────────────────────────────────────

/**
 * Valida o token Bearer enviado no header Authorization.
 * O token real fica em AUTH_TOKEN (variável de ambiente do Worker).
 */
function requireAuth(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token || token !== env.AUTH_TOKEN) {
    return errorResponse("Token inválido ou ausente.", 401);
  }

  // Retorna null se autenticado com sucesso
  return null;
}

// ── Handlers de rota ──────────────────────────────────────────────────────────

/**
 * GET /health — verifica se a API está no ar
 */
async function handleHealth() {
  return jsonResponse({ status: "ok", app: "Court Clash" });
}

/**
 * GET /matches — lista todos os confrontos ordenados por data
 */
async function listMatches(env) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM matches ORDER BY match_date DESC, created_at DESC`
  ).all();

  return jsonResponse(results);
}

/**
 * POST /matches — cria um novo confronto (suporta até 5 sets)
 */
async function createMatch(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Body inválido.");
  }

  const {
    player1, player2,
    set1_p1, set1_p2, set2_p1, set2_p2,
    set3_p1, set3_p2, set4_p1, set4_p2, set5_p1, set5_p2,
    winner, match_date, notes
  } = body;

  // Validações básicas
  if (!player1 || !player2 || !winner || !match_date) {
    return errorResponse("Campos obrigatórios ausentes: player1, player2, winner, match_date.");
  }
  if (set1_p1 === undefined || set1_p2 === undefined || set2_p1 === undefined || set2_p2 === undefined) {
    return errorResponse("Set 1 e Set 2 são obrigatórios.");
  }

  const result = await env.DB.prepare(
    `INSERT INTO matches (player1, player2, set1_p1, set1_p2, set2_p1, set2_p2, set3_p1, set3_p2, set4_p1, set4_p2, set5_p1, set5_p2, winner, match_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      player1, player2,
      set1_p1, set1_p2, set2_p1, set2_p2,
      set3_p1 ?? null, set3_p2 ?? null,
      set4_p1 ?? null, set4_p2 ?? null,
      set5_p1 ?? null, set5_p2 ?? null,
      winner, match_date, notes ?? null
    )
    .run();

  const created = await env.DB.prepare(`SELECT * FROM matches WHERE id = ?`)
    .bind(result.meta.last_row_id)
    .first();

  // Disparar push notification para todos os inscritos (em background)
  const scoreText = formatMatchScore(created);
  const pushPayload = {
    title: `${winner} venceu!`,
    body: `${player1} vs ${player2} — ${scoreText}`,
    icon: "./icon-192.png",
  };
  // Não bloqueia a resposta — envia push em background
  const pushPromise = sendPushToAll(env, pushPayload).catch(() => {});
  // Usa waitUntil se disponível (CF Workers)
  if (typeof ctx !== 'undefined' && ctx.waitUntil) ctx.waitUntil(pushPromise);

  return jsonResponse(created, 201);
}

/**
 * PUT /matches/:id — atualiza um confronto existente (suporta até 5 sets)
 */
async function updateMatch(request, env, id) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Body inválido.");
  }

  // Verifica se o confronto existe
  const existing = await env.DB.prepare(`SELECT id FROM matches WHERE id = ?`).bind(id).first();
  if (!existing) {
    return errorResponse("Confronto não encontrado.", 404);
  }

  const {
    player1, player2,
    set1_p1, set1_p2, set2_p1, set2_p2,
    set3_p1, set3_p2, set4_p1, set4_p2, set5_p1, set5_p2,
    winner, match_date, notes
  } = body;

  if (!player1 || !player2 || !winner || !match_date) {
    return errorResponse("Campos obrigatórios ausentes.");
  }

  await env.DB.prepare(
    `UPDATE matches
     SET player1 = ?, player2 = ?,
         set1_p1 = ?, set1_p2 = ?, set2_p1 = ?, set2_p2 = ?,
         set3_p1 = ?, set3_p2 = ?, set4_p1 = ?, set4_p2 = ?,
         set5_p1 = ?, set5_p2 = ?,
         winner = ?, match_date = ?, notes = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(
      player1, player2,
      set1_p1, set1_p2, set2_p1, set2_p2,
      set3_p1 ?? null, set3_p2 ?? null,
      set4_p1 ?? null, set4_p2 ?? null,
      set5_p1 ?? null, set5_p2 ?? null,
      winner, match_date, notes ?? null, id
    )
    .run();

  const updated = await env.DB.prepare(`SELECT * FROM matches WHERE id = ?`).bind(id).first();
  return jsonResponse(updated);
}

/**
 * DELETE /matches/:id — exclui um confronto
 */
async function deleteMatch(env, id) {
  const existing = await env.DB.prepare(`SELECT id FROM matches WHERE id = ?`).bind(id).first();
  if (!existing) {
    return errorResponse("Confronto não encontrado.", 404);
  }

  await env.DB.prepare(`DELETE FROM matches WHERE id = ?`).bind(id).run();
  return jsonResponse({ message: "Confronto excluído com sucesso." });
}

// ── Handlers de jogadores ─────────────────────────────────────────────────────

/**
 * GET /players — lista todos os jogadores
 */
async function listPlayers(env) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM players ORDER BY name ASC`
  ).all();
  return jsonResponse(results);
}

/**
 * POST /players — cria um novo jogador
 */
async function createPlayer(request, env) {
  let body;
  try { body = await request.json(); } catch { return errorResponse("Body inválido."); }

  const { name, avatar } = body;
  if (!name) return errorResponse("Nome do jogador é obrigatório.");

  // Verificar duplicidade
  const existing = await env.DB.prepare(`SELECT id FROM players WHERE name = ?`).bind(name).first();
  if (existing) return errorResponse("Já existe um jogador com esse nome.", 409);

  const result = await env.DB.prepare(
    `INSERT INTO players (name, avatar) VALUES (?, ?)`
  ).bind(name, avatar ?? null).run();

  const created = await env.DB.prepare(`SELECT * FROM players WHERE id = ?`)
    .bind(result.meta.last_row_id).first();
  return jsonResponse(created, 201);
}

/**
 * PUT /players/:id — atualiza um jogador
 */
async function updatePlayer(request, env, id) {
  let body;
  try { body = await request.json(); } catch { return errorResponse("Body invalido."); }

  const existing = await env.DB.prepare(`SELECT * FROM players WHERE id = ?`).bind(id).first();
  if (!existing) return errorResponse("Jogador nao encontrado.", 404);

  const name = body.name || existing.name;
  const avatar = body.avatar !== undefined ? body.avatar : existing.avatar;

  await env.DB.prepare(
    `UPDATE players SET name = ?, avatar = ? WHERE id = ?`
  ).bind(name, avatar, id).run();

  const updated = await env.DB.prepare(`SELECT * FROM players WHERE id = ?`).bind(id).first();
  return jsonResponse(updated);
}

/**
 * DELETE /players/:id — exclui um jogador
 */
async function deletePlayer(env, id) {
  const existing = await env.DB.prepare(`SELECT id FROM players WHERE id = ?`).bind(id).first();
  if (!existing) return errorResponse("Jogador não encontrado.", 404);

  await env.DB.prepare(`DELETE FROM players WHERE id = ?`).bind(id).run();
  return jsonResponse({ message: "Jogador excluído." });
}

// ── Handlers de torneios ──────────────────────────────────────────────────────

/**
 * GET /tournaments — lista todos os torneios
 */
async function listTournaments(env) {
  const { results: tournaments } = await env.DB.prepare(
    `SELECT * FROM tournaments ORDER BY created_at DESC`
  ).all();

  // Para cada torneio, buscar jogadores inscritos
  for (const t of tournaments) {
    const { results: tPlayers } = await env.DB.prepare(
      `SELECT player_name FROM tournament_players WHERE tournament_id = ?`
    ).bind(t.id).all();
    t.players = tPlayers.map(p => p.player_name);
  }

  return jsonResponse(tournaments);
}

/**
 * POST /tournaments — cria um novo torneio
 */
async function createTournament(request, env) {
  let body;
  try { body = await request.json(); } catch { return errorResponse("Body inválido."); }

  const { name, duration, start_date, prize, players: playerNames } = body;

  if (!name || !duration || !start_date) {
    return errorResponse("Campos obrigatórios: name, duration, start_date.");
  }

  // Calcular data final baseado na duração
  const start = new Date(start_date);
  let end;
  if (duration === "1m") {
    end = new Date(start); end.setMonth(end.getMonth() + 1);
  } else if (duration === "3m") {
    end = new Date(start); end.setMonth(end.getMonth() + 3);
  } else if (duration === "6m") {
    end = new Date(start); end.setMonth(end.getMonth() + 6);
  } else {
    return errorResponse("Duração inválida. Use: 1m, 3m ou 6m.");
  }

  const end_date = end.toISOString().split("T")[0];

  const result = await env.DB.prepare(
    `INSERT INTO tournaments (name, duration, start_date, end_date, prize)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(name, duration, start_date, end_date, prize ?? null).run();

  const tournamentId = result.meta.last_row_id;

  // Inscrever jogadores enviados
  if (playerNames && Array.isArray(playerNames)) {
    for (const pName of playerNames) {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO tournament_players (tournament_id, player_name) VALUES (?, ?)`
      ).bind(tournamentId, pName).run();
    }
  }

  const created = await env.DB.prepare(`SELECT * FROM tournaments WHERE id = ?`)
    .bind(tournamentId).first();

  // Retornar com jogadores
  const { results: tPlayers } = await env.DB.prepare(
    `SELECT player_name FROM tournament_players WHERE tournament_id = ?`
  ).bind(tournamentId).all();
  created.players = tPlayers.map(p => p.player_name);

  return jsonResponse(created, 201);
}

/**
 * PUT /tournaments/:id — atualiza um torneio (nome, prêmio, status)
 */
async function updateTournament(request, env, id) {
  let body;
  try { body = await request.json(); } catch { return errorResponse("Body inválido."); }

  const existing = await env.DB.prepare(`SELECT id FROM tournaments WHERE id = ?`).bind(id).first();
  if (!existing) return errorResponse("Torneio não encontrado.", 404);

  const { name, prize, status } = body;

  // Atualizar apenas campos fornecidos
  if (name) await env.DB.prepare(`UPDATE tournaments SET name = ? WHERE id = ?`).bind(name, id).run();
  if (prize !== undefined) await env.DB.prepare(`UPDATE tournaments SET prize = ? WHERE id = ?`).bind(prize, id).run();
  if (status) await env.DB.prepare(`UPDATE tournaments SET status = ? WHERE id = ?`).bind(status, id).run();

  const updated = await env.DB.prepare(`SELECT * FROM tournaments WHERE id = ?`).bind(id).first();
  const { results: tPlayers } = await env.DB.prepare(
    `SELECT player_name FROM tournament_players WHERE tournament_id = ?`
  ).bind(id).all();
  updated.players = tPlayers.map(p => p.player_name);

  return jsonResponse(updated);
}

/**
 * DELETE /tournaments/:id — exclui um torneio e seus jogadores inscritos
 */
async function deleteTournament(env, id) {
  const existing = await env.DB.prepare(`SELECT id FROM tournaments WHERE id = ?`).bind(id).first();
  if (!existing) return errorResponse("Torneio não encontrado.", 404);

  await env.DB.prepare(`DELETE FROM tournament_players WHERE tournament_id = ?`).bind(id).run();
  await env.DB.prepare(`DELETE FROM tournaments WHERE id = ?`).bind(id).run();
  return jsonResponse({ message: "Torneio excluído." });
}

/**
 * POST /tournaments/:id/players — inscreve jogador no torneio
 */
async function addTournamentPlayer(request, env, id) {
  let body;
  try { body = await request.json(); } catch { return errorResponse("Body inválido."); }

  const existing = await env.DB.prepare(`SELECT id FROM tournaments WHERE id = ?`).bind(id).first();
  if (!existing) return errorResponse("Torneio não encontrado.", 404);

  const { player_name } = body;
  if (!player_name) return errorResponse("player_name é obrigatório.");

  try {
    await env.DB.prepare(
      `INSERT INTO tournament_players (tournament_id, player_name) VALUES (?, ?)`
    ).bind(id, player_name).run();
  } catch (e) {
    // UNIQUE constraint — jogador já inscrito
    return errorResponse("Jogador já inscrito neste torneio.", 409);
  }

  return jsonResponse({ message: `${player_name} inscrito com sucesso.` }, 201);
}

/**
 * DELETE /tournaments/:id/players/:name — remove jogador do torneio
 */
async function removeTournamentPlayer(env, id, playerName) {
  await env.DB.prepare(
    `DELETE FROM tournament_players WHERE tournament_id = ? AND player_name = ?`
  ).bind(id, playerName).run();
  return jsonResponse({ message: "Jogador removido do torneio." });
}

/**
 * GET /tournaments/:id/ranking — calcula ranking do torneio
 *
 * Lógica:
 * 1. Busca torneio e jogadores inscritos
 * 2. Busca matches onde AMBOS os jogadores estão inscritos E match_date dentro do período
 * 3. Calcula pontos por match baseado no resultado de sets
 * 4. Agrega pontos, sets ganhos e games ganhos por jogador
 * 5. Ordena: pontos DESC → sets DESC → games DESC
 */
async function getTournamentRanking(env, id) {
  const tournament = await env.DB.prepare(`SELECT * FROM tournaments WHERE id = ?`).bind(id).first();
  if (!tournament) return errorResponse("Torneio não encontrado.", 404);

  const { results: tPlayers } = await env.DB.prepare(
    `SELECT player_name FROM tournament_players WHERE tournament_id = ?`
  ).bind(id).all();
  const enrolledNames = tPlayers.map(p => p.player_name);

  if (!enrolledNames.length) {
    return jsonResponse({ tournament, ranking: [] });
  }

  // Buscar partidas dentro do período do torneio
  const { results: allMatches } = await env.DB.prepare(
    `SELECT * FROM matches WHERE match_date >= ? AND match_date <= ? ORDER BY match_date ASC`
  ).bind(tournament.start_date, tournament.end_date).all();

  // Filtrar: apenas partidas onde AMBOS os jogadores estão inscritos
  const validMatches = allMatches.filter(m =>
    enrolledNames.includes(m.player1) && enrolledNames.includes(m.player2)
  );

  // Inicializar stats de cada jogador inscrito
  const stats = {};
  for (const name of enrolledNames) {
    stats[name] = {
      player_name: name,
      points: 0,
      wins: 0,
      losses: 0,
      sets_won: 0,
      sets_lost: 0,
      games_won: 0,
      games_lost: 0,
      matches_played: 0,
    };
  }

  // Processar cada partida válida
  for (const m of validMatches) {
    const p1 = m.player1;
    const p2 = m.player2;

    // Contar sets ganhos por cada jogador nesta partida
    let setsP1 = 0, setsP2 = 0;
    let gamesP1 = 0, gamesP2 = 0;

    const sets = [
      [m.set1_p1, m.set1_p2],
      [m.set2_p1, m.set2_p2],
      [m.set3_p1, m.set3_p2],
      [m.set4_p1, m.set4_p2],
      [m.set5_p1, m.set5_p2],
    ];

    for (const [s1, s2] of sets) {
      if (s1 === null || s1 === undefined || s2 === null || s2 === undefined) continue;
      gamesP1 += s1;
      gamesP2 += s2;
      if (s1 > s2) setsP1++;
      else if (s2 > s1) setsP2++;
    }

    // Determinar pontos baseado no formato (melhor de 3 ou melhor de 5)
    const totalSetsPlayed = setsP1 + setsP2;
    const isBestOf5 = totalSetsPlayed > 3 || setsP1 >= 3 || setsP2 >= 3;

    let pointsWinner = 0, pointsLoser = 0;

    if (isBestOf5) {
      // Melhor de 5: 3×0=5/0, 3×1=4/1, 3×2=3/2
      const winnerSets = Math.max(setsP1, setsP2);
      const loserSets = Math.min(setsP1, setsP2);
      if (loserSets === 0) { pointsWinner = 5; pointsLoser = 0; }
      else if (loserSets === 1) { pointsWinner = 4; pointsLoser = 1; }
      else { pointsWinner = 3; pointsLoser = 2; }
    } else {
      // Melhor de 3: 2×0=3/0, 2×1=2/1
      const loserSets = Math.min(setsP1, setsP2);
      if (loserSets === 0) { pointsWinner = 3; pointsLoser = 0; }
      else { pointsWinner = 2; pointsLoser = 1; }
    }

    // Atribuir pontos ao vencedor e perdedor
    const winner = m.winner;
    const loser = (winner === p1) ? p2 : p1;

    if (stats[winner]) {
      stats[winner].points += pointsWinner;
      stats[winner].wins++;
      stats[winner].matches_played++;
      stats[winner].sets_won += (winner === p1) ? setsP1 : setsP2;
      stats[winner].sets_lost += (winner === p1) ? setsP2 : setsP1;
      stats[winner].games_won += (winner === p1) ? gamesP1 : gamesP2;
      stats[winner].games_lost += (winner === p1) ? gamesP2 : gamesP1;
    }

    if (stats[loser]) {
      stats[loser].points += pointsLoser;
      stats[loser].losses++;
      stats[loser].matches_played++;
      stats[loser].sets_won += (loser === p1) ? setsP1 : setsP2;
      stats[loser].sets_lost += (loser === p1) ? setsP2 : setsP1;
      stats[loser].games_won += (loser === p1) ? gamesP1 : gamesP2;
      stats[loser].games_lost += (loser === p1) ? gamesP2 : gamesP1;
    }
  }

  // Ordenar: pontos DESC → sets ganhos DESC → games ganhos DESC
  const ranking = Object.values(stats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.sets_won !== a.sets_won) return b.sets_won - a.sets_won;
    return b.games_won - a.games_won;
  });

  // Adicionar posição
  ranking.forEach((r, i) => { r.position = i + 1; });

  return jsonResponse({
    tournament: {
      ...tournament,
      players: enrolledNames,
    },
    ranking,
    matches_count: validMatches.length,
  });
}
/**
 * Formata placar de uma partida para texto
 */
function formatMatchScore(m) {
  let s = `${m.set1_p1}-${m.set1_p2}, ${m.set2_p1}-${m.set2_p2}`;
  if (m.set3_p1 != null) s += `, ${m.set3_p1}-${m.set3_p2}`;
  if (m.set4_p1 != null) s += `, ${m.set4_p1}-${m.set4_p2}`;
  if (m.set5_p1 != null) s += `, ${m.set5_p1}-${m.set5_p2}`;
  return s;
}

// ── Push Notifications ────────────────────────────────────────────────────────

/**
 * POST /push/subscribe — salva subscription do usuário
 */
async function subscribePush(request, env) {
  let body;
  try { body = await request.json(); } catch { return errorResponse("Body inválido."); }

  const { subscription, player_name } = body;
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return errorResponse("Subscription inválida.");
  }

  await env.DB.prepare(
    `INSERT OR REPLACE INTO push_subscriptions (endpoint, p256dh, auth, player_name)
     VALUES (?, ?, ?, ?)`
  ).bind(
    subscription.endpoint,
    subscription.keys.p256dh,
    subscription.keys.auth,
    player_name || null
  ).run();

  return jsonResponse({ message: "Inscrito para notificações." }, 201);
}

/**
 * DELETE /push/subscribe — remove subscription
 */
async function unsubscribePush(request, env) {
  let body;
  try { body = await request.json(); } catch { return errorResponse("Body inválido."); }

  const { endpoint } = body;
  if (!endpoint) return errorResponse("Endpoint obrigatório.");

  await env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`)
    .bind(endpoint).run();
  return jsonResponse({ message: "Desinscrito." });
}

/**
 * GET /push/vapid-key — retorna chave pública VAPID
 */
function getVapidKey(env) {
  return jsonResponse({ publicKey: env.VAPID_PUBLIC_KEY || "" });
}

/**
 * Envia push notification para todos os inscritos
 */
async function sendPushToAll(env, payload) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM push_subscriptions`
  ).all();

  if (!results.length) return;

  const payloadStr = JSON.stringify(payload);

  for (const sub of results) {
    try {
      const success = await sendWebPush(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payloadStr,
        env
      );
      // Se o endpoint retornou 404/410, remover subscription inválida
      if (!success) {
        await env.DB.prepare(`DELETE FROM push_subscriptions WHERE id = ?`)
          .bind(sub.id).run();
      }
    } catch {
      // Silenciar erros individuais
    }
  }
}

// ── Web Push Protocol (RFC 8291 + RFC 8292) ───────────────────────────────────

function base64urlToUint8(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

function uint8ToBase64url(arr) {
  let bin = '';
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sendWebPush(subscription, payload, env) {
  const vapidPublicKey = base64urlToUint8(env.VAPID_PUBLIC_KEY);
  const vapidPrivateKey = base64urlToUint8(env.VAPID_PRIVATE_KEY);

  // 1. Importar chave privada VAPID para assinar JWT
  const vapidKey = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC', crv: 'P-256',
      x: uint8ToBase64url(vapidPublicKey.slice(1, 33)),
      y: uint8ToBase64url(vapidPublicKey.slice(33, 65)),
      d: uint8ToBase64url(vapidPrivateKey),
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  // 2. Criar VAPID JWT
  const audience = new URL(subscription.endpoint).origin;
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const header = uint8ToBase64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = uint8ToBase64url(new TextEncoder().encode(JSON.stringify({
    aud: audience, exp: expiry, sub: env.VAPID_SUBJECT || 'mailto:courtclash@app.com'
  })));
  const unsignedToken = `${header}.${body}`;
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    vapidKey,
    new TextEncoder().encode(unsignedToken)
  );
  // Converter DER para raw r||s (64 bytes)
  const sigBytes = new Uint8Array(sig);
  let r, s;
  if (sigBytes.length === 64) {
    r = sigBytes.slice(0, 32); s = sigBytes.slice(32);
  } else {
    // DER format
    const rLen = sigBytes[3];
    r = sigBytes.slice(4, 4 + rLen);
    s = sigBytes.slice(6 + rLen);
    if (r.length > 32) r = r.slice(r.length - 32);
    if (s.length > 32) s = s.slice(s.length - 32);
    if (r.length < 32) { const p = new Uint8Array(32); p.set(r, 32 - r.length); r = p; }
    if (s.length < 32) { const p = new Uint8Array(32); p.set(s, 32 - s.length); s = p; }
  }
  const rawSig = new Uint8Array(64);
  rawSig.set(r, 0); rawSig.set(s, 32);
  const jwt = `${unsignedToken}.${uint8ToBase64url(rawSig)}`;

  // 3. Encriptar payload (RFC 8291 - aes128gcm)
  const userPublicKey = base64urlToUint8(subscription.keys.p256dh);
  const userAuth = base64urlToUint8(subscription.keys.auth);

  // Gerar par de chaves efêmeras ECDH
  const localKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const localPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', localKeys.publicKey));

  // Importar chave pública do assinante
  const peerKey = await crypto.subtle.importKey('raw', userPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []);

  // Derivar shared secret
  const sharedBits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: peerKey }, localKeys.privateKey, 256));

  // HKDF para derivar IKM
  const authInfo = new TextEncoder().encode('Content-Encoding: auth\0');
  const prkAuth = await hkdfSha256(userAuth, sharedBits, authInfo, 32);

  // Info para CEK e nonce
  const cekInfo = buildInfo('aesgcm', userPublicKey, localPubRaw);
  const nonceInfo = buildInfo('nonce', userPublicKey, localPubRaw);

  // Salt aleatório
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const cek = await hkdfSha256(salt, prkAuth, cekInfo, 16);
  const nonce = await hkdfSha256(salt, prkAuth, nonceInfo, 12);

  // Encriptar payload
  const payloadBytes = new TextEncoder().encode(payload);
  // Padding: 2 bytes de tamanho do padding + 0 bytes de padding
  const padded = new Uint8Array(payloadBytes.length + 2);
  padded.set(payloadBytes, 2); // primeiros 2 bytes = 0 (sem padding extra)

  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded));

  // Montar body aes128gcm: salt(16) + rs(4) + idLen(1) + keyId(65) + ciphertext
  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  const idLen = new Uint8Array([65]); // tamanho da chave pública
  const bodyArr = new Uint8Array(16 + 4 + 1 + 65 + encrypted.length);
  bodyArr.set(salt, 0);
  bodyArr.set(rs, 16);
  bodyArr.set(idLen, 20);
  bodyArr.set(localPubRaw, 21);
  bodyArr.set(encrypted, 86);

  // 4. Enviar para o push service
  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': '86400',
      'Urgency': 'high',
    },
    body: bodyArr,
  });

  return res.status >= 200 && res.status < 300;
}

// HKDF-SHA256
async function hkdfSha256(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), ikm));
  const infoKey = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const t = new Uint8Array(await crypto.subtle.sign('HMAC', infoKey, new Uint8Array([...info, 1])));
  return t.slice(0, length);
}

function buildInfo(type, clientPublic, serverPublic) {
  const enc = new TextEncoder();
  const typeBytes = enc.encode(`Content-Encoding: ${type}\0P-256\0`);
  const info = new Uint8Array(typeBytes.length + 4 + clientPublic.length + serverPublic.length);
  info.set(typeBytes, 0);
  let offset = typeBytes.length;
  info[offset++] = 0; info[offset++] = clientPublic.length;
  info.set(clientPublic, offset); offset += clientPublic.length;
  info[offset++] = 0; info[offset++] = serverPublic.length;
  info.set(serverPublic, offset);
  return info;
}

// ── Sessões Rápidas ────────────────────────────────────────────────────────

async function createSession(request, env) {
  let body;
  try { body = await request.json(); } catch { return errorResponse("Body inválido."); }

  const { games_to_win, prize, players: playerNames } = body;
  if (!playerNames || playerNames.length < 2) {
    return errorResponse("Selecione pelo menos 2 jogadores.");
  }

  const result = await env.DB.prepare(
    `INSERT INTO quick_sessions (games_to_win, prize) VALUES (?, ?)`
  ).bind(games_to_win || 3, prize || null).run();

  const sessionId = result.meta.last_row_id;

  for (const name of playerNames) {
    await env.DB.prepare(
      `INSERT INTO quick_session_players (session_id, player_name) VALUES (?, ?)`
    ).bind(sessionId, name).run();
  }

  return getSession(env, sessionId);
}

async function listSessions(env) {
  const sessions = await env.DB.prepare(
    `SELECT * FROM quick_sessions ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, id DESC LIMIT 20`
  ).all();

  const result = [];
  for (const s of sessions.results) {
    const players = await env.DB.prepare(
      `SELECT player_name, wins FROM quick_session_players WHERE session_id = ? ORDER BY wins DESC`
    ).bind(s.id).all();
    result.push({ ...s, players: players.results });
  }

  return jsonResponse(result);
}

async function getSession(env, id) {
  const session = await env.DB.prepare(`SELECT * FROM quick_sessions WHERE id = ?`).bind(id).first();
  if (!session) return errorResponse("Sessão não encontrada.", 404);

  const players = await env.DB.prepare(
    `SELECT player_name, wins FROM quick_session_players WHERE session_id = ? ORDER BY wins DESC`
  ).bind(id).all();

  return jsonResponse({ ...session, players: players.results });
}

async function updateSessionScore(request, env, id) {
  let body;
  try { body = await request.json(); } catch { return errorResponse("Body inválido."); }

  const { player_name, delta } = body;
  if (!player_name || delta === undefined) {
    return errorResponse("player_name e delta obrigatórios.");
  }

  // Verificar se sessão está ativa
  const session = await env.DB.prepare(`SELECT status FROM quick_sessions WHERE id = ?`).bind(id).first();
  if (!session) return errorResponse("Sessão não encontrada.", 404);
  if (session.status !== "active") return errorResponse("Sessão já finalizada.");

  await env.DB.prepare(
    `UPDATE quick_session_players SET wins = MAX(0, wins + ?) WHERE session_id = ? AND player_name = ?`
  ).bind(delta, id, player_name).run();

  return getSession(env, id);
}

async function finishSessionRoute(env, id) {
  await env.DB.prepare(
    `UPDATE quick_sessions SET status = 'finished', finished_at = datetime('now') WHERE id = ?`
  ).bind(id).run();
  return getSession(env, id);
}

async function deleteSessionRoute(env, id) {
  await env.DB.prepare(`DELETE FROM quick_session_players WHERE session_id = ?`).bind(id).run();
  await env.DB.prepare(`DELETE FROM quick_sessions WHERE id = ?`).bind(id).run();
  return jsonResponse({ message: "Sessão excluída." });
}

function parseSessionSubRoute(pathname) {
  const m = pathname.match(/^\/sessions\/(\d+)\/(score|finish)$/);
  if (m) return { id: parseInt(m[1]), sub: m[2] };
  return null;
}


/**
 * Extrai o ID numérico de uma URL como /matches/42 ou /players/1
 */
function parseResourceId(pathname, resource) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 2 && parts[0] === resource) {
    const id = parseInt(parts[1], 10);
    return isNaN(id) ? null : id;
  }
  return null;
}

/**
 * Parseia rotas de torneio mais complexas:
 * /tournaments/:id/ranking
 * /tournaments/:id/players
 * /tournaments/:id/players/:name
 */
function parseTournamentSubRoute(pathname) {
  const parts = pathname.split("/").filter(Boolean);

  // /tournaments/:id/ranking
  if (parts.length === 3 && parts[0] === "tournaments" && parts[2] === "ranking") {
    const id = parseInt(parts[1], 10);
    return isNaN(id) ? null : { id, sub: "ranking" };
  }

  // /tournaments/:id/players
  if (parts.length === 3 && parts[0] === "tournaments" && parts[2] === "players") {
    const id = parseInt(parts[1], 10);
    return isNaN(id) ? null : { id, sub: "players" };
  }

  // /tournaments/:id/players/:name
  if (parts.length === 4 && parts[0] === "tournaments" && parts[2] === "players") {
    const id = parseInt(parts[1], 10);
    return isNaN(id) ? null : { id, sub: "player", playerName: decodeURIComponent(parts[3]) };
  }

  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method.toUpperCase();

    // Preflight CORS
    if (method === "OPTIONS") return handleCors();

    // GET /health — sem autenticação
    if (method === "GET" && pathname === "/health") {
      return handleHealth();
    }

    // Todas as outras rotas exigem autenticação
    const authError = requireAuth(request, env);
    if (authError) return authError;

    // ── Rotas de matches ──────────────────────────────────────────────────
    if (method === "GET" && pathname === "/matches") return listMatches(env);
    if (method === "POST" && pathname === "/matches") return createMatch(request, env);
    if (method === "PUT") {
      const id = parseResourceId(pathname, "matches");
      if (id !== null) return updateMatch(request, env, id);
    }
    if (method === "DELETE") {
      const mid = parseResourceId(pathname, "matches");
      if (mid !== null) return deleteMatch(env, mid);
    }

    // ── Rotas de players ──────────────────────────────────────────────────
    if (method === "GET" && pathname === "/players") return listPlayers(env);
    if (method === "POST" && pathname === "/players") return createPlayer(request, env);
    if (method === "PUT") {
      const id = parseResourceId(pathname, "players");
      if (id !== null) return updatePlayer(request, env, id);
    }
    if (method === "DELETE") {
      const pid = parseResourceId(pathname, "players");
      if (pid !== null) return deletePlayer(env, pid);
    }

    // ── Rotas de torneios ─────────────────────────────────────────────────

    // Sub-rotas (/tournaments/:id/ranking, /tournaments/:id/players, etc)
    const subRoute = parseTournamentSubRoute(pathname);
    if (subRoute) {
      if (subRoute.sub === "ranking" && method === "GET") {
        return getTournamentRanking(env, subRoute.id);
      }
      if (subRoute.sub === "players" && method === "POST") {
        return addTournamentPlayer(request, env, subRoute.id);
      }
      if (subRoute.sub === "player" && method === "DELETE") {
        return removeTournamentPlayer(env, subRoute.id, subRoute.playerName);
      }
    }

    // CRUD básico de torneios
    if (method === "GET" && pathname === "/tournaments") return listTournaments(env);
    if (method === "POST" && pathname === "/tournaments") return createTournament(request, env);
    if (method === "PUT") {
      const id = parseResourceId(pathname, "tournaments");
      if (id !== null) return updateTournament(request, env, id);
    }
    if (method === "DELETE") {
      const tid = parseResourceId(pathname, "tournaments");
      if (tid !== null) return deleteTournament(env, tid);
    }

    // ── Rotas de push ─────────────────────────────────────────────────────
    if (method === "GET" && pathname === "/push/vapid-key") return getVapidKey(env);
    if (method === "POST" && pathname === "/push/subscribe") return subscribePush(request, env);
    if (method === "DELETE" && pathname === "/push/subscribe") return unsubscribePush(request, env);

    // ── Rotas de sessões rápidas ───────────────────────────────────────────
    if (method === "GET" && pathname === "/sessions") return listSessions(env);
    if (method === "POST" && pathname === "/sessions") return createSession(request, env);

    const sessionSub = parseSessionSubRoute(pathname);
    if (sessionSub) {
      if (sessionSub.sub === "score" && method === "PUT") return updateSessionScore(request, env, sessionSub.id);
      if (sessionSub.sub === "finish" && method === "PUT") return finishSessionRoute(env, sessionSub.id);
    }

    const sessionId = parseResourceId(pathname, "sessions");
    if (sessionId !== null) {
      if (method === "GET") return getSession(env, sessionId);
      if (method === "DELETE") return deleteSessionRoute(env, sessionId);
    }

    return errorResponse("Rota não encontrada.", 404);
  },
};
