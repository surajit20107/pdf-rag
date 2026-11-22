"use client";

import { FileUp, Loader2 } from "lucide-react";
import * as React from "react";

type UploadStatus = "idle" | "uploading" | "processing" | "success" | "error";

type JobProgress = {
  stage?: string;
  percent?: number;
  processed?: number;
  total?: number;
};

const STAGE_LABEL: Record<string, string> = {
  parsing: "Reading PDF…",
  ingesting: "Indexing chunks…",
  done: "Finishing up…",
};

const POLL_INTERVAL_MS = 1500;

const FileUpload: React.FC = () => {
  const SERVER_URL = process.env.API_BASE_URL || "http://localhost:5000";
  const [status, setStatus] = React.useState<UploadStatus>("idle");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<JobProgress | null>(null);
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Upload returns a job id; ingestion then runs in the worker, so poll it until
  // it finishes instead of reporting success as soon as the bytes are sent.
  React.useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const response = await fetch(`${SERVER_URL}/upload/${jobId}`);

        if (response.status === 404) {
          if (!cancelled) {
            setStatus("error");
            setErrorMessage("Job expired before it finished. Try again.");
          }
          return;
        }

        if (!response.ok) {
          throw new Error(`Status check failed: ${response.statusText}`);
        }

        const data = await response.json();
        if (cancelled) return;

        if (data.progress && typeof data.progress === "object") {
          setProgress(data.progress as JobProgress);
        }

        if (data.state === "completed") {
          setProgress({ stage: "done", percent: 100 });
          setStatus("success");
          return;
        }

        if (data.state === "failed") {
          setStatus("error");
          setErrorMessage(data.error || "Ingestion failed. Try again.");
          return;
        }
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setStatus("error");
        setErrorMessage("Lost track of the upload. Try again.");
        return;
      }

      if (!cancelled) timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId, SERVER_URL]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setStatus("uploading");
    setProgress(null);
    setErrorMessage(null);
    setJobId(null);

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

      const data = await response.json();

      if (!data.jobId) {
        throw new Error("Upload succeeded but no job id was returned.");
      }

      setStatus("processing");
      setJobId(String(data.jobId));
    } catch (err) {
      console.error(err);
      setStatus("error");
      setErrorMessage("Upload failed. Try again.");
    }
  };

  const isBusy = status === "uploading" || status === "processing";
  const percent = Math.min(100, Math.max(0, Math.round(progress?.percent ?? 0)));
  const stageLabel = progress?.stage ? (STAGE_LABEL[progress.stage] ?? "Indexing…") : "Uploading…";

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

          {isBusy ? (
            <Loader2 className="mb-2 h-10 w-10 animate-spin text-indigo-500" />
          ) : (
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/30 transition-transform group-hover:scale-105">
              <FileUp className="h-5 w-5 text-white" />
            </div>
          )}

          {status === "success" ? (
            <span className="text-sm font-medium text-emerald-600">
              Ready to answer questions!
            </span>
          ) : status === "error" ? (
            <span className="text-sm font-medium text-red-500">
              {errorMessage ?? "Upload failed. Try again."}
            </span>
          ) : status === "processing" ? (
            <>
              <span className="text-sm font-medium text-slate-700">
                {stageLabel} {percent}%
              </span>
              <span className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-slate-200">
                <span
                  className="block h-full rounded-full bg-indigo-500 transition-[width] duration-500"
                  style={{ width: `${percent}%` }}
                />
              </span>
              {progress?.total ? (
                <span className="mt-1 text-xs text-slate-500">
                  {progress.processed ?? 0} / {progress.total} chunks
                </span>
              ) : null}
            </>
          ) : status === "uploading" ? (
            <span className="text-sm font-medium text-slate-700">
              Uploading{selectedFile ? ` ${selectedFile.name}` : ""}…
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
            PDF · large files welcome
          </span>
        </label>
      </div>
    </div>
  );
};

export default FileUpload;
