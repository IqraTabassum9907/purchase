"use client";

import React, { useState, useEffect } from "react";
import { Eye, FileText, X, ExternalLink } from "lucide-react";

interface AttachmentCellProps {
  url?: string | File | null;
  fileName?: string;
}

export function AttachmentCell({ url, fileName: customFileName }: AttachmentCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [isImage, setIsImage] = useState<boolean>(false);
  const [isPdf, setIsPdf] = useState<boolean>(false);

  useEffect(() => {
    if (!url) {
      setPreviewUrl("");
      setDisplayName("");
      setIsImage(false);
      setIsPdf(false);
      return;
    }

    if (url instanceof File) {
      const name = url.name;
      setDisplayName(name);
      const lower = name.toLowerCase();
      const img = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(lower);
      const pdf = lower.endsWith(".pdf");
      setIsImage(img);
      setIsPdf(pdf);

      const objectUrl = URL.createObjectURL(url);
      setPreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }

    if (typeof url === "string") {
      const clean = url.trim();
      if (!clean || clean === "-" || clean === "—") {
        setPreviewUrl("");
        setDisplayName("");
        setIsImage(false);
        setIsPdf(false);
        return;
      }

      let name = customFileName || "";
      if (clean.startsWith("pending-upload:")) {
        name = name || clean.replace("pending-upload:", "");
      } else {
        name = name || clean.split("/").pop() || "attachment";
      }

      setDisplayName(name);
      const lower = name.toLowerCase() + " " + clean.toLowerCase();
      const img = /\.(jpg|jpeg|png|webp|gif|svg)/i.test(lower) || lower.includes("data:image/");
      const pdf = lower.includes(".pdf");
      setIsImage(img);
      setIsPdf(pdf);

      if (clean.startsWith("http://") || clean.startsWith("https://") || clean.startsWith("blob:") || clean.startsWith("data:")) {
        setPreviewUrl(clean);
      } else if (img) {
        // Fallback image URL for mock/demo filenames stored as text
        setPreviewUrl(`https://picsum.photos/seed/${encodeURIComponent(name)}/800/600`);
      } else {
        setPreviewUrl("");
      }
    }
  }, [url, customFileName]);

  if (!url || (typeof url === "string" && (!url.trim() || url === "-" || url === "—"))) {
    return <span className="text-slate-400 text-xs">-</span>;
  }

  const effectiveUrl =
    previewUrl ||
    (typeof url === "string" && (url.startsWith("http") || url.startsWith("/") || url.startsWith("blob:") || url.startsWith("data:"))
      ? url
      : "");

  return (
    <>
      {/* Cell Content (Matching Screenshot 2 & 3) */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        className="inline-flex items-center gap-2 cursor-pointer group select-none py-1"
      >
        {/* Thumbnail Box */}
        <div className="w-10 h-10 rounded-xl overflow-hidden border border-blue-200/80 bg-blue-50/60 flex items-center justify-center shrink-0 shadow-2xs group-hover:border-blue-400 group-hover:shadow-xs transition-all">
          {effectiveUrl && isImage ? (
            <img src={effectiveUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <FileText className="w-5 h-5 text-blue-600 stroke-[1.8]" />
          )}
        </div>

        {/* Text Details */}
        <div className="flex flex-col items-start leading-tight">
          <div className="flex items-center gap-1 text-slate-800 font-bold text-xs group-hover:text-blue-600 transition-colors">
            <Eye className="w-3.5 h-3.5 text-blue-500 stroke-[2.2]" />
            <span>View</span>
          </div>
          <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mt-0.5 group-hover:text-slate-500">
            CLICK TO OPEN
          </span>
        </div>
      </div>

      {/* Popup Modal (Matching Screenshot 4 & 5) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
          }}
        >
          <div
            className="relative flex flex-col items-center max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar */}
            <div className="w-full flex items-center justify-between mb-3 px-1">
              <span className="px-3 py-1 bg-zinc-800/90 text-white text-xs font-semibold rounded-full border border-zinc-700/80 shadow-sm">
                1 / 1
              </span>

              <div className="flex items-center gap-2">
                {effectiveUrl && (
                  <button
                    type="button"
                    onClick={() => window.open(effectiveUrl, "_blank")}
                    className="px-3 py-1.5 bg-zinc-800/90 hover:bg-zinc-700 text-white text-xs font-semibold rounded-lg border border-zinc-700/80 flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Expand
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 bg-zinc-800/90 hover:bg-zinc-700 text-white rounded-full border border-zinc-700/80 transition-colors shadow-sm cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl flex items-center justify-center max-h-[82vh] max-w-[85vw] p-2">
              {effectiveUrl && isImage ? (
                <img
                  src={effectiveUrl}
                  alt={displayName}
                  className="max-h-[78vh] max-w-[82vw] object-contain rounded-xl"
                />
              ) : effectiveUrl && (isPdf || effectiveUrl.endsWith(".pdf")) ? (
                <iframe
                  src={effectiveUrl}
                  title={displayName}
                  className="w-[80vw] h-[78vh] max-w-5xl rounded-xl bg-white border-0"
                />
              ) : effectiveUrl ? (
                <iframe
                  src={effectiveUrl}
                  title={displayName}
                  className="w-[80vw] h-[78vh] max-w-5xl rounded-xl bg-white border-0"
                />
              ) : (
                <div className="p-8 md:p-12 flex flex-col items-center justify-center text-center text-white space-y-4">
                  <div className="p-4 bg-zinc-800 rounded-2xl border border-zinc-700">
                    <FileText className="w-12 h-12 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-lg font-bold">{displayName || "Attachment"}</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      File attachment preview is ready.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
