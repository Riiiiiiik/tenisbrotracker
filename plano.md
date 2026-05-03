Você é um desenvolvedor full-stack sênior e UI designer. Crie um mini app web chamado “Court Clash”, um rastreador de confrontos de tênis entre dois jogadores.

O projeto deve ser simples, bonito, responsivo e funcional no celular.

========================
OBJETIVO DO APP
========================

Criar um sistema web para eu e meu amigo registrarmos nossos confrontos de tênis e acompanharmos:

- histórico de partidas
- placar geral da rivalidade
- vitórias por jogador
- percentual de vitórias
- sequência atual de vitórias
- últimos confrontos

O app será usado por poucas pessoas, principalmente em celulares.

========================
STACK OBRIGATÓRIA
========================

Frontend:
- HTML
- CSS
- JavaScript puro
- Não usar React
- Não usar Vue
- Não usar Angular
- Não usar frameworks complexos
- Pode entregar tudo em um único arquivo index.html

Hospedagem:
- GitHub Pages para servir o frontend estático

Backend/API:
- Cloudflare Worker

Banco de dados:
- Cloudflare D1
- Banco SQL compatível com SQLite

Não usar:
- Supabase
- Firebase
- backend Node próprio
- banco localStorage como fonte principal
- GitHub Actions para salvar dados

========================
ARQUITETURA
========================

A arquitetura deve ser:

GitHub Pages
→ serve o frontend estático

Frontend em HTML/CSS/JS
→ faz requisições fetch para a API

Cloudflare Worker
→ recebe as requisições
→ valida um token simples
→ lê/escreve no Cloudflare D1

Cloudflare D1
→ armazena os confrontos

========================
CONCEITO DE UI DESIGN
========================

Tema principal:
- tênis
- placar esportivo
- rivalidade entre dois jogadores
- visual mobile first

Nome visual do app:
Court Clash

Subtítulo:
Rastreador de rivalidade no tênis

Estética:
- moderno
- limpo
- esportivo
- com aparência de app mobile
- inspirado em quadra de tênis e placar de jogo

Paleta:
- verde quadra como cor principal
- amarelo bola de tênis como destaque
- branco/off-white para fundo
- cinza escuro para texto
- vermelho apenas para ações destrutivas

Sugestão de cores:
- verde principal: #0B6B3A
- verde escuro: #064E2F
- amarelo destaque: #D8FF3E
- fundo claro: #F6F8F4
- card branco: #FFFFFF
- texto escuro: #1D1D1D
- texto secundário: #6B7280
- erro/excluir: #DC2626

Tipografia:
- usar fonte de sistema ou Inter via Google Fonts
- visual limpo e legível

Layout:
- mobile first
- cards arredondados
- sombras suaves
- botões grandes
- bastante espaçamento
- não usar tabelas grandes no celular
- usar cards para confrontos
- usar bottom navigation fixa no celular

========================
TELAS / SEÇÕES
========================

O app deve ter 3 áreas principais:

1. Início / Dashboard
2. Novo confronto
3. Estatísticas

Pode implementar como SPA simples em um único index.html, alternando as seções com JavaScript.

========================
TELA 1: DASHBOARD
========================

A tela inicial deve conter:

1. Header:
- nome “Court Clash”
- subtítulo “Rastreador de rivalidade no tênis”

2. Card principal de Head-to-Head:
Deve parecer um placar esportivo.

Mostrar:
- nome do Jogador 1
- nome do Jogador 2
- total de vitórias do Jogador 1
- total de vitórias do Jogador 2
- quem está liderando
- diferença de vitórias
- último vencedor
- sequência atual

Exemplo visual:

Rikelme       João
   12    x     9

Líder: Rikelme
Sequência atual: João venceu 2 seguidas

3. Botão de ação principal:
- “+ Registrar novo confronto”
- deve levar para a seção de novo confronto

4. Lista de confrontos recentes:
Cada confronto deve aparecer em um card.

Cada card deve mostrar:
- data
- jogador 1
- jogador 2
- placar por sets
- vencedor
- observações, se houver
- botão editar
- botão excluir

O vencedor deve receber destaque visual com badge amarelo ou verde.

========================
TELA 2: NOVO CONFRONTO
========================

Criar formulário com os campos:

- jogador1
- jogador2
- data da partida
- set 1 jogador 1
- set 1 jogador 2
- set 2 jogador 1
- set 2 jogador 2
- set 3 jogador 1
- set 3 jogador 2
- vencedor
- observações opcionais

Regras:
- set 3 pode ser opcional
- data deve vir preenchida com a data atual por padrão
- jogador1 e jogador2 devem poder ser reutilizados automaticamente do último confronto cadastrado
- vencedor deve ser selecionado entre jogador1 e jogador2
- botão salvar deve ser grande e fácil de tocar no celular
- após salvar, voltar para o dashboard e atualizar os dados

