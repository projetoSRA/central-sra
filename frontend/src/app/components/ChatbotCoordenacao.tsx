import { useEffect, useRef, useState } from "react";
import { apiFetch, API_URL } from "../utils/api";
import { panelStyle } from "../../styles/uiStyles";
import { MessageCircle, X, Send, Bot, RotateCcw } from "lucide-react";

type Mensagem = {
  autor: "coordenacao" | "bot";
  texto: string;
};

const SUGESTOES_INICIAIS = [
  "Quantos certificados estão pendentes?",
  "Quantos alunos já bateram a meta?",
  "Quais os próximos eventos?",
  "Quais visitas técnicas estão registradas?",
];

const MENSAGEM_INICIAL: Mensagem = {
  autor: "bot",
  texto:
    "Oi! Eu sou o assistente da coordenação. Posso te ajudar com visitas técnicas por local e data, pendências de validação, dados de um aluno, estatísticas gerais e eventos. O que você quer saber?",
};

const STORAGE_KEY = "chatbot_coordenacao_conversa";

function carregarConversa(): Mensagem[] {
  try {
    const conversaSalva = sessionStorage.getItem(STORAGE_KEY);
    if (!conversaSalva) return [MENSAGEM_INICIAL];

    const mensagens = JSON.parse(conversaSalva);
    if (!Array.isArray(mensagens)) return [MENSAGEM_INICIAL];

    const validas = mensagens.filter(
      (mensagem: any) =>
        mensagem &&
        (mensagem.autor === "coordenacao" || mensagem.autor === "bot") &&
        typeof mensagem.texto === "string"
    );

    return validas.length > 0 ? validas.slice(-30) : [MENSAGEM_INICIAL];
  } catch {
    return [MENSAGEM_INICIAL];
  }
}

export default function ChatbotCoordenacao() {
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>(carregarConversa);
  const [sugestoes, setSugestoes] = useState<string[]>(SUGESTOES_INICIAIS);
  const [entrada, setEntrada] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fimDaListaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aberto) {
      fimDaListaRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [mensagens, aberto]);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(mensagens.slice(-30)));
  }, [mensagens]);

  function novaConversa() {
    setMensagens([MENSAGEM_INICIAL]);
    setSugestoes(SUGESTOES_INICIAIS);
    setEntrada("");
    sessionStorage.removeItem(STORAGE_KEY);
  }

  async function enviarMensagem(texto: string) {
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;

    setMensagens((atual) => [...atual, { autor: "coordenacao", texto: conteudo }]);
    setEntrada("");
    setSugestoes([]);
    setEnviando(true);

    try {
      const response = await apiFetch(`${API_URL}/chatbot/mensagem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensagem: conteudo,
          historico: mensagens.slice(-10),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao falar com o assistente.");
      }

      setMensagens((atual) => [...atual, { autor: "bot", texto: data.resposta }]);
      setSugestoes(Array.isArray(data.sugestoes) ? data.sugestoes : []);
    } catch (error: any) {
      setMensagens((atual) => [
        ...atual,
        {
          autor: "bot",
          texto: error.message || "Não consegui falar com o servidor agora. Tenta de novo em instantes.",
        },
      ]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="fixed bottom-24 right-4 z-[95] flex size-12 items-center justify-center rounded-full bg-blue-500 shadow-[0_10px_30px_rgba(207,207,207,0.35)] transition hover:bg-blue-600 lg:bottom-5 lg:right-5 lg:size-14"
        aria-label={aberto ? "Fechar assistente" : "Abrir assistente"}
      >
        {aberto ? (
          <X className="size-6 text-on-accent" />
        ) : (
          <MessageCircle className="size-6 text-on-accent" />
        )}
      </button>

      {aberto && (
        <div
          className="fixed bottom-40 right-3 z-[95] flex h-[65dvh] max-h-[560px] w-[calc(100vw-1.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl shadow-2xl lg:bottom-24 lg:right-5 lg:h-[70vh] lg:w-[92vw]"
          style={panelStyle}
        >
          <div className="flex items-center gap-2 p-4 border-b border-ink/[0.12]">
            <div className="flex items-center justify-center size-8 rounded-full bg-blue-500/20">
              <Bot className="size-5 text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-ink font-semibold text-sm leading-tight">Assistente da Coordenação</p>
              <p className="text-ink/65 text-xs leading-tight">Pendências, alunos e eventos</p>
            </div>
            <button
              type="button"
              onClick={novaConversa}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink/65 transition hover:bg-ink/[0.06] hover:text-ink"
              title="Nova conversa"
              aria-label="Iniciar nova conversa"
            >
              <RotateCcw className="size-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {mensagens.map((mensagem, indice) => (
              <div
                key={indice}
                className={`flex ${mensagem.autor === "coordenacao" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-line ${
                    mensagem.autor === "coordenacao"
                      ? "bg-blue-500 text-on-accent rounded-br-sm"
                      : "bg-ink/[0.06] text-ink rounded-bl-sm"
                  }`}
                >
                  {mensagem.texto}
                </div>
              </div>
            ))}

            {enviando && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-ink/[0.06] text-ink/75 text-sm px-3 py-2">
                  Digitando...
                </div>
              </div>
            )}

            <div ref={fimDaListaRef} />
          </div>

          {sugestoes.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pb-2">
              {sugestoes.map((sugestao) => (
                <button
                  key={sugestao}
                  type="button"
                  onClick={() => enviarMensagem(sugestao)}
                  className="text-xs px-3 py-1.5 rounded-full bg-ink/[0.06] hover:bg-ink/[0.12] text-ink/95 transition"
                >
                  {sugestao}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              enviarMensagem(entrada);
            }}
            className="flex items-center gap-2 p-3 border-t border-ink/[0.12]"
          >
            <input
              value={entrada}
              onChange={(event) => setEntrada(event.target.value)}
              placeholder="Digite sua pergunta..."
              disabled={enviando}
              className="flex-1 bg-ink/[0.06] text-ink placeholder:text-ink/50 text-sm rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400/50"
            />
            <button
              type="submit"
              disabled={enviando || !entrada.trim()}
              className="flex items-center justify-center size-9 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 transition shrink-0"
              aria-label="Enviar"
            >
              <Send className="size-4 text-on-accent" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
