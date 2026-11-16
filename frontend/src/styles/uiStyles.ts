// Superfícies do app. São estilos inline (e não classes) porque as telas
// já os aplicam assim; os valores vêm dos tokens definidos em theme.css.

/** Painel: bloco principal de uma tela, um nível acima do fundo. */
export const panelStyle = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
};

/** Cartão: item dentro de um painel, um nível acima dele. */
export const cardStyle = {
  background: "var(--raised)",
  border: "1px solid var(--line)",
};

/** Botão secundário: contorno, sem preenchimento. */
export const buttonGlass = {
  background: "transparent",
  border: "1px solid var(--line-strong)",
};
