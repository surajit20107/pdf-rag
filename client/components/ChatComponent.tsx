"use client";

import {
  Bot,
  Send,
  User,
  Copy,
  Check,
  ArrowDown,
  Plus,
  Sparkles,
} from "lucide-react";
import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from "react";
import { Bounce, toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Types
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  pending?: boolean;
}

const SUGGESTIONS = [
  "Summarize this document",
  "What are the key takeaways?",
  "Explain the main concepts simply",
  "List any action items or deadlines",
];

// Shared markdown styling.
const baseProse = [
  "text-[0.9375rem] leading-7",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_p]:my-2",
  "[&_h1]:mt-5 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold",
  "[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold",
  "[&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold",
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
  "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5",
  "[&_li]:marker:text-slate-400",
  "[&_hr]:my-4 [&_hr]:border-slate-200",
  "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm",
  "[&_th]:border [&_th]:border-slate-200 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold",
  "[&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-1.5",
].join(" ");

const assistantProse = [
  baseProse,
  "text-slate-700",
  "[&_h1]:text-slate-900 [&_h2]:text-slate-900 [&_h3]:text-slate-900",
  "[&_strong]:font-semibold [&_strong]:text-slate-900",
  "[&_a]:font-medium [&_a]:text-indigo-600 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-indigo-700",
  "[&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.8125rem] [&_code]:text-indigo-700",
  "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-900 [&_pre]:p-4 [&_pre]:text-[0.8125rem] [&_pre]:text-slate-100",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-slate-100",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-indigo-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-600",
].join(" ");

