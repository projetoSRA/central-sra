// Senha padrão usada para o primeiro acesso de contas de aluno criadas pela
// coordenação (importação de planilha ou cadastro manual), que nunca
// escolheram uma senha própria. O aluno loga com ela uma única vez — o
// backend sinaliza `precisaTrocarSenha` na resposta do login, e o frontend
// obriga a definição de uma senha nova antes de liberar o resto do app
// (ver POST /auth/definir-senha em auth.routes.ts).
//
// O valor vem da variável de ambiente SENHA_PADRAO_PRIMEIRO_ACESSO (.env),
// para não ficar exposto no repositório.
export { SENHA_PADRAO_PRIMEIRO_ACESSO } from "../config/env";
