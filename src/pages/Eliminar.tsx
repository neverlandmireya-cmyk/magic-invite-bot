import { useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Trash2, Loader2, AlertTriangle } from "lucide-react";

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

export default function Eliminar() {
  const { codeUser } = useAuth();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<ClientRow | null>(null);

  const search = useCallback(async () => {
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
      if (!payload?.success) {
        throw new Error(payload?.error || "Search failed");
      }
      setRows(payload.data || []);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Search failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [codeUser, query]);

  const handleDelete = useCallback(
    async (row: ClientRow) => {
      if (!codeUser) return;
      setDeleting(true);
      try {
        const { data, error } = await supabase.functions.invoke("data-api", {
          body: {
            code: codeUser.accessCode,
            action: "delete-client-by-code",
            data: { targetCode: row.access_code },
          },
        });
        const payload = (data ?? (error as { context?: { error?: string } })?.context) as
          | { success?: boolean; deleted?: { access_code: string }; error?: string }
          | undefined;
        if (!payload?.success) throw new Error(payload?.error || "Delete failed");
        toast({
          title: "Deleted",
          description: `${row.access_code} permanently removed.`,
        });
        setRows(prev => prev.filter(r => r.id !== row.id));
        setConfirmTarget(null);
      } catch (err) {
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "Delete failed",
          variant: "destructive",
        });
      } finally {
        setDeleting(false);
      }
    },
    [codeUser],
  );

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Trash2 className="h-6 w-6 text-destructive" />
          Delete Clients
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Search and permanently remove clients one by one. Revokes their Telegram link and removes related revenue.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Search</CardTitle>
          <CardDescription>Enter access code (e.g. <code className="font-mono">KTOKCOE</code>), client ID or email.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={e => {
              e.preventDefault();
              search();
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
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

      <div className="space-y-3">
        {!loading && searched && rows.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">No clients found.</CardContent>
          </Card>
        )}

        {rows.map(row => (
          <Card key={row.id} className="overflow-hidden">
            <CardContent className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="font-mono font-bold">{row.access_code}</code>
                  <Badge variant="outline" className={flagClass[row.status_flag]}>
                    {flagLabel[row.status_flag]}
                  </Badge>
                  {row.reseller_code && (
                    <Badge variant="outline" className="text-xs">
                      {row.reseller_code}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {row.client_email && <div className="truncate">{row.client_email}</div>}
                  {row.client_id && <div className="font-mono truncate">{row.client_id}</div>}
                  {row.group_name && <div>{row.group_name}</div>}
                  <div>{new Date(row.created_at).toLocaleString()}</div>
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmTarget(row)}
                className="shrink-0 w-full sm:w-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog
        open={!!confirmTarget}
        onOpenChange={o => !o && setConfirmTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete {confirmTarget?.access_code}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the client, revokes their Telegram invite link, and deletes related revenue. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={() => confirmTarget && handleDelete(confirmTarget)}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