const userProse = [
  baseProse,
  "text-white",
  "[&_strong]:font-semibold [&_strong]:text-white",
  "[&_a]:text-white [&_a]:underline [&_a]:underline-offset-2",
  "[&_code]:rounded [&_code]:bg-white/20 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.8125rem]",
  "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-black/30 [&_pre]:p-4 [&_pre]:text-[0.8125rem]",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-white/40 [&_blockquote]:pl-4 [&_blockquote]:italic",
  "[&_hr]:border-white/20 [&_th]:border-white/20 [&_td]:border-white/20",
].join(" ");

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
      <span className="sr-only">Thinking…</span>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
      <span className="ml-1 text-xs font-medium text-slate-400">Thinking…</span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy to clipboard", { theme: "light" });
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy response"}
      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-emerald-500" />
          <span className="text-emerald-600">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const isPending = message.pending;

  return (
    <div
      className={`group flex w-full animate-message-in gap-3 ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Avatar */}
      <div className="mt-0.5 shrink-0">
        {isUser ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
            <User className="h-4 w-4 text-slate-500" />
          </div>
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-violet-600 shadow-sm shadow-indigo-500/30">
            <Bot className="h-4 w-4 text-white" />
          </div>
        )}
      </div>

      {/* Content */}
      <div
        className={`flex min-w-0 max-w-[85%] flex-col sm:max-w-[78%] ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        {/* Name row (assistant) */}
        {!isUser && (
          <div className="mb-1 flex items-center gap-1.5 px-1">
            <span className="text-xs font-semibold text-slate-700">
              PDF RAG
            </span>
            <span className="rounded-full bg-indigo-50 px-1.5 py-px text-[10px] font-medium text-indigo-600">
              AI
            </span>
          </div>
        )}

        {/* Bubble */}
        {isPending ? (
          <TypingIndicator />
        ) : (
          <div
            className={`max-w-full wrap-break-word rounded-2xl px-4 py-3 shadow-sm ${
              isUser
                ? "rounded-tr-md bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-indigo-500/20"
                : "rounded-tl-md border border-slate-200 bg-white text-slate-700"
            }`}
          >
            <div className={isUser ? userProse : assistantProse}>
              <Markdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </Markdown>
            </div>
          </div>
        )}

        {/* Meta row: timestamp + copy */}
        {!isPending && (
          <div
            className={`mt-1.5 flex items-center gap-1 px-1 ${
              isUser ? "flex-row-reverse" : "flex-row"
            }`}
          >
            <span className="text-[11px] text-slate-400">
              {message.timestamp}
            </span>
            {!isUser && (
              <span className="opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                <CopyButton text={message.content} />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
        <Sparkles className="h-7 w-7 text-white" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900">
        Ask anything about your PDFs
      </h3>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
        Answers are grounded in the documents you&apos;ve uploaded. Pick a
        prompt below or type your own question.
      </p>
      <div className="mt-7 grid w-full max-w-lg grid-cols-1 gap-2.5 sm:grid-cols-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onPick(suggestion)}
            className="rounded-xl cursor-pointer border border-slate-200 bg-white px-4 py-2.5 text-left text-sm text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:text-slate-900 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChatComponent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const shouldAutoScroll = useRef(true);

  const isThinking = messages.some((msg) => msg.pending);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const resetTextareaHeight = () => {
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleSend = async (override?: string) => {
    const query = (override ?? input).trim();
    if (!query || isThinking) return;

    const thinkingMsgId = uuidv4();
    const userMsg: Message = {
      id: uuidv4(),
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    const thinkingMsg: Message = {
      id: thinkingMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      pending: true,
    };

    // Always follow the conversation when the user sends.
    shouldAutoScroll.current = true;

    try {
      setMessages((prev) => [...prev, userMsg, thinkingMsg]);
      setInput("");
      resetTextareaHeight();

      const res = await fetch("http://localhost:5000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      const data = await res.json();

      setError(null);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === thinkingMsgId
            ? {
                ...msg,
                content: data.message ?? "No response returned.",
                pending: false,
              }
            : msg
        )
      );
    } catch (err) {
      toast.error((err as Error)?.message ?? "Something went wrong", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: true,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: true,
        theme: "light",
        transition: Bounce,
      });
      setError(thinkingMsgId);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput("");
    resetTextareaHeight();
    textareaRef.current?.focus();
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < 96;
    shouldAutoScroll.current = atBottom;
    setShowScrollButton(!atBottom);
  };

  // Remove the failed placeholder bubble.
  useEffect(() => {
    if (error) {
      setMessages((prev) => prev.filter((msg) => msg.id !== error));
      setError(null);
    }
  }, [error]);

  // Follow new messages only when the user is already near the bottom.
  useEffect(() => {
    if (shouldAutoScroll.current) {
      scrollToBottom(messages.length > 1 ? "smooth" : "auto");
    }
  }, [messages, scrollToBottom]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-slate-50">
      {/* Header */}
      <header className="z-10 flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-5 py-3.5 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 shadow-sm shadow-indigo-500/30">
            <Bot className="h-4.5 w-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-slate-900">
                PDF Assistant
              </h2>
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-px text-[10px] font-medium text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Ready
              </span>
            </div>
            <p className="truncate text-xs text-slate-500">
              Ask questions about your uploaded PDFs
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleNewChat}
          disabled={messages.length === 0}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">New chat</span>
        </button>
      </header>

      {/* Messages */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          aria-live="polite"
          className="min-h-0 px-8 flex-1 overflow-y-auto scroll-smooth"
        >
          {messages.length === 0 ? (
            <EmptyState onPick={(text) => handleSend(text)} />
          ) : (
            <div className="mx-auto flex w-full flex-col gap-6 px-4 py-6 sm:px-6">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </div>
          )}
        </div>

        {/* Scroll to bottom */}
        {showScrollButton && (
          <button
            type="button"
            onClick={() => {
              shouldAutoScroll.current = true;
              scrollToBottom();
            }}
            aria-label="Scroll to latest message"
            className="absolute bottom-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md transition-colors hover:text-slate-900"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-slate-200 bg-white/90 px-4 py-3.5 backdrop-blur sm:px-6">
        <div className="mx-auto w-full max-w-5xl">
          <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 shadow-sm transition-all focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/10">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your PDFs…"
              rows={1}
              aria-label="Message"
              className="max-h-40 min-h-10 w-full resize-none overflow-y-auto bg-transparent py-0.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              style={{ lineHeight: "1.5rem" }}
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!input.trim() || isThinking}
              aria-label="Send message"
              className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/40 transition-all hover:scale-105 hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400">
            <span className="hidden sm:inline-flex items-center gap-1">
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-px font-sans text-[10px] font-medium text-slate-500">
                Enter
              </kbd>
              to send
            </span>
            <span className="hidden sm:inline text-slate-300">·</span>
            <span className="hidden sm:inline-flex items-center gap-1">
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-px font-sans text-[10px] font-medium text-slate-500">
                Shift + Enter
              </kbd>
              for a new line
            </span>
            <span className="sm:hidden">
              Responses come from your uploaded documents.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