Validações:
- jogador1 obrigatório
- jogador2 obrigatório
- data obrigatória
- pelo menos set 1 e set 2 devem estar preenchidos
- vencedor obrigatório
- placares devem ser números
- não permitir salvar se os campos principais estiverem vazios

Modo de edição:
- o mesmo formulário deve servir para editar confronto existente
- quando editar, preencher os campos com os dados atuais
- botão deve mudar de “Salvar confronto” para “Atualizar confronto”
- deve haver botão “Cancelar edição”

========================
TELA 3: ESTATÍSTICAS
========================

Mostrar cards com:

- total de partidas
- vitórias do jogador 1
- vitórias do jogador 2
- percentual de vitória de cada jogador
- último vencedor
- sequência atual de vitórias
- maior sequência registrada
- últimos 5 vencedores

Mostrar também um bloco “Forma recente”:

Exemplo:
Rikelme: V V D V D
João: D D V D V

Onde:
- V = vitória
- D = derrota

========================
NAVEGAÇÃO
========================

No mobile, criar uma bottom navigation fixa com 3 botões:

- Início
- Novo
- Stats

A navegação deve:
- destacar a aba ativa
- ser fácil de tocar
- ficar fixa no rodapé em telas pequenas
- não cobrir conteúdo importante

Em telas maiores, pode virar uma navegação no topo ou permanecer no rodapé.

========================
FUNCIONALIDADES OBRIGATÓRIAS
========================

Frontend deve conseguir:

1. Carregar confrontos da API
2. Renderizar dashboard
3. Renderizar lista de confrontos
4. Cadastrar novo confronto
5. Editar confronto
6. Excluir confronto com confirmação
7. Calcular estatísticas no frontend
8. Mostrar estado de carregamento
9. Mostrar mensagem de erro
10. Mostrar mensagem de sucesso
11. Atualizar a tela após criar, editar ou excluir
12. Funcionar bem em celular

========================
API DO CLOUDFLARE WORKER
========================

Criar as seguintes rotas:

GET /matches
- lista todos os confrontos
- ordenar por match_date desc e created_at desc

POST /matches
- cria novo confronto

PUT /matches/:id
- edita confronto existente

DELETE /matches/:id
- exclui confronto

GET /health
- retorna status simples da API

Formato esperado de match:

{
  "id": 1,
  "player1": "Rikelme",
  "player2": "João",
  "set1_p1": 6,
  "set1_p2": 4,
  "set2_p1": 3,
  "set2_p2": 6,
  "set3_p1": 6,
  "set3_p2": 2,
  "winner": "Rikelme",
  "match_date": "2026-05-03",
  "notes": "Jogo equilibrado",
  "created_at": "...",
  "updated_at": "..."
}

========================
SEGURANÇA SIMPLES
========================

Como o app será usado só por mim e meu amigo, usar autenticação simples por token.

Regras:
- O Worker deve validar um header Authorization.
- O frontend deve enviar:
  Authorization: Bearer SEU_TOKEN_AQUI

- O token real deve ficar configurado como variável de ambiente/secret no Cloudflare Worker.
- Não colocar token sensível diretamente no Worker.
- No frontend, pode haver uma área simples de configuração inicial para inserir o token e salvar no localStorage.
- O usuário digita o token uma vez.
- O app salva esse token no localStorage apenas para facilitar uso.
- O token é enviado nas requisições.

Importante:
- Nunca usar service_role.
- Nunca colocar segredos administrativos no frontend.
- Explicar que o token do frontend é apenas uma proteção básica, não segurança de nível bancário.

========================
BANCO DE DADOS
========================

Criar SQL para Cloudflare D1:

Tabela: matches

Campos:
- id INTEGER PRIMARY KEY AUTOINCREMENT
- player1 TEXT NOT NULL
- player2 TEXT NOT NULL
- set1_p1 INTEGER NOT NULL
- set1_p2 INTEGER NOT NULL
- set2_p1 INTEGER NOT NULL
- set2_p2 INTEGER NOT NULL
- set3_p1 INTEGER
- set3_p2 INTEGER
- winner TEXT NOT NULL
- match_date TEXT NOT NULL
- notes TEXT
- created_at TEXT DEFAULT CURRENT_TIMESTAMP
- updated_at TEXT DEFAULT CURRENT_TIMESTAMP

Criar índices úteis:
- índice por match_date
- índice por winner

========================
CÁLCULO DE PLACAR
========================

Criar função para formatar placar:

Exemplo:
set1_p1 = 6
set1_p2 = 4
set2_p1 = 3
set2_p2 = 6
set3_p1 = 6
set3_p2 = 2

Resultado visual:
6-4, 3-6, 6-2

Se set3 estiver vazio, mostrar apenas:
6-4, 7-5

========================
CÁLCULO DE ESTATÍSTICAS
========================

