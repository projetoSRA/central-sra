import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { db } from "../db";
import { supabase } from "../supabase";
import { matchesDeclaredType } from "../utils/fileSignature";
import {
  requireAuth,
  requireRole,
  requireSelfAlunoOrCoordenacao,
  requireSelfEmpresaOrCoordenacao,
} from "../middleware/auth";

const router = Router();

// ---------------------------------------------------------------------------
// Comprovação de participação em eventos
//
// Regra: a partir do dia seguinte à data do evento, cada aluno inscrito tem
// DIAS_PRAZO_COMPROVACAO dias corridos (até o fim do último dia, horário de
// Brasília) para enviar uma comprovação (arquivo e/ou texto). A coordenação
// aprova ou reprova; só a aprovação marca a inscrição como 'PRESENTE', que é
// o status que as rotas de horas (horas, aluno, chatbot) somam. A coordenação
// pode estender o prazo de uma inscrição específica (prazo_estendido_ate).
// Colunas criadas por scripts/migrate-comprovacao-evento.js.
// ---------------------------------------------------------------------------
const DIAS_PRAZO_COMPROVACAO = 7;
const BUCKET = process.env.SUPABASE_BUCKET || "arquivos-sra";

// "Hoje" no fuso da escola, para o prazo não depender do fuso do servidor.
const HOJE_SQL = `(now() AT TIME ZONE 'America/Sao_Paulo')::date`;
// Data-limite da inscrição (GREATEST ignora NULL quando não há extensão).
// Exige os aliases "i" (inscricao) e "ev" (eventos) na consulta.
const PRAZO_SQL = `GREATEST(ev.data_evento::date + ${DIAS_PRAZO_COMPROVACAO}, i.prazo_estendido_ate)`;
const EVENTO_CONCLUIDO_SQL = `(${HOJE_SQL} > ev.data_evento::date)`;
const PRAZO_ABERTO_SQL = `(${EVENTO_CONCLUIDO_SQL} AND ${HOJE_SQL} <= ${PRAZO_SQL})`;

const CAMPOS_COMPROVACAO_SQL = `
  i.id_inscricao,
  i.comprovacao_status,
  i.comprovacao_texto,
  i.comprovacao_nome_arquivo,
  i.comprovacao_url,
  i.comprovacao_enviada_em,
  i.comprovacao_motivo_reprovacao,
  i.prazo_motivo,
  i.pedido_prazo_status,
  i.pedido_prazo_mensagem,
  i.pedido_prazo_em,
  i.pedido_prazo_resposta,
  to_char(i.prazo_estendido_ate, 'YYYY-MM-DD') AS prazo_estendido_ate,
  to_char(${PRAZO_SQL}, 'YYYY-MM-DD') AS prazo_comprovacao,
  ${EVENTO_CONCLUIDO_SQL} AS evento_concluido,
  ${PRAZO_ABERTO_SQL} AS prazo_aberto,
  (${PRAZO_SQL} - ${HOJE_SQL})::int AS dias_restantes
`;

