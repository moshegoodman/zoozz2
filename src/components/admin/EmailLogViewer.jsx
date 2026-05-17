import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Mail, RefreshCcw, Search, AlertCircle, CheckCircle2, Paperclip, Download } from "lucide-react";
import { backfillEmailLog } from "@/functions/backfillEmailLog";

export default function EmailLogViewer() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [isBackfilling, setIsBackfilling] = useState(false);

  const handleBackfill = async () => {
    if (!window.confirm("Pull the past 7 days of email activity from SendGrid into this log?")) return;
    setIsBackfilling(true);
    try {
      const resp = await backfillEmailLog({ days: 7 });
      const d = resp?.data || {};
      if (d.success) {
        alert(`Backfill complete.\nFetched: ${d.fetched}\nCreated: ${d.created}\nSkipped (already logged): ${d.skipped}`);
        await load();
      } else {
        alert(`Backfill failed: ${d.error || "Unknown error"}${d.hint ? `\n\n${d.hint}` : ""}`);
      }
    } catch (err) {
      alert(`Backfill failed: ${err.message}`);
    } finally {
      setIsBackfilling(false);
    }
  };

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await base44.entities.EmailLog.list("-created_date", 500);
      setLogs(data || []);
    } catch (err) {
      console.error("Failed to load email logs:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = logs.filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (l.to || "").toLowerCase().includes(q) ||
      (l.subject || "").toLowerCase().includes(q) ||
      (l.order_number || "").toLowerCase().includes(q) ||
      (l.context || "").toLowerCase().includes(q)
    );
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Email Log
          <Badge variant="outline" className="ml-2">{logs.length}</Badge>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleBackfill} disabled={isBackfilling}>
              {isBackfilling ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Download className="w-4 h-4 mr-1.5" />}
              {isBackfilling ? "Backfilling..." : "Backfill last 7 days"}
            </Button>
            <Button variant="ghost" size="sm" onClick={load} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by recipient, subject, order #, or context..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">No emails found.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((log) => {
              const isOpen = expandedId === log.id;
              return (
                <div
                  key={log.id}
                  className="border rounded-lg bg-white hover:bg-gray-50 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : log.id)}
                    className="w-full text-left p-3 flex items-center gap-3"
                  >
                    {log.status === "sent" ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 truncate">{log.subject || "(no subject)"}</span>
                        {log.has_attachments && <Paperclip className="w-3 h-3 text-gray-500" />}
                        {log.context && (
                          <Badge variant="outline" className="text-xs">{log.context}</Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        To: <span className="font-mono">{log.to}</span>
                        {log.order_number && <> · Order #{log.order_number}</>}
                        <> · {new Date(log.created_date).toLocaleString()}</>
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t px-3 py-3 text-xs space-y-2 bg-gray-50">
                      <div>
                        <span className="font-semibold text-gray-700">From:</span>{" "}
                        <span className="font-mono">{log.from_email || "—"}</span>
                      </div>
                      {log.attachment_names?.length > 0 && (
                        <div>
                          <span className="font-semibold text-gray-700">Attachments:</span>{" "}
                          {log.attachment_names.join(", ")}
                        </div>
                      )}
                      {log.status === "failed" && log.error_message && (
                        <div className="p-2 bg-red-50 border border-red-200 rounded text-red-800">
                          <span className="font-semibold">Error:</span> {log.error_message}
                        </div>
                      )}
                      {log.body_preview && (
                        <div>
                          <span className="font-semibold text-gray-700">Body preview:</span>
                          <pre className="mt-1 whitespace-pre-wrap font-sans text-gray-700 bg-white p-2 rounded border max-h-48 overflow-auto">
                            {log.body_preview}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}