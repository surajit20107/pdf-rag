import FileUploadComponent from "@/components/file-upload";
import ChatComponent from "@/components/ChatComponent";

export default function Home() {
  return (
    <div className="flex h-full w-full overflow-hidden">
      <div
        id="upload-pdf"
        className="flex h-full w-[30vw] shrink-0 flex-col overflow-hidden border-r-2 border-slate-200 bg-white"
      >
        <FileUploadComponent />
      </div>
      <div
        id="chat"
        className="flex h-full min-w-0 flex-1 flex-col overflow-hidden border-l-2 border-slate-200 bg-slate-50"
      >
        <ChatComponent />
      </div>
    </div>
  );
}