const TIPOS_COMPROVACAO = [
  "image/png",
  "image/jpeg",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Converte erros do multer (ex.: arquivo acima de 10 MB) em resposta 400.
function receberArquivo(req: Request, res: Response, next: NextFunction) {
  upload.single("arquivo")(req, res, (error: unknown) => {
    if (error) {
      const grande = (error as { code?: string }).code === "LIMIT_FILE_SIZE";
      return res.status(400).json({
        message: grande
          ? "O arquivo deve ter no máximo 10 MB."
          : "Não foi possível ler o arquivo enviado.",
      });
    }
    next();
  });
}

// Banco ainda sem as colunas de comprovação (migração não executada).
function colunaInexistente(error: unknown) {
  return (error as { code?: string })?.code === "42703";
}

const MSG_MIGRACAO =
  "Banco de dados desatualizado: rode scripts/migrate-comprovacao-evento.js.";

// Antes: todas as rotas abaixo eram públicas. Agora exigem login; as
// checagens de papel/posse específicas ficam em cada rota (achado C1).
router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        ev.id_evento,
        ev.id_empresa,
        emp.nome_empresa,
        ev.titulo,
        ev.descricao,
        ev.tipo_evento,
        ev.data_evento,
        ev.horario,
        ev.carga_horaria,
        ev.palestrante,
        ev.info_palestrante,
        ev.criado_em
      FROM public.eventos ev
      JOIN public.empresa emp ON emp.id_empresa = ev.id_empresa
      ORDER BY ev.data_evento DESC, ev.criado_em DESC
    `);

    return res.json(result.rows);
  } catch (error) {
    console.error("Erro ao listar eventos:", error);
    return res.status(500).json({ message: "Erro ao listar eventos." });
  }
});

router.get(
  "/empresa/:idEmpresa",
  requireSelfEmpresaOrCoordenacao("idEmpresa"),
  async (req, res) => {
    try {
      const { idEmpresa } = req.params;

      const result = await db.query(
        `
      SELECT
        id_evento,
        id_empresa,
        titulo,
        descricao,
        tipo_evento,
        data_evento,
        horario,
        carga_horaria,
        palestrante,
        info_palestrante,
        criado_em
      FROM public.eventos
      WHERE id_empresa = $1
      ORDER BY data_evento DESC, criado_em DESC
      `,
        [idEmpresa]
      );

      return res.json(result.rows);
    } catch (error) {
      console.error("Erro ao listar eventos da empresa:", error);
      return res.status(500).json({
        message: "Erro ao listar eventos da empresa.",
      });
    }
  }
);

// Antes: qualquer pessoa podia criar um evento em nome de qualquer empresa
// informando o idEmpresa no corpo. Agora exige login como EMPRESA e usa o
// id do token, ignorando qualquer idEmpresa vindo do cliente.
router.post("/", requireRole("EMPRESA"), async (req, res) => {
  try {
    const idEmpresa = req.auth!.id_empresa;
    const {
      titulo,
      descricao,
      tipoEvento,
      dataEvento,
      horario,
      cargaHoraria,
      palestrante,
      infoPalestrante,
    } = req.body;

    if (!idEmpresa || !titulo || !dataEvento || !cargaHoraria) {
      return res.status(400).json({
        message: "Empresa, título, data e carga horária são obrigatórios.",
      });
    }

    const result = await db.query(
      `
      INSERT INTO public.eventos (
        id_empresa,
        titulo,
        descricao,
        tipo_evento,
        data_evento,
        horario,
        carga_horaria,
        palestrante,
        info_palestrante
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        idEmpresa,
        titulo,
        descricao || null,
        tipoEvento || "PALESTRA",
        dataEvento,
        horario || null,
        Number(cargaHoraria),
        palestrante || null,
        infoPalestrante || null,
      ]
    );

    return res.status(201).json({
      message: "Evento criado com sucesso.",
      evento: result.rows[0],
    });
  } catch (error) {
    console.error("Erro ao criar evento:", error);
    return res.status(500).json({
      message: "Erro ao criar evento.",
    });
  }
});

