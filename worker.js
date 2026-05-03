/**
 * Court Clash - Cloudflare Worker
 *
 * Variáveis de ambiente necessárias (configurar no painel Cloudflare):
 *   AUTH_TOKEN  → token secreto que o frontend vai enviar
 *   DB          → binding do banco D1 (configurar em wrangler.toml ou painel)
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
 * POST /matches — cria um novo confronto
 */
async function createMatch(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Body inválido.");
  }

  const { player1, player2, set1_p1, set1_p2, set2_p1, set2_p2, set3_p1, set3_p2, winner, match_date, notes } = body;

  // Validações básicas
  if (!player1 || !player2 || !winner || !match_date) {
    return errorResponse("Campos obrigatórios ausentes: player1, player2, winner, match_date.");
  }
  if (set1_p1 === undefined || set1_p2 === undefined || set2_p1 === undefined || set2_p2 === undefined) {
    return errorResponse("Set 1 e Set 2 são obrigatórios.");
  }

  const result = await env.DB.prepare(
    `INSERT INTO matches (player1, player2, set1_p1, set1_p2, set2_p1, set2_p2, set3_p1, set3_p2, winner, match_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(player1, player2, set1_p1, set1_p2, set2_p1, set2_p2, set3_p1 ?? null, set3_p2 ?? null, winner, match_date, notes ?? null)
    .run();

  const created = await env.DB.prepare(`SELECT * FROM matches WHERE id = ?`)
    .bind(result.meta.last_row_id)
    .first();

  return jsonResponse(created, 201);
}

/**
 * PUT /matches/:id — atualiza um confronto existente
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

  const { player1, player2, set1_p1, set1_p2, set2_p1, set2_p2, set3_p1, set3_p2, winner, match_date, notes } = body;

  if (!player1 || !player2 || !winner || !match_date) {
    return errorResponse("Campos obrigatórios ausentes.");
  }

  await env.DB.prepare(
    `UPDATE matches
     SET player1 = ?, player2 = ?, set1_p1 = ?, set1_p2 = ?, set2_p1 = ?, set2_p2 = ?,
         set3_p1 = ?, set3_p2 = ?, winner = ?, match_date = ?, notes = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(player1, player2, set1_p1, set1_p2, set2_p1, set2_p2, set3_p1 ?? null, set3_p2 ?? null, winner, match_date, notes ?? null, id)
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

// ── Roteador principal ────────────────────────────────────────────────────────

/**
 * Extrai o ID numérico de uma URL como /matches/42
 */
function parseMatchId(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  // Espera ["matches", "42"]
  if (parts.length === 2 && parts[0] === "matches") {
    const id = parseInt(parts[1], 10);
    return isNaN(id) ? null : id;
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

    // GET /matches
    if (method === "GET" && pathname === "/matches") {
      return listMatches(env);
    }

    // POST /matches
    if (method === "POST" && pathname === "/matches") {
      return createMatch(request, env);
    }

    // PUT /matches/:id
    if (method === "PUT") {
      const id = parseMatchId(pathname);
      if (id !== null) return updateMatch(request, env, id);
    }

    // DELETE /matches/:id
    if (method === "DELETE") {
      const id = parseMatchId(pathname);
      if (id !== null) return deleteMatch(env, id);
    }

    return errorResponse("Rota não encontrada.", 404);
  },
};
