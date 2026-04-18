import { useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { ChevronDown, History, Loader2 } from "lucide-react";

type Flag = "clean" | "pending" | "fugitive";

interface ClientRow {
  id: string;
  access_code: string;
  client_id: string | null;
  client_email: string | null;
  group_name: string | null;
  status: string | null;
  status_flag: Flag;
  reseller_code: string | null;
  created_at: string;
  receipt_signed_url: string | null;
}

interface FlagHistoryEntry {
  id: string;
  action: string;
  performed_by: string;
  created_at: string;
  details: { flag?: string; performer_name?: string; performer_role?: string; note?: string } | null;
  performer_name?: string | null;
  performer_role?: string | null;
}

const flagLabel: Record<Flag, string> = {
  clean: "Clean",
  pending: "Pending",
  fugitive: "Fugitive",
};

const flagClass: Record<Flag, string> = {
  clean: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30",
  pending: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
  fugitive: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
};

export default function Depuracion() {
  const { codeUser } = useAuth();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // History per row
  const [historyMap, setHistoryMap] = useState<Record<string, FlagHistoryEntry[] | "loading">>({});

  const fetchClients = useCallback(async () => {
    if (!codeUser) return;
    setLoading(true);
    setSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke("data-api", {
        body: {
          code: codeUser.accessCode,
          action: "search-clients",
          data: { query: query.trim() },
        },
      });
      const payload = (data ?? (error as { context?: { error?: string } })?.context) as
        | { success?: boolean; data?: ClientRow[]; error?: string }
        | undefined;
      if (error && !payload?.error) throw error;
      if (!payload?.success) {
        throw new Error(
          payload?.error ||
            "Search failed. Make sure you are signed in as an admin or reseller.",
        );
      }
      setRows(payload.data || []);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Could not search clients",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [codeUser, query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchClients();
  };

  const loadHistory = useCallback(
    async (rowId: string, force = false) => {
      if (!codeUser) return;
      if (!force && historyMap[rowId] && historyMap[rowId] !== "loading") return;
      setHistoryMap(prev => ({ ...prev, [rowId]: "loading" }));
      try {
        const { data, error } = await supabase.functions.invoke("data-api", {
          body: {
            code: codeUser.accessCode,
            action: "get-client-flag-history",
            data: { id: rowId },
          },
        });
        const payload = (data ?? (error as { context?: { error?: string } })?.context) as
          | { success?: boolean; data?: FlagHistoryEntry[]; error?: string }
          | undefined;
        if (!payload?.success) throw new Error(payload?.error || "Failed to load history");
        setHistoryMap(prev => ({ ...prev, [rowId]: payload.data || [] }));
      } catch (err) {
        setHistoryMap(prev => {
          const next = { ...prev };
          delete next[rowId];
          return next;
        });
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "Could not load history",
          variant: "destructive",
        });
      }
    },
    [codeUser, historyMap],
  );



  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold">Client Lookup</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Search clients by access code, ID, or email. Tap a result to view photo and flag history.
        </p>
      </header>

      {/* Search */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Search</CardTitle>
          <CardDescription>Enter an access code, client ID, or email.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Code, ID or email"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="space-y-4">
        {!loading && searched && rows.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">No clients found.</CardContent>
          </Card>
        )}
        {rows.map(row => {
          const date = new Date(row.created_at).toLocaleString();
          const history = historyMap[row.id];
          return (
            <Card key={row.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-4">
                {/* Header */}
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="font-mono font-bold text-base">{row.access_code}</code>
                  <Badge variant="outline" className={flagClass[row.status_flag]}>
                    {flagLabel[row.status_flag]}
                  </Badge>
                  {row.reseller_code && (
                    <Badge variant="outline" className="text-xs">
                      Reseller: {row.reseller_code}
                    </Badge>
                  )}
                </div>

                {/* Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <InfoRow label="Client ID" value={row.client_id} mono />
                  <InfoRow label="Email" value={row.client_email} />
                  <InfoRow label="Group" value={row.group_name} />
                  <InfoRow label="Created" value={date} />
                </div>

                {/* Receipt photo */}
                {row.receipt_signed_url ? (
                  <div className="rounded-md overflow-hidden border bg-muted/30">
                    <a
                      href={row.receipt_signed_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                      aria-label="Open receipt in new tab"
                    >
                      <img
                        src={row.receipt_signed_url}
                        alt={`Receipt for ${row.access_code}`}
                        className="w-full h-auto max-h-[480px] object-contain bg-background"
                        loading="lazy"
                      />
                    </a>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                    No receipt photo
                  </div>
                )}

                {/* Expandable history + clear action */}
                <Collapsible
                  onOpenChange={open => {
                    if (open) loadHistory(row.id);
                  }}
                >
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between group">
                      <span className="flex items-center gap-2 text-sm">
                        <History className="h-4 w-4" />
                        Flag history
                      </span>
                      <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3">
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">FLAG CHANGES</p>
                      {history === "loading" && (
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                        </p>
                      )}
                      {history && history !== "loading" && history.length === 0 && (
                        <p className="text-xs text-muted-foreground">No flag changes recorded.</p>
                      )}
                      {history && history !== "loading" && history.length > 0 && (
                        <ul className="space-y-2">
                          {history.map(h => {
                            const flag = (h.details?.flag as Flag) || "clean";
                            const name = h.performer_name || h.details?.performer_name;
                            const role = h.performer_role || h.details?.performer_role;
                            const noteText = h.details?.note;
                            return (
                              <li key={h.id} className="flex flex-col gap-1 text-xs border-b border-border/40 last:border-0 pb-2 last:pb-0">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                                    <Badge variant="outline" className={flagClass[flag]}>
                                      {flagLabel[flag]}
                                    </Badge>
                                    <span className="text-muted-foreground">
                                      by{" "}
                                      <span className="font-medium text-foreground">
                                        {name || "Unknown"}
                                      </span>
                                      {role && (
                                        <span className="ml-1 text-[10px] uppercase opacity-60">· {role}</span>
                                      )}
                                    </span>
                                  </div>
                                  <span className="text-muted-foreground shrink-0">
                                    {new Date(h.created_at).toLocaleString()}
                                  </span>
                                </div>
                                {noteText && (
                                  <p className="text-[11px] text-muted-foreground italic pl-2 border-l-2 border-border ml-1">
                                    “{noteText}”
                                  </p>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`truncate ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}
