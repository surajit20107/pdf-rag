import FileUploadComponent from "@/components/file-upload";

export default function Home() {
  return (
    <div className="min-h-screen w-screen flex">
      <div
        id="upload-pdf"
        className="flex h-screen w-[30vw] flex-col border-r-2 border-slate-200 bg-white"
      >
        <FileUploadComponent />
      </div>
      <div id="chat" className="w-[70vw] min-h-screen border-l-2">2</div>
    </div>
  );
}
