"use client";

import { FileUp } from "lucide-react";
import * as React from "react";

const FileUpload: React.FC = () => {
  return (
    <div className="bg-slate-900 p-4 text-white shadow-2xl flex items-center justify-center">
      <FileUp />
    </div>
  );
};

export default FileUpload;