// Antes: qualquer pessoa podia apagar qualquer evento só sabendo o id.
// Agora exige login e verifica se quem apaga é a empresa dona do evento ou
// a coordenação.
router.delete("/:idEvento", async (req, res) => {
  try {
    const { idEvento } = req.params;
    const auth = req.auth!;

    const evento = await db.query(
      `SELECT id_empresa FROM public.eventos WHERE id_evento = $1`,
      [idEvento]
    );

    if (evento.rowCount === 0) {
      return res.status(404).json({ message: "Evento não encontrado." });
    }

    const podeExcluir =
      auth.tipo_usuario === "COORDENACAO" ||
      (auth.tipo_usuario === "EMPRESA" &&
        String(auth.id_empresa) === String(evento.rows[0].id_empresa));

    if (!podeExcluir) {
      return res.status(403).json({
        message: "Você não tem permissão para excluir este evento.",
      });
    }

    await db.query(
      `
      DELETE FROM public.eventos
      WHERE id_evento = $1
      `,
      [idEvento]
    );

    return res.json({
      message: "Evento excluído com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao excluir evento:", error);
    return res.status(500).json({
      message: "Erro ao excluir evento.",
    });
  }
});

// Eventos em que um aluno está inscrito, com os dados completos do evento
// (usado na tela de detalhe do aluno na coordenação).
router.get(
  "/aluno/:idAluno",
  requireSelfAlunoOrCoordenacao("idAluno"),
  async (req, res) => {
    try {
      const { idAluno } = req.params;

      const consultar = (comComprovacao: boolean) =>
        db.query(
          `
      SELECT
        ev.id_evento,
        ev.id_empresa,
        emp.nome_empresa,
        ev.titulo,
        ev.descricao,
        ev.tipo_evento,
        ev.data_evento,
        ev.horario,
        ev.carga_horaria,
        ev.palestrante,
        ev.info_palestrante,
        i.status_inscricao${comComprovacao ? `, ${CAMPOS_COMPROVACAO_SQL}` : ""}
      FROM public.inscricao i
      JOIN public.eventos ev ON ev.id_evento = i.id_evento
      JOIN public.empresa emp ON emp.id_empresa = ev.id_empresa
      WHERE i.id_aluno = $1
      ORDER BY ev.data_evento DESC
      `,
          [idAluno]
        );

      // Sem as colunas novas (migração pendente), devolve só os dados antigos.
      const result = await consultar(true).catch((error) => {
        if (!colunaInexistente(error)) throw error;
        return consultar(false);
      });

      return res.json(result.rows);
    } catch (error) {
      console.error("Erro ao listar eventos do aluno:", error);
      return res.status(500).json({
        message: "Erro ao listar eventos do aluno.",
      });
    }
  }
);

router.get(
  "/inscricoes/aluno/:idAluno",
  requireRole("ALUNO", "COORDENACAO"),
  async (req, res) => {
    try {
      const { idAluno } = req.params;
      const auth = req.auth!;

      if (auth.tipo_usuario === "ALUNO" && String(auth.id_aluno) !== String(idAluno)) {
        return res.status(403).json({
          message: "Você não tem permissão para acessar dados de outro aluno.",
        });
      }

      const result = await db
        .query(
          `
      SELECT i.id_evento, i.status_inscricao, ${CAMPOS_COMPROVACAO_SQL}
      FROM public.inscricao i
      JOIN public.eventos ev ON ev.id_evento = i.id_evento
      WHERE i.id_aluno = $1
      `,
          [idAluno]
        )
        .catch((error) => {
          // Sem as colunas novas (migração pendente), devolve só os dados antigos.
          if (!colunaInexistente(error)) throw error;
          return db.query(
            `SELECT id_evento, status_inscricao FROM public.inscricao WHERE id_aluno = $1`,
            [idAluno]
          );
        });

      return res.json(result.rows);
    } catch (error) {
      console.error("Erro ao listar inscrições:", error);
      return res.status(500).json({
        message: "Erro ao listar inscrições.",
      });
    }
  }
);

// Antes: qualquer pessoa podia inscrever qualquer aluno em qualquer evento
// informando idAluno no corpo. Agora exige login como ALUNO e usa o id do
// próprio token (auto-inscrição apenas).
router.post("/:idEvento/inscrever", requireRole("ALUNO"), async (req, res) => {
  try {
    const { idEvento } = req.params;
    const idAluno = req.auth!.id_aluno;

    if (!idAluno || !idEvento) {
      return res.status(400).json({
        message: "Aluno e evento são obrigatórios.",
      });
    }

    const existe = await db.query(
      `
      SELECT id_inscricao
      FROM public.inscricao
      WHERE id_aluno = $1
        AND id_evento = $2
      `,
      [idAluno, idEvento]
    );

    if ((existe.rowCount ?? 0) > 0) {
      return res.status(400).json({
        message: "Aluno já inscrito neste evento.",
      });
    }

    const result = await db.query(
      `
      INSERT INTO public.inscricao (
        id_aluno,
        id_evento,
        status_inscricao
      )
      VALUES ($1, $2, 'INSCRITO')
      RETURNING *
      `,
      [idAluno, idEvento]
    );

    return res.status(201).json({
      message: "Inscrição realizada com sucesso.",
      inscricao: result.rows[0],
    });
  } catch (error) {
    console.error("Erro ao inscrever aluno:", error);
    return res.status(500).json({
      message: "Erro ao realizar inscrição.",
    });
  }
});

// Antes: pública — expunha nome, email, RM/RA e curso de todos os inscritos
// para qualquer pessoa. Agora restrita à empresa dona do evento e à
// coordenação (dados sensíveis de alunos, achado A1).
router.get("/:idEvento/inscritos", requireRole("COORDENACAO", "EMPRESA"), async (req, res) => {
  try {
    const { idEvento } = req.params;
    const auth = req.auth!;

    if (auth.tipo_usuario === "EMPRESA") {
      const evento = await db.query(
        `SELECT id_empresa FROM public.eventos WHERE id_evento = $1`,
        [idEvento]
      );

      if (evento.rowCount === 0) {
        return res.status(404).json({ message: "Evento não encontrado." });
      }

      if (String(auth.id_empresa) !== String(evento.rows[0].id_empresa)) {
        return res.status(403).json({
          message: "Você não tem permissão para ver os inscritos deste evento.",
        });
      }
    }

    const result = await db.query(
      `
      SELECT
        a.id_aluno,
        a.nome,
        a.email,
        a.rm,
        a.ra,
        a.curso,
        a.nivel_ensino,
        a.serie_semestre,
        i.status_inscricao
      FROM public.inscricao i
      JOIN public.aluno a ON a.id_aluno = i.id_aluno
      WHERE i.id_evento = $1
      ORDER BY a.nome ASC
      `,
      [idEvento]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("Erro ao listar inscritos:", error);
    return res.status(500).json({
      message: "Erro ao listar inscritos.",
    });
  }
});

// Aluno envia (ou reenvia) a comprovação de participação de um evento em que
// está inscrito. O prazo é conferido aqui no servidor, e de novo dentro do
// próprio UPDATE, para não depender da interface.
router.post(
  "/:idEvento/comprovacao",
  requireRole("ALUNO"),
  receberArquivo,
  async (req, res) => {
    let storagePathNovo: string | null = null;

    try {
      const { idEvento } = req.params;
      const idAluno = req.auth!.id_aluno;
      const file = req.file;
      const texto = typeof req.body?.texto === "string" ? req.body.texto.trim() : "";

      if (!idAluno || !/^\d+$/.test(String(idEvento))) {
        return res.status(400).json({ message: "Aluno ou evento inválido." });
      }

      if (!file && !texto) {
        return res.status(400).json({
          message: "Envie um arquivo ou escreva um relato como comprovação.",
        });
      }

      if (texto.length > 10000) {
        return res.status(400).json({
          message: "O relato deve ter no máximo 10000 caracteres.",
        });
      }

      if (file) {
        if (!TIPOS_COMPROVACAO.includes(file.mimetype)) {
          return res.status(400).json({
            message: "A comprovação aceita imagem (PNG/JPG), PDF, TXT, DOC ou DOCX.",
          });
        }

        // Não confia apenas no Content-Type declarado pelo cliente.
        if (!matchesDeclaredType(file.buffer, file.mimetype)) {
          return res.status(400).json({
            message: "O conteúdo do arquivo não corresponde ao tipo declarado.",
          });
        }
      }

      const atual = await db.query(
        `
        SELECT
          i.id_inscricao,
          i.status_inscricao,
          i.comprovacao_status,
          i.comprovacao_storage_path,
          ${EVENTO_CONCLUIDO_SQL} AS evento_concluido,
          ${PRAZO_ABERTO_SQL} AS prazo_aberto
        FROM public.inscricao i
        JOIN public.eventos ev ON ev.id_evento = i.id_evento
        WHERE i.id_aluno = $1 AND i.id_evento = $2
        `,
        [idAluno, idEvento]
      );

      if (atual.rowCount === 0) {
        return res.status(404).json({
          message: "Você não está inscrito neste evento.",
        });
      }

      const inscricao = atual.rows[0];

      if (
        inscricao.comprovacao_status === "APROVADO" ||
        inscricao.status_inscricao === "PRESENTE"
      ) {
        return res.status(400).json({
          message: "Sua participação neste evento já foi confirmada.",
        });
      }

      if (!inscricao.evento_concluido) {
        return res.status(400).json({
          message: "A comprovação só pode ser enviada depois da data do evento.",
        });
      }

      if (!inscricao.prazo_aberto) {
        return res.status(400).json({
          message:
            "O prazo para enviar a comprovação deste evento está encerrado. Procure a coordenação se precisar de uma extensão.",
        });
      }

      let urlPublica: string | null = null;

      if (file) {
        const nomeSeguro = file.originalname
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-zA-Z0-9._-]/g, "_");

        const caminho = `comprovacoes-eventos/aluno-${idAluno}/${Date.now()}-${nomeSeguro}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(caminho, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (uploadError) {
          console.error(uploadError);
          return res.status(500).json({
            message: "Erro ao enviar arquivo para o Supabase Storage.",
          });
        }

        storagePathNovo = caminho;
        urlPublica = supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
      }

      // O prazo é reconferido no próprio UPDATE: se ele fechar (ou a
      // participação for confirmada) entre a checagem acima e aqui, nada é
      // gravado.
      const update = await db.query(
        `
        UPDATE public.inscricao i
        SET
          comprovacao_status = 'PENDENTE',
          comprovacao_texto = $2,
          comprovacao_nome_arquivo = $3,
          comprovacao_mime_type = $4,
          comprovacao_storage_path = $5,
          comprovacao_url = $6,
          comprovacao_enviada_em = now(),
          comprovacao_motivo_reprovacao = NULL,
          comprovacao_validada_em = NULL,
          comprovacao_validada_por = NULL
        FROM public.eventos ev
        WHERE i.id_inscricao = $1
          AND ev.id_evento = i.id_evento
          AND ${PRAZO_ABERTO_SQL}
          AND COALESCE(i.comprovacao_status, '') <> 'APROVADO'
          AND COALESCE(i.status_inscricao, '') <> 'PRESENTE'
        RETURNING i.id_inscricao
        `,
        [
          inscricao.id_inscricao,
          texto || null,
          file ? file.originalname : null,
          file ? file.mimetype : null,
          storagePathNovo,
          urlPublica,
        ]
      );

      if (update.rowCount === 0) {
        if (storagePathNovo) {
          await supabase.storage.from(BUCKET).remove([storagePathNovo]);
          storagePathNovo = null;
        }
        return res.status(400).json({
          message: "O prazo para enviar a comprovação deste evento está encerrado.",
        });
      }

      // Reenvio substitui a comprovação anterior: apaga o arquivo antigo.
      if (inscricao.comprovacao_storage_path) {
        try {
          await supabase.storage.from(BUCKET).remove([inscricao.comprovacao_storage_path]);
        } catch (erroRemocao) {
          console.error("Erro ao remover comprovação antiga:", erroRemocao);
        }
      }

      return res.status(201).json({
        message: "Comprovação enviada. Aguarde a validação da coordenação.",
      });
    } catch (error) {
      if (storagePathNovo) {
        try {
          await supabase.storage.from(BUCKET).remove([storagePathNovo]);
        } catch {
          // arquivo órfão no storage; o erro original é o que importa aqui
        }
      }
      console.error("Erro ao enviar comprovação:", error);
      return res.status(500).json({
        message: colunaInexistente(error) ? MSG_MIGRACAO : "Erro ao enviar comprovação.",
      });
    }
  }
);

// Coordenação: inscrições de eventos já concluídos com a situação da
// comprovação de cada aluno (pendentes primeiro). Inscrições antigas já
// marcadas como PRESENTE sem comprovação ficam de fora (nada a validar).
router.get("/comprovacoes", requireRole("COORDENACAO"), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        ${CAMPOS_COMPROVACAO_SQL},
        i.status_inscricao,
        a.id_aluno,
        a.nome AS nome_aluno,
        a.email AS email_aluno,
        ev.id_evento,
        ev.titulo,
        ev.tipo_evento,
        to_char(ev.data_evento::date, 'YYYY-MM-DD') AS data_evento,
        ev.carga_horaria,
        emp.nome_empresa
      FROM public.inscricao i
      JOIN public.eventos ev ON ev.id_evento = i.id_evento
      JOIN public.aluno a ON a.id_aluno = i.id_aluno
      JOIN public.empresa emp ON emp.id_empresa = ev.id_empresa
      WHERE ${EVENTO_CONCLUIDO_SQL}
        AND NOT (COALESCE(i.status_inscricao, '') = 'PRESENTE' AND i.comprovacao_status IS NULL)
      ORDER BY
        (i.pedido_prazo_status = 'PENDENTE') DESC NULLS LAST,
        (i.comprovacao_status = 'PENDENTE') DESC NULLS LAST,
        i.comprovacao_enviada_em ASC NULLS LAST,
        ev.data_evento DESC,
        a.nome ASC
    `);

    return res.json(result.rows);
  } catch (error) {
    console.error("Erro ao listar comprovações:", error);
    return res.status(500).json({
      message: colunaInexistente(error) ? MSG_MIGRACAO : "Erro ao listar comprovações.",
    });
  }
});

