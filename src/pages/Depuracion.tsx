import { useState, useCallback } from "react";
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
  status: string | null;
  status_flag: Flag;
  reseller_code: string | null;
  created_at: string;
  receipt_signed_url: string | null;
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
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Search failed");
      setRows(data.data || []);
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

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold">Client Lookup</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Search clients by access code, ID, or email and view their information.
        </p>
      </header>

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

      <div className="space-y-4">
        {!loading && searched && rows.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">No clients found.</CardContent>
          </Card>
        )}
        {rows.map(row => {
          const date = new Date(row.created_at).toLocaleDateString();
          return (
            <Card key={row.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row">
                  <div className="md:w-48 w-full aspect-square md:aspect-auto bg-muted flex items-center justify-center shrink-0">
                    {row.receipt_signed_url ? (
                      <a
                        href={row.receipt_signed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full h-full"
                      >
                        <img
                          src={row.receipt_signed_url}
                          alt="Payment receipt"
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">No photo</span>
                    )}
                  </div>

                  <div className="flex-1 p-4 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="font-mono font-bold text-base">{row.access_code}</code>
                      <Badge variant="outline" className={flagClass[row.status_flag]}>
                        {flagLabel[row.status_flag]}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <InfoRow label="Client ID" value={row.client_id} mono />
                      <InfoRow label="Email" value={row.client_email} />
                      <InfoRow label="Group" value={row.group_name} />
                      <InfoRow label="Reseller" value={row.reseller_code} />
                      <InfoRow label="Created" value={date} />
                    </div>
                  </div>
                </div>
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