Criar função calculateStats(matches).

Ela deve retornar:

- totalMatches
- players
- winsByPlayer
- winRateByPlayer
- leader
- leadDifference
- lastWinner
- currentStreakPlayer
- currentStreakCount
- biggestStreakPlayer
- biggestStreakCount
- recentFormByPlayer

As estatísticas devem funcionar mesmo se não houver dados.

Se não houver partidas, mostrar estado vazio:
“Nenhum confronto registrado ainda.”

========================
ESTADOS DE INTERFACE
========================

Criar estados visuais para:

1. Carregando:
“Carregando confrontos...”

2. Sem dados:
“Nenhum confronto registrado ainda. Registre o primeiro jogo.”

3. Erro:
“Não foi possível carregar os dados. Verifique sua conexão ou token.”

4. Sucesso:
“Confronto salvo com sucesso.”

5. Confirmação de exclusão:
“Tem certeza que deseja excluir este confronto?”

========================
RESPONSIVIDADE
========================

Mobile first:
- largura máxima confortável
- cards em coluna única
- botões grandes
- inputs grandes
- bottom nav fixa
- evitar fontes pequenas

Desktop:
- centralizar conteúdo
- largura máxima entre 900px e 1100px
- cards podem usar grid
- dashboard pode ter layout em duas colunas

========================
ANIMAÇÕES
========================

Usar apenas animações leves com CSS:
- hover em botões
- transição suave nos cards
- feedback visual ao salvar
- sem bibliotecas externas complexas

========================
ENTREGÁVEIS
========================

Forneça:

1. index.html completo
- HTML, CSS e JavaScript no mesmo arquivo
- pronto para subir no GitHub Pages
- com comentários organizados

2. worker.js completo
- Cloudflare Worker com todas as rotas
- integração com D1
- validação de token
- tratamento de CORS
- respostas JSON padronizadas
- tratamento de erro

3. schema.sql completo
- criação da tabela
- criação dos índices

4. instruções de deploy
Explicar passo a passo:

Frontend:
- criar repositório no GitHub
- adicionar index.html
- ativar GitHub Pages
- acessar a URL publicada

Cloudflare:
- criar Worker
- criar banco D1
- aplicar schema.sql
- vincular D1 ao Worker
- configurar variável/secret do token
- publicar Worker
- copiar URL da API
- colocar URL da API no frontend

5. Instruções de uso:
- abrir app
- inserir token
- cadastrar primeiro confronto
- visualizar dashboard
- editar/excluir confronto

========================
PADRÃO DE CÓDIGO
========================

Código simples e didático.

No frontend, criar funções como:

- getAuthToken()
- setAuthToken()
- apiRequest()
- loadMatches()
- createMatch()
- updateMatch()
- deleteMatch()
- renderApp()
- renderDashboard()
- renderMatches()
- renderStats()
- calculateStats()
- formatScore()
- showToast()
- showSection()
- resetForm()
- fillFormForEdit()

No Worker, criar funções como:

- jsonResponse()
- errorResponse()
- handleCors()
- requireAuth()
- listMatches()
- createMatch()
- updateMatch()
- deleteMatch()
- parseMatchId()

========================
PADRÃO VISUAL DOS CARDS
========================

Card de confronto deve ter:

- data no topo
- badge do vencedor
- nomes dos jogadores em destaque
- placar central
- observações abaixo
- ações no rodapé

Exemplo visual:

[03/05/2026]  [Vencedor: Rikelme]

Rikelme
6-4, 3-6, 6-2
João

“Jogo equilibrado no terceiro set.”

[Editar] [Excluir]

========================
REGRAS IMPORTANTES
========================

- Não inventar dependências desnecessárias.
- Não usar framework.
- Não criar login complexo.
- Não criar múltiplos arquivos se não for necessário.
- O frontend deve funcionar em GitHub Pages.
- A API deve funcionar no Cloudflare Worker.
- O banco deve ser Cloudflare D1.
- A experiência no celular é prioridade.
- O app deve ser simples o suficiente para eu conseguir modificar depois.
- O design deve parecer um mini app esportivo, não uma planilha.

========================
CRITÉRIOS DE ACEITAÇÃO
========================

O projeto estará correto se:

1. Eu conseguir abrir o index.html no GitHub Pages.
2. Eu conseguir configurar a URL da API.
3. Eu conseguir inserir meu token.
4. Eu conseguir cadastrar um confronto.
5. Meu amigo conseguir abrir o mesmo link e ver o confronto.
6. Meu amigo conseguir cadastrar outro confronto usando o mesmo token.
7. O dashboard atualizar com o placar geral.
8. As estatísticas forem calculadas corretamente.
9. Eu conseguir editar e excluir confrontos.
10. O layout funcionar bem no celular.
11. Os dados continuarem salvos no Cloudflare D1.
12. O app não depender de localStorage como banco principal.