// Coordenação aprova ou reprova uma comprovação pendente. Só a aprovação
// marca a inscrição como PRESENTE (é o que faz as horas do evento contarem).
router.post(
  "/inscricoes/:idInscricao/validar",
  requireRole("COORDENACAO"),
  async (req, res) => {
    try {
      const { idInscricao } = req.params;
      const status = String(req.body?.status || "").toUpperCase();
      const motivo = typeof req.body?.motivo === "string" ? req.body.motivo.trim() : "";

      if (!/^\d+$/.test(String(idInscricao))) {
        return res.status(400).json({ message: "Inscrição inválida." });
      }

      if (status !== "APROVADO" && status !== "REPROVADO") {
        return res.status(400).json({ message: "Status deve ser APROVADO ou REPROVADO." });
      }

      if (status === "REPROVADO" && !motivo) {
        return res.status(400).json({ message: "Informe o motivo da reprovação." });
      }

      if (motivo.length > 1000) {
        return res.status(400).json({ message: "O motivo deve ter no máximo 1000 caracteres." });
      }

      const update = await db.query(
        `
        UPDATE public.inscricao
        SET
          comprovacao_status = $2::text,
          comprovacao_motivo_reprovacao = $3,
          comprovacao_validada_em = now(),
          comprovacao_validada_por = $4,
          status_inscricao = CASE WHEN $2::text = 'APROVADO' THEN 'PRESENTE' ELSE 'INSCRITO' END
        WHERE id_inscricao = $1
          AND comprovacao_status = 'PENDENTE'
        RETURNING id_inscricao
        `,
        [
          idInscricao,
          status,
          status === "REPROVADO" ? motivo : null,
          req.auth!.id_coordenacao ?? null,
        ]
      );

      if (update.rowCount === 0) {
        const existe = await db.query(
          `SELECT 1 FROM public.inscricao WHERE id_inscricao = $1`,
          [idInscricao]
        );

        if (existe.rowCount === 0) {
          return res.status(404).json({ message: "Inscrição não encontrada." });
        }

        return res.status(400).json({
          message: "Esta inscrição não tem comprovação aguardando validação.",
        });
      }

      return res.json({
        message:
          status === "APROVADO"
            ? "Comprovação aprovada. As horas do evento foram contabilizadas."
            : "Comprovação reprovada.",
      });
    } catch (error) {
      console.error("Erro ao validar comprovação:", error);
      return res.status(500).json({
        message: colunaInexistente(error) ? MSG_MIGRACAO : "Erro ao validar comprovação.",
      });
    }
  }
);

