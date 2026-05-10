"use client";

import { useState, useEffect } from "react";
import { ExternalLink, Loader2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogCloseButton,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { getReceiptSignedUrl } from "@/lib/supabase/storage";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiptPath: string;
  vendor: string;
  /** Label shown in the dialog title, e.g. "Receipt", "Invoice", "Payment Proof". */
  label?: string;
}

function isPdfPath(path: string) {
  return path.toLowerCase().endsWith(".pdf");
}

/** Extract the original filename from the storage path. */
function fileNameFromPath(path: string) {
  const part = path.split("/").pop() ?? path;
  return part.replace(/^\d+-/, "");
}

export default function ReceiptPreviewModal({
  open,
  onOpenChange,
  receiptPath,
  vendor,
  label = "Receipt",
}: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPdf = isPdfPath(receiptPath);
  const fileName = fileNameFromPath(receiptPath);

  useEffect(() => {
    if (!open) {
      setSignedUrl(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSignedUrl(null);

    getReceiptSignedUrl(receiptPath, 3600).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.error) {
        setError(result.error);
      } else {
        setSignedUrl(result.signedUrl);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, receiptPath]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          isPdf
            ? "w-[90vw] max-w-[90vw] sm:max-w-[90vw] overflow-hidden flex flex-col"
            : "max-w-2xl"
        }
      >
        <DialogHeader>
          <DialogTitle className="truncate pr-8">
            {label} — {vendor}
          </DialogTitle>
          <DialogCloseButton />
        </DialogHeader>

        <DialogBody
          className={
            isPdf
              ? "flex-1 p-0 overflow-hidden"
              : "min-h-[120px]"
          }
        >
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
              <p className="text-xs text-muted-foreground">Loading receipt…</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex flex-col items-center gap-4 py-10 px-5">
              <div className="flex items-start gap-2 p-3 rounded-md bg-[rgb(254_221_241)] border border-[rgb(254_221_241)] text-xs text-foreground w-full">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                {error}
              </div>
              <p className="text-xs text-muted-foreground">
                Could not load the preview. Try opening it directly.
              </p>
            </div>
          )}

          {/* Image preview */}
          {!loading && signedUrl && !isPdf && (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signedUrl}
                alt={`Receipt for ${vendor}`}
                className="w-full rounded-md object-contain max-h-[65vh] border border-border"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground truncate">{fileName}</p>
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-foreground hover:underline flex-shrink-0 ml-2"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open full size
                </a>
              </div>
            </div>
          )}

          {/* PDF inline preview */}
          {!loading && signedUrl && isPdf && (
            <iframe
              src={signedUrl}
              title={`PDF receipt for ${vendor}`}
              className="w-full border-0"
              style={{ height: "70vh" }}
            />
          )}
        </DialogBody>

        {/* Footer — only for PDF (image footer is inline above) */}
        {isPdf && !loading && (
          <DialogFooter>
            <p className="text-xs text-muted-foreground truncate flex-1 text-left mr-2">
              {fileName}
            </p>
            {signedUrl && (
              <a
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-white text-xs font-medium text-foreground hover:bg-[rgb(248_248_248)] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in new tab
              </a>
            )}
            <DialogClose
              className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold transition-opacity hover:opacity-90"
            >
              Close
            </DialogClose>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
