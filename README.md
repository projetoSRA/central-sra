# Central SRA

Sistema web escolar para **registrar, comprovar e validar as horas de atividades complementares** dos alunos. Cada aluno precisa atingir uma meta de **200 horas**, somando certificados, relatórios, eventos e visitas técnicas — e toda hora só conta depois de conferida pela coordenação.

O projeto foi desenvolvido na disciplina Projeto Integrador e é dividido em duas aplicações:

- **`backend/`** — API REST em Node.js + Express + TypeScript, com banco PostgreSQL e armazenamento de arquivos no Supabase.
- **`frontend/`** — interface em React + Vite + Tailwind CSS.

## Para quem serve

O sistema tem três perfis de acesso, cada um com a sua tela inicial:

| Perfil | Como entra | O que faz |
| --- | --- | --- |
| **Aluno** | RM (5 dígitos) ou RA (6 a 12 dígitos) + senha | Acompanha o progresso rumo às 200 horas, envia certificados e relatórios, se inscreve em eventos, comprova a participação e baixa o portfólio do bimestre. |
| **Coordenação** | Login + senha | Valida certificados, relatórios e comprovações de eventos, cadastra alunos por planilha, registra visitas técnicas e consulta o histórico de cada aluno. |
| **Empresa parceira** | CNPJ + senha | Publica eventos com data e carga horária e vê a lista de alunos inscritos. |

## Funcionalidades

### Horas complementares (meta de 200h)

O total de horas de cada aluno é a soma de quatro fontes:

1. **Certificados** aprovados pela coordenação.
2. **Relatórios** aprovados pela coordenação.
3. **Eventos** com participação confirmada.
4. **Visitas técnicas** registradas pela coordenação.

O painel do aluno mostra o total, quanto falta para a meta e a contribuição de cada fonte.

### Certificados e relatórios

- O aluno envia o arquivo informando a quantidade de horas e o bimestre (1 a 4).
- **Certificados** aceitam imagem (PNG/JPG) ou PDF; **relatórios** aceitam PDF, TXT, DOC ou DOCX. O limite é de 10 MB por arquivo.
- Em relatórios, o aluno também informa o local da atividade e escreve o relato — esse texto alimenta o portfólio.
- A coordenação vê a fila de pendências e **aprova ou reprova** cada envio. Só envios aprovados somam horas, e o aluno consegue ver o resultado da validação.

### Eventos com comprovação de participação

- A empresa parceira publica o evento; o aluno se inscreve.
- Inscrição sozinha não gera horas. A partir do dia seguinte ao evento, o aluno tem **7 dias corridos** (horário de Brasília) para enviar uma comprovação — um arquivo, um texto ou os dois.
- A coordenação aprova ou reprova a comprovação. Apenas a aprovação confirma a presença e faz as horas do evento contarem.
- A coordenação pode **estender o prazo** de uma inscrição específica. O aluno que perdeu o prazo pode enviar um pedido de reabertura, que a coordenação atende (estendendo o prazo) ou recusa com uma resposta.

### Visitas técnicas

A coordenação registra a visita (local, data, horas e bimestre) para uma turma inteira de uma vez, e as horas entram no total de cada aluno participante.

### Portfólio do aluno em .docx

O sistema gera o portfólio bimestral em Word, com os dados de identificação do aluno, os relatórios aprovados e as visitas técnicas daquele bimestre. O cabeçalho do documento segue o modelo da Etec Jacinto Ferreira de Sá (Ourinhos-SP). Os campos de assinatura e parecer continuam sendo preenchidos à mão.

### Chatbot da coordenação

Um assistente dentro do painel da coordenação que responde perguntas como "quantos certificados estão pendentes?", "quantos alunos já bateram a meta?" ou "quais os próximos eventos?". Ele **não usa nenhuma IA externa**: reconhece a intenção por palavras-chave e consulta o banco, respondendo somente com dados que a coordenação já pode ver nas telas.

### Cadastro de alunos por planilha

A coordenação importa uma planilha `.xlsx` no modelo `RM | NOME | GRUPO`, com uma linha de dados da turma acima do cabeçalho. RMs novos viram contas de aluno; RMs já cadastrados têm nome, curso e série atualizados.

### Primeiro acesso

Contas criadas pela coordenação recebem uma senha provisória (definida em variável de ambiente). No primeiro login o aluno é obrigado a escolher uma senha própria antes de usar o sistema.

### Segurança

- Senhas guardadas com bcrypt e sessão por token JWT (validade de 7 dias).
- Cada rota confere o perfil e se o usuário é dono do dado que está pedindo — um aluno não acessa dados de outro.
- Limite de tentativas de login (8 por minuto) e cabeçalhos HTTP de segurança.
- Os uploads têm o conteúdo real do arquivo conferido, não só a extensão declarada.

## Tecnologias

**Backend**

- Node.js 20, Express 5 e TypeScript
- PostgreSQL via `pg` (o projeto usa o Postgres do Supabase)
- Supabase Storage (`@supabase/supabase-js`) para os arquivos enviados
- `jsonwebtoken` e `bcrypt` para autenticação
- `multer` para upload, `exceljs` para ler planilhas e `docx` para gerar o portfólio
- Docker e Docker Compose (opcional)

**Frontend**

- React 18 e Vite 6
- Tailwind CSS 4, com os tokens do tema em `frontend/src/styles/theme.css`
- React Router 7
- Componentes Radix UI no padrão shadcn/ui, ícones `lucide-react`, avisos com `sonner`