// Coordenação estende o prazo de comprovação de UMA inscrição (aluno que não
// conseguiu entregar por motivo válido). Reabre o envio até a nova data.
router.post(
  "/inscricoes/:idInscricao/prazo",
  requireRole("COORDENACAO"),
  async (req, res) => {
    try {
      const { idInscricao } = req.params;
      const novaData = String(req.body?.novaData || "");
      const motivo = typeof req.body?.motivo === "string" ? req.body.motivo.trim() : "";

      if (!/^\d+$/.test(String(idInscricao))) {
        return res.status(400).json({ message: "Inscrição inválida." });
      }

      const dataLida = /^\d{4}-\d{2}-\d{2}$/.test(novaData)
        ? new Date(`${novaData}T00:00:00Z`)
        : null;
      const dataValida =
        dataLida !== null &&
        !Number.isNaN(dataLida.getTime()) &&
        dataLida.toISOString().slice(0, 10) === novaData;

      if (!dataValida) {
        return res.status(400).json({ message: "Informe uma nova data-limite válida." });
      }

      if (!motivo) {
        return res.status(400).json({ message: "Informe o motivo da extensão do prazo." });
      }

      if (motivo.length > 1000) {
        return res.status(400).json({ message: "O motivo deve ter no máximo 1000 caracteres." });
      }

      const atual = await db.query(
        `
        SELECT
          i.status_inscricao,
          i.comprovacao_status,
          ${EVENTO_CONCLUIDO_SQL} AS evento_concluido,
          ($2::date >= ${HOJE_SQL}) AS data_futura,
          ($2::date > ${PRAZO_SQL}) AS data_maior
        FROM public.inscricao i
        JOIN public.eventos ev ON ev.id_evento = i.id_evento
        WHERE i.id_inscricao = $1
        `,
        [idInscricao, novaData]
      );

      if (atual.rowCount === 0) {
        return res.status(404).json({ message: "Inscrição não encontrada." });
      }

      const inscricao = atual.rows[0];

      if (
        inscricao.comprovacao_status === "APROVADO" ||
        inscricao.status_inscricao === "PRESENTE"
      ) {
        return res.status(400).json({
          message: "A participação deste aluno já foi confirmada.",
        });
      }

      if (!inscricao.evento_concluido) {
        return res.status(400).json({
          message: "O prazo só pode ser estendido depois da data do evento.",
        });
      }

      if (!inscricao.data_futura || !inscricao.data_maior) {
        return res.status(400).json({
          message: "A nova data-limite deve ser de hoje em diante e posterior ao prazo atual.",
        });
      }

      await db.query(
        `
        UPDATE public.inscricao
        SET
          prazo_estendido_ate = $2::date,
          prazo_motivo = $3,
          prazo_estendido_em = now(),
          prazo_estendido_por = $4,
          -- Estender o prazo atende o pedido que o aluno tiver enviado, mesmo
          -- um que a coordenação tenha recusado antes (mudou de ideia).
          pedido_prazo_status = CASE
            WHEN pedido_prazo_status IN ('PENDENTE', 'RECUSADO') THEN 'ATENDIDO'
            ELSE pedido_prazo_status
          END
        WHERE id_inscricao = $1
        `,
        [idInscricao, novaData, motivo, req.auth!.id_coordenacao ?? null]
      );

      return res.json({ message: "Prazo estendido com sucesso." });
    } catch (error) {
      console.error("Erro ao estender prazo:", error);
      return res.status(500).json({
        message: colunaInexistente(error) ? MSG_MIGRACAO : "Erro ao estender prazo.",
      });
    }
  }
);

