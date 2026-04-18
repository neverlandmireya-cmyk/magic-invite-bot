import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Search,
  Shield,
  AlertTriangle,
  Clock,
  CheckCircle2,
  RefreshCw,
  ImageOff,
  Mail,
  Hash,
  Users as UsersIcon,
  Calendar,
  User,
} from "lucide-react";

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

const flagConfig: Record<Flag, { label: string; className: string; icon: typeof CheckCircle2; dot: string }> = {
  clean: {
    label: "Clean",
    className: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30",
    icon: CheckCircle2,
    dot: "bg-green-500",
  },
  pending: {
    label: "Pending",
    className: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
    icon: Clock,
    dot: "bg-yellow-500",
  },
  fugitive: {
    label: "Fugitive",
    className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
    icon: AlertTriangle,
    dot: "bg-red-500",
  },
};

export default function Depuracion() {
  const { codeUser } = useAuth();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Flag>("all");
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    if (!codeUser) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("data-api", {
        body: {
          code: codeUser.accessCode,
          action: "search-clients",
          data: {
            query: query.trim(),
            flag: filter === "all" ? undefined : filter,
          },
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
  }, [codeUser, query, filter]);

  useEffect(() => {
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchClients();
  };

  const updateFlag = async (id: string, flag: Flag) => {
    if (!codeUser) return;
    setUpdatingId(id);
    try {
      const { data, error } = await supabase.functions.invoke("data-api", {
        body: {
          code: codeUser.accessCode,
          action: "update-client-flag",
          data: { id, flag },
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Update failed");
      setRows(prev => prev.map(r => (r.id === id ? { ...r, status_flag: flag } : r)));
      toast({ title: "Status updated", description: `Marked as ${flagConfig[flag].label}` });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Could not update status",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const counts = {
    clean: rows.filter(r => r.status_flag === "clean").length,
    pending: rows.filter(r => r.status_flag === "pending").length,
    fugitive: rows.filter(r => r.status_flag === "fugitive").length,
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <header className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-primary/10 text-primary">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Client Tracking</h1>
          <p className="text-muted-foreground text-sm">
            Search clients by access code or ID and flag their status individually.
          </p>
        </div>
      </header>

      {/* Stats / Quick filters */}
      <div className="grid grid-cols-3 gap-3">
        {(["clean", "pending", "fugitive"] as Flag[]).map(f => {
          const cfg = flagConfig[f];
          const Icon = cfg.icon;
          const active = filter === f;
          return (
            <Card
              key={f}
              className={`cursor-pointer transition-all hover:shadow-md ${active ? "ring-2 ring-primary" : ""}`}
              onClick={() => setFilter(active ? "all" : f)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${cfg.className}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{cfg.label}</p>
                  <p className="text-xl font-bold">{counts[f]}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Search</CardTitle>
          <CardDescription>By access code, client ID, or email.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Code, ID or email…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span className="ml-2">Search</span>
            </Button>
            {filter !== "all" && (
              <Button type="button" variant="outline" onClick={() => setFilter("all")}>
                Clear filter
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="space-y-4">
        {loading && rows.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">Loading…</CardContent>
          </Card>
        )}
        {!loading && rows.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">No clients found.</CardContent>
          </Card>
        )}
        {rows.map(row => {
          const cfg = flagConfig[row.status_flag];
          const Icon = cfg.icon;
          const date = new Date(row.created_at).toLocaleDateString();
          return (
            <Card key={row.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row">
                  {/* Photo */}
                  <div className="md:w-48 w-full aspect-square md:aspect-auto bg-muted flex items-center justify-center shrink-0 relative">
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
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <ImageOff className="w-8 h-8" />
                        <span className="text-xs">No photo</span>
                      </div>
                    )}
                    {/* Status dot overlay */}
                    <div className={`absolute top-2 left-2 w-3 h-3 rounded-full ring-2 ring-background ${cfg.dot}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="font-mono font-bold text-base">{row.access_code}</code>
                        <Badge variant="outline" className={cfg.className}>
                          <Icon className="w-3 h-3 mr-1" />
                          {cfg.label}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <InfoRow icon={Hash} label="Client ID" value={row.client_id} mono />
                      <InfoRow icon={Mail} label="Email" value={row.client_email} />
                      <InfoRow icon={UsersIcon} label="Group" value={row.group_name} />
                      <InfoRow icon={User} label="Reseller" value={row.reseller_code} />
                      <InfoRow icon={Calendar} label="Created" value={date} />
                    </div>

                    {/* Individual flag buttons */}
                    <div className="pt-2 border-t flex flex-wrap gap-2">
                      <span className="text-xs text-muted-foreground self-center mr-1">Set status:</span>
                      {(["clean", "pending", "fugitive"] as Flag[]).map(f => {
                        const fc = flagConfig[f];
                        const isActive = row.status_flag === f;
                        const FIcon = fc.icon;
                        return (
                          <Button
                            key={f}
                            size="sm"
                            variant={isActive ? "default" : "outline"}
                            disabled={updatingId === row.id || isActive}
                            onClick={() => updateFlag(row.id, f)}
                            className={isActive ? "" : ""}
                          >
                            <FIcon className="w-3.5 h-3.5 mr-1.5" />
                            {fc.label}
                          </Button>
                        );
                      })}
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

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`truncate ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
      </div>
    </div>
  );
}
