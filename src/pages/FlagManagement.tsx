import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

type Flag = "clean" | "pending" | "fugitive";

interface ClientRow {
  id: string;
  access_code: string;
  client_id: string | null;
  client_email: string | null;
  group_name: string | null;
  status_flag: Flag;
  reseller_code: string | null;
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

export default function FlagManagement() {
  const { codeUser } = useAuth();
  const [code, setCode] = useState("");
  const [client, setClient] = useState<ClientRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  const findClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeUser || !code.trim()) return;
    setLoading(true);
    setClient(null);
    try {
      const { data, error } = await supabase.functions.invoke("data-api", {
        body: {
          code: codeUser.accessCode,
          action: "search-clients",
          data: { query: code.trim() },
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
      const rows: ClientRow[] = payload.data || [];
      const match =
        rows.find(r => r.access_code?.toLowerCase() === code.trim().toLowerCase()) || rows[0];
      if (!match) {
        toast({ title: "Not found", description: "No client matches that code.", variant: "destructive" });
        return;
      }
      setClient(match);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Could not find client",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setFlag = async (flag: Flag) => {
    if (!codeUser || !client) return;
    setUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke("data-api", {
        body: {
          code: codeUser.accessCode,
          action: "update-client-flag",
          data: { id: client.id, flag },
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Update failed");
      setClient({ ...client, status_flag: flag });
      toast({ title: "Status updated", description: `Marked as ${flagLabel[flag]}` });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Could not update status",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-3xl mx-auto">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold">Flag Management</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Find a client by access code and individually set their status.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Find Client</CardTitle>
          <CardDescription>Enter the exact access code to load the client.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={findClient} className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Access code"
              value={code}
              onChange={e => setCode(e.target.value)}
              className="flex-1 font-mono"
            />
            <Button type="submit" disabled={loading || !code.trim()}>
              {loading ? "Loading..." : "Find"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {client && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-lg font-mono">{client.access_code}</CardTitle>
                <CardDescription>{client.client_email || client.client_id || "No client info"}</CardDescription>
              </div>
              <Badge variant="outline" className={flagClass[client.status_flag]}>
                {flagLabel[client.status_flag]}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Field label="Client ID" value={client.client_id} mono />
              <Field label="Group" value={client.group_name} />
              <Field label="Reseller" value={client.reseller_code} />
            </div>

            <div className="pt-3 border-t space-y-2">
              <p className="text-sm font-medium">Set status individually</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  disabled={updating || client.status_flag === "clean"}
                  onClick={() => setFlag("clean")}
                  className="border-green-500/30 hover:bg-green-500/10 hover:text-green-600"
                >
                  Mark Clean
                </Button>
                <Button
                  variant="outline"
                  disabled={updating || client.status_flag === "pending"}
                  onClick={() => setFlag("pending")}
                  className="border-yellow-500/30 hover:bg-yellow-500/10 hover:text-yellow-600"
                >
                  Mark Pending
                </Button>
                <Button
                  variant="outline"
                  disabled={updating || client.status_flag === "fugitive"}
                  onClick={() => setFlag("fugitive")}
                  className="border-red-500/30 hover:bg-red-500/10 hover:text-red-600"
                >
                  Mark Fugitive
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`truncate ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}