// Aluno que perdeu o prazo manda uma mensagem à coordenação pedindo a
// reabertura (ex.: explicando o motivo). Só vale com o prazo encerrado; a
// coordenação responde estendendo o prazo (rota acima) ou recusando o pedido.
router.post("/:idEvento/pedido-prazo", requireRole("ALUNO"), async (req, res) => {
  try {
    const { idEvento } = req.params;
    const idAluno = req.auth!.id_aluno;
    const mensagem = typeof req.body?.mensagem === "string" ? req.body.mensagem.trim() : "";

    if (!idAluno || !/^\d+$/.test(String(idEvento))) {
      return res.status(400).json({ message: "Aluno ou evento inválido." });
    }

    if (mensagem.length < 10) {
      return res.status(400).json({
        message: "Escreva uma mensagem explicando o motivo (mínimo de 10 caracteres).",
      });
    }

    if (mensagem.length > 1000) {
      return res.status(400).json({
        message: "A mensagem deve ter no máximo 1000 caracteres.",
      });
    }

    const atual = await db.query(
      `
      SELECT
        i.id_inscricao,
        i.status_inscricao,
        i.comprovacao_status,
        i.pedido_prazo_status,
        ${EVENTO_CONCLUIDO_SQL} AS evento_concluido,
        ${PRAZO_ABERTO_SQL} AS prazo_aberto
      FROM public.inscricao i
      JOIN public.eventos ev ON ev.id_evento = i.id_evento
      WHERE i.id_aluno = $1 AND i.id_evento = $2
      `,
      [idAluno, idEvento]
    );

    if (atual.rowCount === 0) {
      return res.status(404).json({ message: "Você não está inscrito neste evento." });
    }

    const inscricao = atual.rows[0];

    if (
      inscricao.comprovacao_status === "APROVADO" ||
      inscricao.status_inscricao === "PRESENTE"
    ) {
      return res.status(400).json({
        message: "Sua participação neste evento já foi confirmada.",
      });
    }

    if (inscricao.comprovacao_status === "PENDENTE") {
      return res.status(400).json({
        message: "Sua comprovação já foi enviada e aguarda validação da coordenação.",
      });
    }

    if (!inscricao.evento_concluido || inscricao.prazo_aberto) {
      return res.status(400).json({
        message: "O prazo de entrega não está encerrado; envie a comprovação normalmente.",
      });
    }

    // Recusa é definitiva para o aluno: ele não pode insistir com novas
    // mensagens. (A coordenação ainda pode estender o prazo por conta própria.)
    if (inscricao.pedido_prazo_status === "RECUSADO") {
      return res.status(403).json({
        message: "A coordenação já recusou a reabertura do prazo deste evento.",
      });
    }

    if (inscricao.pedido_prazo_status === "PENDENTE") {
      return res.status(400).json({
        message: "Você já enviou uma mensagem para este evento. Aguarde a resposta da coordenação.",
      });
    }

    // Condições repetidas no UPDATE para valer mesmo com dois envios simultâneos.
    const update = await db.query(
      `
      UPDATE public.inscricao i
      SET
        pedido_prazo_status = 'PENDENTE',
        pedido_prazo_mensagem = $2,
        pedido_prazo_em = now(),
        pedido_prazo_resposta = NULL
      FROM public.eventos ev
      WHERE i.id_inscricao = $1
        AND ev.id_evento = i.id_evento
        AND ${EVENTO_CONCLUIDO_SQL}
        AND NOT ${PRAZO_ABERTO_SQL}
        AND COALESCE(i.pedido_prazo_status, '') NOT IN ('PENDENTE', 'RECUSADO')
        AND i.comprovacao_status IS DISTINCT FROM 'PENDENTE'
        AND i.comprovacao_status IS DISTINCT FROM 'APROVADO'
        AND COALESCE(i.status_inscricao, '') <> 'PRESENTE'
      RETURNING i.id_inscricao
      `,
      [inscricao.id_inscricao, mensagem]
    );

    if (update.rowCount === 0) {
      return res.status(400).json({
        message: "Não foi possível enviar a mensagem. Atualize a página e tente de novo.",
      });
    }

    return res.status(201).json({
      message: "Mensagem enviada à coordenação.",
    });
  } catch (error) {
    console.error("Erro ao enviar pedido de prazo:", error);
    return res.status(500).json({
      message: colunaInexistente(error) ? MSG_MIGRACAO : "Erro ao enviar mensagem.",
    });
  }
});

