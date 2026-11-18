import FileUploadComponent from "@/components/file-upload";
import ChatComponent from "@/components/ChatComponent";

export default function Home() {
  return (
    <div className="min-h-screen w-screen flex">
      <div
        id="upload-pdf"
        className="flex h-screen w-[30vw] flex-col border-r-2 border-slate-200 bg-white"
      >
        <FileUploadComponent />
      </div>
      <div id="chat" className="flex w-[70vw] min-h-screen flex-col border-l-2 bg-slate-50">
        <ChatComponent />
      </div>
    </div>
  );
}
