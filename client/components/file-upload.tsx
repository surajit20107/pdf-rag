"use client";

import { FileUp } from "lucide-react";
import * as React from "react";

const FileUpload: React.FC = () => {
  return (
    <div className="flex h-full w-full flex-col p-6">
      {/* Header */}
      {/* <div className="mb-4 shrink-0 ">
        <h1 className="text-xl font-semibold text-slate-900">Upload PDF</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Add a document to start asking questions.
        </p>
      </div> */}

      {/* Drop zone — centered vertically in remaining space */}
      <div className="flex flex-1 items-center justify-center">
        <label className="group flex h-44 w-full max-w-xs cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition-colors hover:border-indigo-400 hover:bg-indigo-50">
          <input type="file" accept=".pdf,application/pdf" className="hidden" />

          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/30 transition-transform group-hover:scale-105">
            <FileUp className="h-5 w-5 text-white" />
          </div>

          <span className="text-sm font-medium text-slate-700">
            Click to upload
          </span>
          <span className="mt-0.5 text-xs text-slate-500">
            or drag and drop your PDF here
          </span>

          <span className="mt-3 rounded-md bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
            PDF · up to 10 MB
          </span>
        </label>
      </div>
    </div>
  );
};

export default FileUpload;
