import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Ban, ShieldCheck } from "lucide-react";

interface ClientRow {
  id: string;
  access_code: string;
  client_id: string | null;
  client_email: string | null;
  group_name: string | null;
  reseller_code: string | null;
  status: string | null;
}

export default function BanManagement() {
  const { codeUser, isAdmin } = useAuth();
  const [code, setCode] = useState("");
  const [client, setClient] = useState<ClientRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [performerName, setPerformerName] = useState("");

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
        throw new Error(payload?.error || "Search failed");
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

  const toggleBan = async () => {
    if (!codeUser || !client) return;
    const isBanned = client.status === "banned";
    if (isAdmin && !performerName.trim()) {
      toast({
        title: "Name required",
        description: "Please write your name before banning/unbanning.",
        variant: "destructive",
      });
      return;
    }
    setUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke("data-api", {
        body: {
          code: codeUser.accessCode,
          action: isBanned ? "unban-client" : "ban-client",
          data: {
            id: client.id,
            performer_name: isAdmin ? performerName.trim() : null,
          },
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Action failed");
      setClient({ ...client, status: data.status });
      if (isAdmin) setPerformerName("");
      toast({
        title: isBanned ? "User unbanned" : "User banned",
        description: isBanned
          ? "This user can sign in again."
          : "This user can no longer sign in. Nothing was deleted.",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Could not update ban status",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const isBanned = client?.status === "banned";

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-3xl mx-auto">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold">Ban Management</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Block or unblock a single user by access code. Nothing is deleted — only login is restricted.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Find client</CardTitle>
          <CardDescription>Enter the exact access code.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={findClient} className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Access code"
              value={code}
              onChange={e => setCode(e.target.value)}
              className="flex-1 font-mono uppercase"
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
              <div className="min-w-0">
                <CardTitle className="text-lg font-mono truncate">{client.access_code}</CardTitle>
                <CardDescription className="truncate">
                  {client.client_email || client.client_id || "No client info"}
                </CardDescription>
              </div>
              {isBanned ? (
                <Badge variant="outline" className="bg-red-600/20 text-red-600 dark:text-red-400 border-red-600/40 uppercase">
                  Banned
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30 uppercase">
                  Active
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Field label="Client ID" value={client.client_id} mono />
              <Field label="Group" value={client.group_name} />
              <Field label="Reseller" value={client.reseller_code} />
            </div>

            <div className="pt-3 border-t space-y-3">
              {isAdmin ? (
                <div>
                  <p className="text-sm font-medium mb-1">
                    Your name <span className="text-destructive">*</span>
                  </p>
                  <Input
                    placeholder="Type your name"
                    value={performerName}
                    onChange={e => setPerformerName(e.target.value)}
                    maxLength={80}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Required. Recorded in activity logs.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Your reseller name will be recorded automatically.
                </p>
              )}

              {isBanned ? (
                <Button
                  variant="outline"
                  disabled={updating}
                  onClick={toggleBan}
                  className="w-full border-green-500/40 text-green-600 hover:bg-green-500/10 hover:text-green-600"
                >
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  {updating ? "Working..." : "Unban user"}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled={updating}
                  onClick={toggleBan}
                  className="w-full border-red-600/40 text-red-600 hover:bg-red-600/10 hover:text-red-600"
                >
                  <Ban className="h-4 w-4 mr-2" />
                  {updating ? "Working..." : "Ban user (block login)"}
                </Button>
              )}
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