// Coordenação recusa o pedido de reabertura de prazo, com uma resposta que o
// aluno vê. (Para aceitar, basta estender o prazo da inscrição.)
router.post(
  "/inscricoes/:idInscricao/pedido-prazo/recusar",
  requireRole("COORDENACAO"),
  async (req, res) => {
    try {
      const { idInscricao } = req.params;
      const resposta = typeof req.body?.resposta === "string" ? req.body.resposta.trim() : "";

      if (!/^\d+$/.test(String(idInscricao))) {
        return res.status(400).json({ message: "Inscrição inválida." });
      }

      if (!resposta) {
        return res.status(400).json({ message: "Escreva uma resposta para o aluno." });
      }

      if (resposta.length > 1000) {
        return res.status(400).json({
          message: "A resposta deve ter no máximo 1000 caracteres.",
        });
      }

      const update = await db.query(
        `
        UPDATE public.inscricao
        SET pedido_prazo_status = 'RECUSADO', pedido_prazo_resposta = $2
        WHERE id_inscricao = $1 AND pedido_prazo_status = 'PENDENTE'
        RETURNING id_inscricao
        `,
        [idInscricao, resposta]
      );

      if (update.rowCount === 0) {
        return res.status(400).json({
          message: "Esta inscrição não tem pedido de prazo aguardando resposta.",
        });
      }

      return res.json({ message: "Pedido recusado." });
    } catch (error) {
      console.error("Erro ao recusar pedido de prazo:", error);
      return res.status(500).json({
        message: colunaInexistente(error) ? MSG_MIGRACAO : "Erro ao recusar pedido.",
      });
    }
  }
);

export default router;
