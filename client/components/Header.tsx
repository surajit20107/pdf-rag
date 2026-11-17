"use client";

import { FileText } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

const Header = () => {
  return (
    <header className="flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-6">
      {/* Left: Logo + App name */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/30">
          <FileText className="h-4.5 w-4.5 text-white" />
        </div>
        <span className="text-base font-semibold text-slate-900">PDF RAG</span>
      </div>

      {/* Right: User button */}
      <UserButton
        appearance={{
          elements: {
            rootBox: "h-9 w-9",
          },
        }}
      />
    </header>
  );
};

export default Header;
