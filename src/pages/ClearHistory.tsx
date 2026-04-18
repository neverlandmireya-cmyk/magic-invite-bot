import { useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Eraser, Loader2, History } from "lucide-react";

type Flag = "clean" | "pending" | "fugitive";

interface ClientRow {
  id: string;
  access_code: string;
  client_id: string | null;
  client_email: string | null;
  group_name: string | null;
  status_flag: Flag;
  reseller_code: string | null;
  created_at: string;
}

interface FlagHistoryEntry {
  id: string;
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

export default function ClearHistory() {
  const { codeUser } = useAuth();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [row, setRow] = useState<ClientRow | null>(null);
  const [history, setHistory] = useState<FlagHistoryEntry[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetFlag, setResetFlag] = useState(true);
  const [clearing, setClearing] = useState(false);

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!codeUser || !query.trim()) return;
      setLoading(true);
      setSearched(true);
      setRow(null);
      setHistory([]);
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
        if (!payload?.success) throw new Error(payload?.error || "Search failed");
        const rows = payload.data || [];
        // Pick exact code match if present, else first
        const exact =
          rows.find(r => r.access_code.toLowerCase() === query.trim().toLowerCase()) ||
          rows[0] ||
          null;
        setRow(exact);
        if (exact) {
          // Load history
          const { data: hData, error: hErr } = await supabase.functions.invoke("data-api", {
            body: {
              code: codeUser.accessCode,
              action: "get-client-flag-history",
              data: { id: exact.id },
            },
          });
          const hPayload = (hData ?? (hErr as { context?: { error?: string } })?.context) as
            | { success?: boolean; data?: FlagHistoryEntry[]; error?: string }
            | undefined;
          if (hPayload?.success) setHistory(hPayload.data || []);
        }
      } catch (err) {
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "Could not search",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [codeUser, query],
  );

  const handleClear = useCallback(async () => {
    if (!codeUser || !row) return;
    setClearing(true);
    try {
      const { data, error } = await supabase.functions.invoke("data-api", {
        body: {
          code: codeUser.accessCode,
          action: "clear-client-flag-history",
          data: { id: row.id, resetFlag },
        },
      });
      const payload = (data ?? (error as { context?: { error?: string } })?.context) as
        | { success?: boolean; resetFlag?: boolean; error?: string }
        | undefined;
      if (!payload?.success) throw new Error(payload?.error || "Failed to clear history");
      toast({
        title: "History cleared",
        description: `Antecedentes wiped for ${row.access_code}${
          payload.resetFlag ? " and flag reset to Clean." : "."
        }`,
      });
      setHistory([]);
      if (payload.resetFlag) setRow({ ...row, status_flag: "clean" });
      setConfirmOpen(false);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Could not clear history",
        variant: "destructive",
      });
    } finally {
      setClearing(false);
    }
  }, [codeUser, row, resetFlag]);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-3xl mx-auto">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold">Clear Flag History</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Wipe a client's antecedentes individually by access code.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Find client</CardTitle>
          <CardDescription>Enter access code, ID or email (e.g. KTOKCOE).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Access code"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="flex-1 font-mono uppercase"
            />
            <Button type="submit" disabled={loading || !query.trim()}>
              {loading ? "Searching..." : "Search"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {searched && !loading && !row && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No client found.
          </CardContent>
        </Card>
      )}

      {row && (
        <Card>
          <CardContent className="p-4 space-y-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <InfoRow label="Client ID" value={row.client_id} mono />
              <InfoRow label="Email" value={row.client_email} />
              <InfoRow label="Group" value={row.group_name} />
              <InfoRow label="Created" value={new Date(row.created_at).toLocaleString()} />
            </div>

            <div className="rounded-md border bg-muted/20 p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                <History className="h-3 w-3" /> ANTECEDENTES ({history.length})
              </p>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">No flag changes recorded.</p>
              ) : (
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

            <Button
              variant="outline"
              className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                setResetFlag(true);
                setConfirmOpen(true);
              }}
              disabled={history.length === 0 && row.status_flag === "clean"}
            >
              <Eraser className="h-4 w-4 mr-2" />
              Clear flag history
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear antecedentes for {row?.access_code}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes all recorded flag changes for this client. Cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex items-start gap-2 rounded-md border p-3 bg-muted/30">
            <Checkbox
              id="reset-flag"
              checked={resetFlag}
              onCheckedChange={v => setResetFlag(v === true)}
            />
            <label htmlFor="reset-flag" className="text-sm leading-tight cursor-pointer">
              Also reset current flag to <strong>Clean</strong>
              <span className="block text-xs text-muted-foreground mt-0.5">
                Currently: {row ? flagLabel[row.status_flag] : ""}
              </span>
            </label>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={clearing}
              onClick={handleClear}
            >
              {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Clear history"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
