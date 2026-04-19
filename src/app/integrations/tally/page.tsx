"use client";

import { useState, useCallback, useRef } from "react";
import { UploadCloud, FileText, CheckCircle, XCircle, Loader2, AlertTriangle, Database } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type SyncState = "idle" | "uploading_to_storage" | "syncing_to_db" | "complete" | "error";

export default function TallyIntegrationPage() {
  const [state, setState] = useState<SyncState>("idle");
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleFileUpload = useCallback(async (file: File) => {
    if (state !== "idle") return;

    // Validate file type
    if (!file.name.endsWith(".xml")) {
      setError("Please upload a valid Tally XML file (.xml)");
      setState("error");
      return;
    }

    // Validate file size (max 100MB for XML dumps)
    if (file.size > 100 * 1024 * 1024) {
      setError("File size must be less than 100MB");
      setState("error");
      return;
    }

    setState("uploading_to_storage");
    setProgress("Uploading to storage...");
    setError("");

    try {
      // Step 1: Upload to Supabase Storage
      const fileName = `tally-dump-${Date.now()}-${file.name}`;

      const { data, error: uploadError } = await supabase.storage
        .from("tally-dumps")
        .upload(fileName, file, {
          cacheControl: "no-cache",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("tally-dumps")
        .getPublicUrl(fileName);

      const filePath = urlData.publicUrl;
      setProgress("Upload complete. Starting sync...");

      // Step 2: Trigger API
      setState("syncing_to_db");
      setProgress("Syncing inventory data to database...");

      const response = await fetch("/api/tally-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: filePath }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || "Sync failed");
      }

      setResult(responseData);
      setState("complete");
      setProgress("Sync complete!");

    } catch (err: any) {
      console.error("Upload/sync error:", err);
      setError(err.message || "Failed to sync file");
      setState("error");
    }
  }, [state, supabase]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const resetState = useCallback(() => {
    setState("idle");
    setProgress("");
    setError("");
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        {/* Premium Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Database className="w-6 h-6 text-cyan-400" />
            <h1 className="text-3xl font-semibold tracking-tight text-white">ERP Integrations</h1>
          </div>
          <p className="text-zinc-400 mt-2">
            Upload your Tally XML export to sync inventory transactions with the warehouse database
          </p>
        </div>

        {/* Premium Status Card */}
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            {state === "idle" && <UploadCloud className="w-8 h-8 text-zinc-500" />}
            {state === "uploading_to_storage" && <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />}
            {state === "syncing_to_db" && <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />}
            {state === "complete" && <CheckCircle className="w-8 h-8 text-green-400" />}
            {state === "error" && <XCircle className="w-8 h-8 text-red-400" />}

            <div>
              <h2 className="font-semibold text-white">
                {state === "idle" && "Ready to upload"}
                {state === "uploading_to_storage" && "Uploading to storage..."}
                {state === "syncing_to_db" && "Syncing to database..."}
                {state === "complete" && "Sync complete"}
                {state === "error" && "Sync failed"}
              </h2>
              {progress && (
                <p className="text-sm text-zinc-400">{progress}</p>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {(state === "uploading_to_storage" || state === "syncing_to_db") && (
            <div className="w-full bg-zinc-800 rounded-full h-1.5 mb-4">
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  state === "uploading_to_storage" ? "bg-cyan-500 w-1/2" : "bg-cyan-500 w-3/4"
                }`}
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Success Result */}
          {result && state === "complete" && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <h3 className="font-semibold text-green-400 mb-3">Sync Results</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-zinc-500">Total Vouchers:</span>
                  <span className="ml-2 font-medium text-white">{result.total_vouchers}</span>
                </div>
                <div>
                  <span className="text-zinc-500">New Inserts:</span>
                  <span className="ml-2 font-medium text-white">{result.new_inserts}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Updates:</span>
                  <span className="ml-2 font-medium text-white">{result.updates}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Failed:</span>
                  <span className="ml-2 font-medium text-white">{result.failed}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Premium Upload Zone */}
        <div
          className={`relative border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-300 cursor-pointer ${
            state === "idle"
              ? "border-zinc-700/50 bg-zinc-900/20 hover:border-cyan-500/50 hover:bg-cyan-500/5"
              : "border-zinc-800 bg-zinc-900/10 cursor-not-allowed opacity-40"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => state === "idle" && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml"
            className="hidden"
            onChange={handleFileSelect}
            disabled={state !== "idle"}
          />

          <div className="flex flex-col items-center gap-4">
            <div className={`p-5 rounded-2xl transition-all duration-300 ${
              state === "idle" ? "bg-zinc-800/50" : "bg-zinc-800"
            }`}>
              <FileText className={`w-12 h-12 ${
                state === "idle" ? "text-zinc-500" : "text-zinc-400"
              }`} />
            </div>

            <div>
              <p className="font-medium text-white text-lg">
                {state === "idle"
                  ? "Drop your Tally XML file here"
                  : "Processing..."}
              </p>
              <p className="text-sm text-zinc-500 mt-1">
                {state === "idle"
                  ? "or click to browse files"
                  : "Please wait for the current operation to complete"}
              </p>
            </div>

            <p className="text-xs text-zinc-600">
              Maximum file size: 100MB &bull; XML format only
            </p>
          </div>
        </div>

        {/* Premium Reset Button */}
        {(state === "complete" || state === "error") && (
          <button
            onClick={resetState}
            className="mt-6 w-full py-3 px-6 bg-white text-black hover:bg-zinc-200 font-medium rounded-lg transition-colors"
          >
            {state === "complete" ? "Upload Another File" : "Try Again"}
          </button>
        )}
      </div>
    </div>
  );
}