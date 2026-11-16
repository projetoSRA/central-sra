import { useState } from "react";
import Obrigatorio from "../components/Obrigatorio";
import { useNavigate } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Loader2 } from "lucide-react";
import HourRuler from "../components/HourRuler";
import { toast } from "sonner";
import { Toaster } from "../components/ui/sonner";
import { validateMatriculaAluno, validateLogin, validateCNPJ, validatePassword } from "../utils/validators";
import { authenticateUser } from "../utils/auth";
import { saveSession } from "../utils/api";

export default function Login() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("alunos");
  const [cnpj, setCnpj] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});

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

  const handleCNPJInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    setCnpj(value);
  };

  const campo =
    "h-12 rounded-lg bg-raised border-ink/20 text-ink placeholder:text-ink/40";
  const rotulo = "text-ink/75 mb-2 block";
  const aba =
    "rounded-md text-sm text-ink/65 data-[state=active]:bg-raised data-[state=active]:text-ink data-[state=active]:shadow-sm";

  const erro = (mensagem?: string) =>
    mensagem ? (
      <p role="alert" className="mt-1.5 text-sm text-red-400">
        {mensagem}
      </p>
    ) : null;

  const botaoEntrar = (
    <Button
      className="w-full h-12 rounded-lg bg-ink text-on-accent hover:bg-ink/85"
      disabled={isLoading}
    >
      {isLoading ? <Loader2 className="animate-spin" /> : "Entrar"}
    </Button>
  );

  return (
    <div className="min-h-screen min-h-[100dvh] bg-paper p-3 sm:p-5 flex">
      <Toaster />

      {/* Moldura da página: um fio contornando todo o conteúdo */}
      <div className="flex w-full flex-col rounded-lg border border-ink/25">
        <header className="mx-5 sm:mx-10 flex items-baseline justify-between gap-4 border-b border-ink/25 py-5">
          <span className="font-display text-xl sm:text-2xl font-bold tracking-tight text-ink">
            Central SRA
          </span>
          <span className="hidden sm:block text-sm text-ink/60">
            Horas, certificados e eventos
          </span>
        </header>

        <main className="flex-1 grid items-center gap-10 lg:gap-16 px-5 sm:px-10 py-10 lg:py-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <section className="max-w-2xl">
            <h1 className="font-display text-4xl sm:text-5xl xl:text-6xl font-semibold leading-[1.05] tracking-tight text-ink">
              Cada hora da sua formação, registrada em um só lugar.
            </h1>

            <p className="mt-5 max-w-xl text-base sm:text-lg leading-relaxed text-ink/70">
              Envie certificados e relatórios, inscreva-se em eventos e
              acompanhe quanto falta para completar a carga horária.
            </p>

            <div className="mt-10 lg:mt-14 hidden sm:block" aria-hidden="true">
              <HourRuler value={130} total={200} size="lg" animated />
            </div>
          </section>

          <section
            className="w-full max-w-md justify-self-center lg:justify-self-end rounded-2xl border border-ink/15 bg-surface p-6 sm:p-8"
            aria-labelledby="titulo-entrar"
          >
            <h2 id="titulo-entrar" className="text-2xl font-semibold text-ink">
              Entrar
            </h2>
            <p className="mt-1 mb-6 text-sm text-ink/65">
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
    </div>
  );
}
