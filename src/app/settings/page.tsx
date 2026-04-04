"use client";

import { useState, useRef } from "react";
import { Upload, CheckCircle, AlertCircle, Loader2, Settings2, Server } from "lucide-react";

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-800">
        <Icon className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const [tallyHost, setTallyHost] = useState("localhost");
  const [tallyPort, setTallyPort] = useState("9000");
  const [uploadState, setUploadState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [uploadMsg, setUploadMsg] = useState("");
  const [syncMsg, setSyncMsg]     = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCSVUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploadState("loading");
    const form = new FormData();
    form.append("file", file);

    try {
      const r = await fetch("/api/upload/csv", { method: "POST", body: form });
      const d = await r.json();
      if (r.ok) {
        setUploadState("success");
        setUploadMsg(d.message);
      } else {
        setUploadState("error");
        setUploadMsg(d.error ?? "Upload failed");
      }
    } catch (err) {
      setUploadState("error");
      setUploadMsg("Network error — please try again");
    }

    // Reset after 4s
    setTimeout(() => { setUploadState("idle"); setUploadMsg(""); }, 4000);
  };

  const handleManualSync = async () => {
    setSyncMsg("Triggering sync…");
    try {
      const r = await fetch("/api/sync/trigger", { method: "POST" });
      const d = await r.json();
      setSyncMsg(d.message ?? "Sync triggered — check back in a moment");
    } catch {
      setSyncMsg("Failed to trigger sync");
    }
    setTimeout(() => setSyncMsg(""), 5000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Configure sync source, thresholds, and uploads</p>
      </div>

      {/* Tally config */}
      <Section title="Tally Sync Configuration" icon={Server}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1.5">Host</label>
              <input
                value={tallyHost}
                onChange={(e) => setTallyHost(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 transition"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1.5">Port</label>
              <input
                value={tallyPort}
                onChange={(e) => setTallyPort(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 transition"
              />
            </div>
          </div>
          <p className="text-xs text-slate-600">
            These values are used by <code className="text-cyan-400">python/sync_agent.py</code> via the <code className="text-cyan-400">TALLY_HOST</code> / <code className="text-cyan-400">TALLY_PORT</code> environment variables.
            Update your <code className="text-cyan-400">python/.env</code> file to persist changes.
          </p>
          <button
            onClick={handleManualSync}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 transition-all"
          >
            Trigger Manual Sync
          </button>
          {syncMsg && <p className="text-xs text-slate-400">{syncMsg}</p>}
        </div>
      </Section>

      {/* CSV Upload */}
      <Section title="Manual CSV Upload" icon={Upload}>
        <form onSubmit={handleCSVUpload} className="space-y-4">
          <p className="text-sm text-slate-400">
            Upload a CSV file to use as fallback data source if Tally is unavailable.
            Required columns: <code className="text-cyan-400">name, category, quantity, purchase_rate, expiry_date</code>
          </p>

          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all"
          >
            <Upload className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Click to select a CSV file</p>
            <p className="text-xs text-slate-600 mt-1">Only .csv files accepted</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" />
          </div>

          <button
            type="submit"
            disabled={uploadState === "loading"}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-all disabled:opacity-50"
          >
            {uploadState === "loading" ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
            ) : (
              <><Upload className="w-4 h-4" /> Upload CSV</>
            )}
          </button>

          {(uploadState === "success" || uploadState === "error") && (
            <div className={cn("flex items-center gap-2 text-sm p-3 rounded-lg", uploadState === "success" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400")}>
              {uploadState === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {uploadMsg}
            </div>
          )}
        </form>
      </Section>

      {/* Alert thresholds (informational) */}
      <Section title="Alert Thresholds" icon={Settings2}>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-slate-500 mb-4">
            These thresholds are configured in <code className="text-cyan-400">python/alert_engine.py</code>.
          </p>
          {[
            { label: "Stockout critical threshold",   value: "< 7 days",     color: "text-red-400" },
            { label: "Stockout warning threshold",    value: "< 14 days",    color: "text-yellow-400" },
            { label: "Expiry risk warning",           value: "Score > 70",   color: "text-yellow-400" },
            { label: "Expiry risk critical",          value: "Score > 90",   color: "text-red-400" },
            { label: "Health score critical",         value: "Score < 40",   color: "text-red-400" },
            { label: "Stale sync alert",              value: "> 12 hours",   color: "text-orange-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between py-2 border-b border-slate-800 last:border-none">
              <span className="text-slate-400">{label}</span>
              <span className={cn("font-medium", color)}>{value}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
