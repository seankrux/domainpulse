import { useState } from "react";

export const Favicon = ({ url }: { url: string }) => {
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${url}&sz=128`;

  if (status === "error") {
    return (
      <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-xs border border-emerald-500/20 flex-shrink-0">
        {url.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <div className="relative w-8 h-8 flex-shrink-0">
      {status === "loading" && <div className="absolute inset-0 rounded-full bg-zinc-800 animate-pulse" />}
      <img
        src={faviconUrl}
        alt=""
        className={`w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 object-contain p-0.5 transition-opacity duration-300 ${status === "success" ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setStatus("success")}
        onError={() => setStatus("error")}
      />
    </div>
  );
};
