import { Router } from "express";
import { db } from "../db";
import { requireAuth, requireRole, requireSelfAlunoOrCoordenacao } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

// Lista as visitas registradas para um aluno (própria coordenação ou o
// próprio aluno dono dos registros).
router.get(
  "/aluno/:idAluno",
  requireSelfAlunoOrCoordenacao("idAluno"),
  async (req, res) => {
    try {
      const { idAluno } = req.params;

      const result = await db.query(
        `
        SELECT
          v.id_visita,
          v.id_aluno,
          v.local,
          v.quantidade_horas,
          v.data_visita,
          v.observacao,
          v.bimestre,
          v.criado_em
        FROM public.visita v
        WHERE v.id_aluno = $1
        ORDER BY v.data_visita DESC, v.criado_em DESC
        `,
        [idAluno]
      );

      return res.json(result.rows);
    } catch (error) {
      console.error("Erro ao listar visitas:", error);
      return res.status(500).json({ message: "Erro ao listar visitas." });
    }
  }
);

router.get("/turmas", requireRole("COORDENACAO"), async (_req, res) => {
  try {
    const result = await db.query(`
      SELECT curso, nivel_ensino, serie_semestre, COUNT(*)::int AS total_alunos
      FROM public.aluno
      WHERE NULLIF(TRIM(curso), '') IS NOT NULL
        AND NULLIF(TRIM(serie_semestre), '') IS NOT NULL
      GROUP BY curso, nivel_ensino, serie_semestre
      ORDER BY curso, serie_semestre, nivel_ensino
    `);
    return res.json(result.rows);
  } catch (error) {
    console.error("Erro ao listar turmas:", error);
    return res.status(500).json({ message: "Erro ao listar turmas." });
  }
});

// Uma única instrução insere a visita para todos os integrantes ou falha por inteiro.
router.post("/", requireRole("COORDENACAO"), async (req, res) => {
  try {
    const idCoordenacao = req.auth!.id_coordenacao;
    const { turma, local, quantidadeHoras, dataVisita, observacao, bimestre,
      empresaParceiraNome, empresaParceiraRepresentante } = req.body;

    if (typeof empresaParceiraNome !== "string" || !empresaParceiraNome.trim()
      || empresaParceiraNome.trim().length > 255
      || (empresaParceiraRepresentante != null && (typeof empresaParceiraRepresentante !== "string"
        || empresaParceiraRepresentante.trim().length > 255))) {
      return res.status(400).json({ message: "Informe a empresa parceira (máximo de 255 caracteres por campo)." });
    }

    if (!turma || typeof turma.curso !== "string" || !turma.curso.trim()
      || typeof turma.serie_semestre !== "string" || !turma.serie_semestre.trim()
      || ![null, "MEDIO", "FACULDADE"].includes(turma.nivel_ensino)
      || typeof local !== "string" || !local.trim() || !dataVisita) {
      return res.status(400).json({
        message: "Selecione uma turma e informe local, quantidade de horas e data.",
      });
    }

    const horas = Number(quantidadeHoras);

    if (!Number.isFinite(horas) || horas <= 0) {
      return res.status(400).json({
        message: "Informe uma quantidade de horas válida.",
      });
    }

    // O bimestre alimenta a geração automática do Portfólio do Aluno (ver
    // certificados.routes.ts, que usa o mesmo campo para relatórios).
    const numeroBimestre = Number(bimestre);

    if (!bimestre || !Number.isInteger(numeroBimestre) || numeroBimestre < 1 || numeroBimestre > 4) {
      return res.status(400).json({
        message: "Informe o bimestre (1 a 4).",
      });
    }

    const result = await db.query(
      `
      WITH turma_atualizada AS (
        UPDATE public.aluno a
        SET empresa_parceira_nome = $10, empresa_parceira_representante = $11
        WHERE a.curso = $7 AND a.serie_semestre = $8
          AND a.nivel_ensino IS NOT DISTINCT FROM $9
        RETURNING a.id_aluno
      )
      INSERT INTO public.visita (
        id_aluno,
        id_coordenacao,
        local,
        quantidade_horas,
        data_visita,
        observacao,
        bimestre
      )
      SELECT a.id_aluno, $1, $2, $3, $4, $5, $6
      FROM turma_atualizada a
      RETURNING *
      `,
      [idCoordenacao, local.trim(), horas, dataVisita, observacao || null,
        numeroBimestre, turma.curso, turma.serie_semestre, turma.nivel_ensino,
        empresaParceiraNome.trim(), empresaParceiraRepresentante?.trim() || null]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: "A turma selecionada não possui alunos." });
    }
    return res.status(201).json({
      message: `Visita técnica agendada e empresa parceira salva para ${result.rowCount} aluno(s) da turma.`,
      totalAlunos: result.rowCount,
      visitas: result.rows,
    });
  } catch (error) {
    console.error("Erro ao registrar visita:", error);
    return res.status(500).json({ message: "Erro ao registrar visita." });
  }
});

// Coordenação exclui um registro de visita.
router.delete("/:idVisita", requireRole("COORDENACAO"), async (req, res) => {
  try {
    const { idVisita } = req.params;

    const result = await db.query(
      `DELETE FROM public.visita WHERE id_visita = $1 RETURNING id_visita`,
      [idVisita]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Visita não encontrada." });
    }

    return res.json({ message: "Visita excluída com sucesso." });
  } catch (error) {
    console.error("Erro ao excluir visita:", error);
    return res.status(500).json({ message: "Erro ao excluir visita." });
  }
});

export default router;
