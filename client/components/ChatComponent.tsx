"use client";

import { Bot, Send, Paperclip } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { Bounce, toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Types
interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// Sub-components
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`group flex max-w-[72%] flex-col ${isUser ? "items-end" : "items-start"}`}
      >
        {/* Bot avatar + name for assistant */}
        {!isUser && (
          <div className="mb-1.5 flex items-center gap-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm shadow-indigo-500/40">
              <Bot className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-xs font-medium text-slate-500">PDF RAG</span>
          </div>
        )}

        {/* Bubble */}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
            isUser
              ? "rounded-br-sm bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-indigo-500/20"
              : "rounded-bl-sm border border-slate-200 bg-white text-slate-700"
          }`}
        >
          <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
        </div>

        {/* Timestamp */}
        <span
          className={`mt-1 text-xs text-slate-400 ${isUser ? "mr-1" : "ml-1"}`}
        >
          {message.timestamp}
        </span>
      </div>
    </div>
  );
}

// Main component
export default function ChatComponent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<null | string>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSend = async () => {
    if (!input.trim()) return;

    const thinkingMsgId = uuidv4();
    const userMsg = {
      id: uuidv4(),
      role: "user" as const,
      content: input,
      timestamp: new Date().toLocaleTimeString(),
    };
    const thinkingMsg = {
      id: thinkingMsgId,
      role: "assistant" as const,
      content: "Thinking...",
      timestamp: new Date().toLocaleTimeString(),
    };

    try {
      setMessages((prev) => [...prev, userMsg, thinkingMsg]);

      const res = await fetch("http://localhost:5000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: input }),
      });
      if (!res.ok) {
        console.error(res);
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();

      setError(null);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === thinkingMsgId ? { ...msg, content: data.message } : msg
        )
      );
      setInput("");
    } catch (error) {
      toast.error((error as Error)?.message, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: true,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "light",
        transition: Bounce,
      });
      setError(thinkingMsgId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Clean up thinking message when error is set
  useEffect(() => {
    if (error) {
      setMessages((prev) => prev.filter((msg) => msg.id !== error));
      setError(null);
    }
  }, [error]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  return (
    <div className="flex h-full w-full flex-col bg-slate-50">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">Chat</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Ask questions about your uploaded PDFs.
        </p>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-6"
      >
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4">
        <div className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 transition-colors focus-within:border-indigo-400 focus-within:bg-white focus-within:shadow-sm focus-within:shadow-indigo-500/10">
          {/* <Paperclip className="mb-2.5 h-4 w-4 shrink-0 cursor-pointer text-slate-400 transition-colors hover:text-slate-600" /> */}
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Auto-grow up to h-40 (10rem), then scroll
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`; // 160px = h-40 (10 * 16px)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your PDFs…"
            rows={1}
            className="min-h-10 w-full resize-none overflow-y-auto bg-transparent py-0.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            style={{ lineHeight: "1.5rem", maxHeight: "10rem" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/40 transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-slate-400">
          Responses are generated from your uploaded documents.
        </p>
      </div>
    </div>
  );
}
