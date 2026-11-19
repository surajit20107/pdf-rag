"use client";

import { FileUp, Loader2 } from "lucide-react";
import * as React from "react";

const FileUpload: React.FC = () => {
  const SERVER_URL = process.env.API_BASE_URL || "http://localhost:5000";
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadStatus, setUploadStatus] = React.useState<
    "idle" | "success" | "error"
  >("idle");
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsUploading(true);
    setUploadStatus("idle");

    try {
      const formData = new FormData();
      formData.append("pdf", file);

      const response = await fetch(`${SERVER_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      setUploadStatus("success");
    } catch (err) {
      console.error(err);
      setUploadStatus("error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleLabelClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex h-full w-full flex-col p-6">
      {/* Header */}
      <div className="mb-4 shrink-0">
        <h1 className="text-xl font-semibold text-slate-900">Upload PDF</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Add a document to start asking questions.
        </p>
      </div>

      {/* Drop zone */}
      <div className="flex flex-1 items-center justify-center">
        <label
          onClick={handleLabelClick}
          className="group flex h-44 w-full max-w-xs cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition-colors hover:border-indigo-400 hover:bg-indigo-50"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />

          {isUploading ? (
            <Loader2 className="mb-2 h-10 w-10 animate-spin text-indigo-500" />
          ) : (
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/30 transition-transform group-hover:scale-105">
              <FileUp className="h-5 w-5 text-white" />
            </div>
          )}

          {uploadStatus === "success" ? (
            <span className="text-sm font-medium text-emerald-600">
              Uploaded successfully!
            </span>
          ) : uploadStatus === "error" ? (
            <span className="text-sm font-medium text-red-500">
              Upload failed. Try again.
            </span>
          ) : selectedFile ? (
            <span className="text-sm font-medium text-slate-700 truncate max-w-50">
              {selectedFile.name}
            </span>
          ) : (
            <>
              <span className="text-sm font-medium text-slate-700">
                Click to upload
              </span>
              <span className="mt-0.5 text-xs text-slate-500">
                or drag and drop your PDF here
              </span>
            </>
          )}

          <span className="mt-3 rounded-md bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
            PDF · up to 10 MB
          </span>
        </label>
      </div>
    </div>
  );
};

export default FileUpload;
