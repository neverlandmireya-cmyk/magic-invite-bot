import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Search, Shield, AlertTriangle, Clock, CheckCircle2, RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
}

const flagConfig: Record<Flag, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  clean: {
    label: "Sin antecedentes",
    className: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30",
    icon: CheckCircle2,
  },
  pending: {
    label: "Pendiente",
    className: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
    icon: Clock,
  },
  fugitive: {
    label: "Prófugo",
    className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
    icon: AlertTriangle,
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
      if (!data?.success) throw new Error(data?.error || "Error al buscar");
      setRows(data.data || []);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo buscar clientes",
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
      if (!data?.success) throw new Error(data?.error || "Error al actualizar");
      setRows(prev => prev.map(r => (r.id === id ? { ...r, status_flag: flag } : r)));
      toast({ title: "Estado actualizado", description: flagConfig[flag].label });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo actualizar",
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
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <header className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-primary/10 text-primary">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Depuración de clientes</h1>
          <p className="text-muted-foreground text-sm">
            Busca clientes por código de acceso o ID y marca su estado.
          </p>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {(["clean", "pending", "fugitive"] as Flag[]).map(f => {
          const cfg = flagConfig[f];
          const Icon = cfg.icon;
          return (
            <Card
              key={f}
              className={`cursor-pointer transition-all ${filter === f ? "ring-2 ring-primary" : ""}`}
              onClick={() => setFilter(filter === f ? "all" : f)}
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
        <CardHeader>
          <CardTitle className="text-lg">Buscar</CardTitle>
          <CardDescription>Por código de acceso, ID de cliente o email.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Código, ID o email…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span className="ml-2">Buscar</span>
            </Button>
            {filter !== "all" && (
              <Button type="button" variant="outline" onClick={() => setFilter("all")}>
                Limpiar filtro
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="space-y-3">
        {loading && rows.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Cargando…
            </CardContent>
          </Card>
        )}
        {!loading && rows.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No se encontraron clientes.
            </CardContent>
          </Card>
        )}
        {rows.map(row => {
          const cfg = flagConfig[row.status_flag];
          const Icon = cfg.icon;
          return (
            <Card key={row.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="font-mono font-bold text-sm">{row.access_code}</code>
                      <Badge variant="outline" className={cfg.className}>
                        <Icon className="w-3 h-3 mr-1" />
                        {cfg.label}
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                      <p><span className="font-medium text-foreground">ID:</span> {row.client_id || "—"}</p>
                      {row.client_email && (
                        <p><span className="font-medium text-foreground">Email:</span> {row.client_email}</p>
                      )}
                      {row.group_name && (
                        <p><span className="font-medium text-foreground">Grupo:</span> {row.group_name}</p>
                      )}
                      {row.reseller_code && (
                        <p><span className="font-medium text-foreground">Reseller:</span> {row.reseller_code}</p>
                      )}
                    </div>
                  </div>
                  <Select
                    value={row.status_flag}
                    onValueChange={(v) => updateFlag(row.id, v as Flag)}
                    disabled={updatingId === row.id}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clean">🟢 Sin antecedentes</SelectItem>
                      <SelectItem value="pending">🟡 Pendiente</SelectItem>
                      <SelectItem value="fugitive">🔴 Prófugo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
