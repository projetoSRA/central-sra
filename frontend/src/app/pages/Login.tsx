import { useEffect, useState } from "react";
import Obrigatorio from "../components/Obrigatorio";
import { useNavigate } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Loader2 } from "lucide-react";
import HourRuler from "../components/HourRuler";
import AlternarTema from "../components/AlternarTema";
import { toast } from "sonner";
import { validateMatriculaAluno, validateLogin, validatePassword } from "../utils/validators";
import { authenticateUser } from "../utils/auth";
import { saveSession, PARAM_SESSAO_EXPIRADA } from "../utils/api";
import { mascaraCNPJ } from "../utils/formatar";

export default function Login() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("alunos");
  const [cnpj, setCnpj] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});

  // Chegou aqui porque a sessão expirou (ver apiFetch): avisa uma vez e
  // limpa o parâmetro da URL.
  useEffect(() => {
    if (window.location.search.includes(PARAM_SESSAO_EXPIRADA)) {
      toast.info("Sua sessão expirou. Entre de novo para continuar.");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const handleLogin = async (
    userType: "aluno" | "coordenacao" | "empresa",
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.currentTarget);
    let identifier = formData.get("identifier") as string;

if (userType === "empresa") {
  identifier = identifier.replace(/\D/g, "");
}
    const password = formData.get("password") as string;

    let hasError = false;
    const newErrors: { identifier?: string; password?: string } = {};

    if (userType === "aluno") {
      if (!validateMatriculaAluno(identifier)) {
        newErrors.identifier = "Informe um RM (5 números) ou RA (6 a 12 números) válido";
        hasError = true;
      }
    } else if (userType === "coordenacao") {
      if (!validateLogin(identifier)) {
        newErrors.identifier = "Login deve ter entre 3 e 8 caracteres";
        hasError = true;
      }
    } else if (userType === "empresa") {
  const cnpjLimpo = identifier.replace(/\D/g, "");

  if (cnpjLimpo.length !== 14) {
    newErrors.identifier = "CNPJ deve ter 14 números";
    hasError = true;
  }

  if (password.length !== 8) {
    newErrors.password = "Senha da empresa deve ter 8 dígitos";
    hasError = true;
  }
}

    if (userType !== "empresa" && !validatePassword(password)) {
      newErrors.password = "Senha deve ter no mínimo 6 caracteres";
      hasError = true;
    }

    if (hasError) {
      setErrors(newErrors);
      toast.error("Corrija os erros no formulário");
      return;
    }

    setIsLoading(true);

    try {
      const result = await authenticateUser(userType, identifier, password);

      if (result.success && result.user) {
        toast.success(result.message);
        saveSession(result.user, result.token);

        if (userType === "aluno") {
          navigate(result.user.precisaTrocarSenha ? "/primeiro-acesso" : "/aluno");
        } else if (userType === "coordenacao") navigate("/coordenacao");
        else navigate("/empresa");
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Erro ao realizar login");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMatriculaInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    e.target.value = value.slice(0, 12);
  };

  // Máscara 00.000.000/0000-00 enquanto digita; no envio só os dígitos vão
  // para o backend (ver handleLogin).
  const handleCNPJInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCnpj(mascaraCNPJ(e.target.value));
  };

  const campo =
    "h-12 rounded-lg bg-raised border-ink/20 text-ink placeholder:text-placeholder";
  const rotulo = "text-ink mb-2 block";
  const aba =
    "rounded-md text-sm text-ink data-[state=active]:bg-raised data-[state=active]:text-ink data-[state=active]:shadow-sm";

  const erro = (mensagem?: string) =>
    mensagem ? (
      <p role="alert" className="mt-1.5 text-sm text-red-400">
        {mensagem}
      </p>
    ) : null;

  const botaoEntrar = (
    <Button
      className="w-full h-12 rounded-lg bg-brand text-on-brand hover:bg-brand-hover"
      disabled={isLoading}
    >
      {isLoading ? <Loader2 className="animate-spin" /> : "Entrar"}
    </Button>
  );

  return (
    <div className="login min-h-screen min-h-[100dvh] bg-paper flex flex-col">
      <header className="login__topo">
        <span className="font-display text-xl sm:text-2xl font-bold tracking-tight text-ink">
          Central SRA
        </span>
        <div className="flex items-center gap-4">
          <span className="hidden sm:block text-sm text-ink-muted">
            Horas, certificados e eventos
          </span>
          <AlternarTema />
        </div>
      </header>

      <main className="login__corpo">
        <section className="login__chamada">
          <h1 className="login__titulo">
            Cada hora da sua formação, registrada em um só lugar.
          </h1>

          <p className="mt-6 max-w-[34rem] text-base sm:text-lg leading-relaxed text-ink-muted">
            Envie certificados e relatórios, inscreva-se em eventos e
            acompanhe quanto falta para completar a carga horária.
          </p>
        </section>

        {/* A régua da formação: um exemplo de como palestras, visitas e
            cursos somam horas até a meta. É a marca visual da tela. */}
        <figure className="login__trilha" aria-label="Exemplo: 130 de 200 horas somadas com atividades">
          <div className="trilha__marcas" aria-hidden="true">
            {ATIVIDADES_EXEMPLO.map((a, i) => (
              <div
                key={a.nome}
                className="trilha__marca"
                style={
                  {
                    "--pos": `${(a.ate / 200) * 100}%`,
                    "--nivel": i % 3,
                    "--atraso": `${Math.round((a.ate / 200) * 40) * 28 + 450}ms`,
                  } as React.CSSProperties
                }
              >
                <span className="trilha__nome">{a.nome}</span>
                <span className="trilha__horas">+{a.horas}h</span>
              </div>
            ))}
          </div>

          <HourRuler value={130} total={200} size="lg" animated />

          <figcaption className="trilha__legenda">
            Exemplo de um aluno: 130 de 200 horas. Faltam 70.
          </figcaption>
        </figure>

        <section
          className="login__acesso w-full max-w-md rounded-2xl border border-ink/15 bg-surface p-6 sm:p-8"
          aria-labelledby="titulo-entrar"
        >
            <h2 id="titulo-entrar" className="text-2xl font-semibold text-ink">
              Entrar
            </h2>
            <p className="mt-1 mb-6 text-sm text-ink-muted">
              Escolha seu perfil e informe seus dados de acesso.
            </p>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-lg bg-ink/[0.07] p-1 mb-6">
                <TabsTrigger value="alunos" className={aba}>
                  Aluno
                </TabsTrigger>
                <TabsTrigger value="coordenacao" className={aba}>
                  Coordenação
                </TabsTrigger>
                <TabsTrigger value="empresas" className={aba}>
                  Empresa
                </TabsTrigger>
              </TabsList>

              <TabsContent value="alunos">
                <form onSubmit={(e) => handleLogin("aluno", e)} className="space-y-5">
                  <div>
                    <Label className={rotulo}>RM ou RA<Obrigatorio /></Label>
                    <Input
                      name="identifier"
                      type="text"
                      inputMode="numeric"
                      autoComplete="username"
                      maxLength={12}
                      onChange={handleMatriculaInput}
                      className={campo}
                      placeholder="RM (5 dígitos) ou RA"
                      aria-invalid={!!errors.identifier}
                      required
                    />
                    {erro(errors.identifier)}
                  </div>

                  <div>
                    <Label className={rotulo}>Senha<Obrigatorio /></Label>
                    <Input
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      className={campo}
                      placeholder="••••••••"
                      aria-invalid={!!errors.password}
                      required
                    />
                    {erro(errors.password)}
                  </div>

                  {botaoEntrar}
                </form>
              </TabsContent>

              <TabsContent value="coordenacao">
                <form onSubmit={(e) => handleLogin("coordenacao", e)} className="space-y-5">
                  <div>
                    <Label className={rotulo}>Login<Obrigatorio /></Label>
                    <Input
                      name="identifier"
                      type="text"
                      autoComplete="username"
                      className={campo}
                      placeholder="usuario"
                      aria-invalid={!!errors.identifier}
                      required
                    />
                    {erro(errors.identifier)}
                  </div>

                  <div>
                    <Label className={rotulo}>Senha<Obrigatorio /></Label>
                    <Input
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      className={campo}
                      placeholder="••••••••"
                      aria-invalid={!!errors.password}
                      required
                    />
                    {erro(errors.password)}
                  </div>

                  {botaoEntrar}
                </form>
              </TabsContent>

              <TabsContent value="empresas">
                <form onSubmit={(e) => handleLogin("empresa", e)} className="space-y-5">
                  <div>
                    <Label className={rotulo}>CNPJ<Obrigatorio /></Label>
                    <Input
                      name="identifier"
                      inputMode="numeric"
                      autoComplete="username"
                      maxLength={18}
                      value={cnpj}
                      onChange={handleCNPJInput}
                      className={campo}
                      placeholder="00.000.000/0000-00"
                      aria-invalid={!!errors.identifier}
                      required
                    />
                    {erro(errors.identifier)}
                  </div>

                  <div>
                    <Label className={rotulo}>Senha<Obrigatorio /></Label>
                    <Input
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      className={campo}
                      placeholder="••••••••"
                      aria-invalid={!!errors.password}
                      required
                    />
                    {erro(errors.password)}
                  </div>

                  {botaoEntrar}
                </form>
              </TabsContent>
            </Tabs>
          </section>
      </main>
    </div>
  );
}

// Atividades fictícias que ilustram a régua: cada uma termina na hora
// acumulada (`ate`) em que aparece marcada.
const ATIVIDADES_EXEMPLO = [
  { nome: "Palestra de carreira", horas: 4, ate: 4 },
  { nome: "Visita técnica", horas: 8, ate: 12 },
  { nome: "Curso online", horas: 30, ate: 42 },
  { nome: "Hackathon", horas: 24, ate: 66 },
  { nome: "Monitoria", horas: 40, ate: 106 },
  { nome: "Projeto social", horas: 24, ate: 130 },
];