## Estrutura de pastas

```
.
├── backend/
│   ├── src/
│   │   ├── config/env.ts        # leitura e validação das variáveis de ambiente
│   │   ├── middleware/          # autenticação, limite de tentativas, cabeçalhos
│   │   ├── routes/              # uma rota por área: auth, aluno, certificados,
│   │   │                        #   eventos, horas, validacao, visita, chatbot, portfolio
│   │   ├── utils/               # gerador do portfólio, chatbot, checagem de arquivos
│   │   ├── db.ts                # conexão com o Postgres
│   │   ├── supabase.ts          # cliente do Supabase Storage
│   │   └── server.ts            # ponto de entrada da API
│   ├── scripts/                 # migrações do banco (migrate-*.js)
│   ├── tests/                   # testes do chatbot e das visitas
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── pages/           # telas: login, painéis, eventos, certificados...
│   │   │   ├── components/      # layouts, chatbot, régua de horas, componentes de UI
│   │   │   ├── utils/           # chamadas à API, sessão, validações
│   │   │   └── routes.ts        # rotas da aplicação
│   │   └── styles/              # tema e estilos globais
│   └── .env.example
├── docker-compose.yml           # sobe o backend em container
└── README.md
```

## Como rodar localmente

### Pré-requisitos

- [Node.js](https://nodejs.org) 20 ou superior
- Um projeto no [Supabase](https://supabase.com), com o banco PostgreSQL e um bucket no Storage
- Docker Desktop, apenas se quiser rodar o backend em container

> **Sobre o banco de dados:** este repositório não traz um script que cria o banco do zero. As migrações em `backend/scripts/` apenas complementam um banco que já tenha as tabelas principais (`usuario`, `aluno`, `coordenacao`, `empresa`, `eventos`, `inscricao`, `certificados` e `validacao`). A busca de alunos por nome usa a extensão `unaccent` do Postgres — ative com `CREATE EXTENSION IF NOT EXISTS unaccent;`.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Abra o `.env` e preencha com os dados do seu projeto (veja [Variáveis de ambiente](#variáveis-de-ambiente)). Depois rode as migrações, uma vez, nesta ordem:

```bash
node scripts/migrate-visita.js
node scripts/migrate-visita-bimestre.js
node scripts/migrate-cpf-aluno.js
node scripts/migrate-portfolio.js
node scripts/migrate-primeiro-acesso.js
node scripts/migrate-comprovacao-evento.js
```

Todas podem ser executadas mais de uma vez sem causar problema. A `migrate-primeiro-acesso.js` também grava a senha provisória nas contas de aluno que ainda não têm senha.

Suba a API:

```bash
npm run dev
```

Ela fica em `http://localhost:3000`. Acessar esse endereço deve retornar `{ "message": "Backend SRA rodando" }`.

**Alternativa com Docker** — a partir da raiz do projeto, com o `backend/.env` já preenchido:

```bash
docker compose up --build
```

### 2. Frontend

Em outro terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

A aplicação abre em `http://localhost:5173`.

### Testes do backend

Os testes rodam sobre o código compilado e não precisam de conexão com o banco:

```bash
cd backend
npm run build
node tests/visita-turma.cjs
node tests/chatbot-contexto.cjs
```

## Variáveis de ambiente

Os arquivos `.env` **nunca são versionados**. Use os `.env.example` como ponto de partida.

### `backend/.env`

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | Sim | String de conexão do PostgreSQL (no Supabase, a do *pooler*). |
| `SUPABASE_URL` | Sim | URL do projeto no Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Chave `service_role` do Supabase. Dá acesso total ao projeto: use só no backend e nunca a exponha. |
| `JWT_SECRET` | Sim | Segredo que assina os tokens de login. Use um valor longo e aleatório. |
| `SENHA_PADRAO_PRIMEIRO_ACESSO` | Sim | Senha provisória das contas de aluno criadas pela coordenação. |
| `SUPABASE_BUCKET` | Não | Bucket do Storage para os arquivos. Padrão: `arquivos-sra`. |
| `FRONTEND_URL` | Não | Origem liberada no CORS. Padrão: `http://localhost:5173`. |
| `PORT` | Não | Porta da API. Padrão: `3000`. |

Se alguma variável obrigatória faltar, a API se recusa a iniciar e informa qual é.

### `frontend/.env`

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `VITE_API_URL` | Não | Endereço do backend. Padrão: `http://localhost:3000`. |

## Equipe

| Quem | Papel no projeto | Instagram |
| --- | --- | --- |
| **Ana** | Idealizadora e principal redatora da ideia do projeto | [@anaclarabertoloto](https://www.instagram.com/anaclarabertoloto/) |
| **Murilo** | Designer | [@murilo_silva.007](https://www.instagram.com/murilo_silva.007/) |
| **Daniel** | Designer | [@d_mercantee](https://www.instagram.com/d_mercantee/) |
| **Pedro** | Backend e banco de dados | [@pedr0hml](https://www.instagram.com/pedr0hml/) |
| **Sérgio** | Backend e estrutura do site | [@fraz0nn](https://www.instagram.com/fraz0nn/) |

## Dados e privacidade

O sistema lida com dados pessoais de alunos. Por isso este repositório contém **apenas código**: credenciais, planilhas, arquivos enviados pelos usuários e relatórios internos ficam de fora (veja o `.gitignore`). Ao contribuir, não inclua dados reais em commits, exemplos ou capturas de tela.
