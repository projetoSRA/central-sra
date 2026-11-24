import { useEffect, useState } from "react";
import Obrigatorio from "../components/Obrigatorio";
import { useNavigate } from "react-router";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "../components/ui/sonner";
import { User } from "../utils/auth";
import { apiFetch, API_URL, saveSession, getToken, clearSession } from "../utils/api";

export default function PrimeiroAcesso() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData || !getToken()) {
      navigate("/");
      return;
    }

    const parsedUser = JSON.parse(userData) as User;
    if (parsedUser.type !== "aluno" || !parsedUser.precisaTrocarSenha) {
      navigate("/");
      return;
    }

    setUser(parsedUser);
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (novaSenha.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (novaSenha !== confirmarSenha) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiFetch(`${API_URL}/auth/definir-senha`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novaSenha }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao definir senha.");
      }

      if (user) {
        const usuarioAtualizado = { ...user, precisaTrocarSenha: false };
        saveSession(usuarioAtualizado, getToken() || "");
      }

      toast.success("Senha definida com sucesso!");
      navigate("/aluno");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao definir senha.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelar = () => {
    clearSession();
    navigate("/");
  };

  if (!user) return null;

  return (
    <div
      className="min-h-screen min-h-[100dvh] bg-paper flex items-center justify-center p-4 sm:p-6 relative"
      style={{
        background: "var(--paper)",
      }}
    >
      <Toaster />

      <div
        className="absolute inset-0"
        style={{
          background:
            "none",
        }}
      />

      <div className="relative w-full max-w-md rounded-2xl border border-ink/15 bg-surface p-6 sm:p-8">
        <div className="mb-7">
          <div className="size-11 rounded-lg bg-blue-500/15 flex items-center justify-center mb-4">
            <KeyRound className="size-5 text-blue-400" />
          </div>
          <h1 className="text-3xl font-semibold text-ink">Primeiro acesso</h1>
          <p className="text-sm text-ink-muted mt-2">
            Olá, {user.name}. Antes de continuar, defina uma senha nova e
            definitiva para sua conta.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label className="text-ink mb-2 block">Nova senha<Obrigatorio /></Label>
            <Input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              className="h-12 rounded-lg bg-raised border-ink/20 text-ink placeholder:text-placeholder"
              placeholder="Mínimo 6 caracteres"
              required
            />
          </div>

          <div>
            <Label className="text-ink mb-2 block">Confirmar nova senha<Obrigatorio /></Label>
            <Input
              type="password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              className="h-12 rounded-lg bg-raised border-ink/20 text-ink placeholder:text-placeholder"
              placeholder="Repita a senha"
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full h-12 rounded-lg bg-brand text-on-brand hover:bg-brand-hover"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="animate-spin" /> : "Salvar e continuar"}
          </Button>

          <button
            type="button"
            onClick={handleCancelar}
            className="w-full text-center text-sm text-ink hover:text-ink transition"
          >
            Cancelar e sair
          </button>
        </form>
      </div>
    </div>
  );
}
