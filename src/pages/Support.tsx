import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Loader2, MessageSquare, Send, ArrowLeft, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { z } from 'zod';

// Input validation schemas
const ticketSchema = z.object({
  subject: z.string().trim().min(3, 'Subject must be at least 3 characters').max(200, 'Subject must be less than 200 characters'),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(5000, 'Message must be less than 5000 characters'),
});

const replySchema = z.object({
  message: z.string().trim().min(1, 'Reply cannot be empty').max(5000, 'Reply must be less than 5000 characters'),
});

interface Ticket {
  id: string;
  access_code: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  reseller_code?: string | null;
}

interface TicketReply {
  id: string;
  ticket_id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

export default function Support() {
  const { isAdmin, isReseller, codeUser } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);

  // New ticket form
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [formErrors, setFormErrors] = useState<{ subject?: string; message?: string }>({});
  
  // Reply form
  const [replyMessage, setReplyMessage] = useState('');
  const [replyError, setReplyError] = useState<string | null>(null);
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    if (codeUser) {
      loadTickets();
    }
  }, [codeUser, isAdmin]);

  async function loadTickets() {
    if (!codeUser?.accessCode) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('data-api', {
        body: { code: codeUser.accessCode, action: 'get-tickets' }
      });

      if (error) throw error;

      if (data?.success) {
        setTickets(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load tickets:', error);
      toast.error('Failed to load tickets');
    }
    
    setLoading(false);
  }

  async function loadReplies(ticketId: string) {
    if (!codeUser?.accessCode) return;

    setLoadingReplies(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('data-api', {
        body: { 
          code: codeUser.accessCode, 
          action: 'get-ticket-replies',
          data: { ticketId }
        }
      });

      if (error) throw error;

      if (data?.success) {
        setReplies(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load replies:', error);
    }
    
    setLoadingReplies(false);
  }

  async function createTicket() {
    const result = ticketSchema.safeParse({ subject, message });
    
    if (!result.success) {
      const errors: { subject?: string; message?: string } = {};
      result.error.errors.forEach(err => {
        if (err.path[0] === 'subject') errors.subject = err.message;
        if (err.path[0] === 'message') errors.message = err.message;
      });
      setFormErrors(errors);
      return;
    }
    
    setFormErrors({});

    if (!codeUser) {
      toast.error('You must be logged in');
      return;
    }

    setCreating(true);

    try {
      const { error } = await supabase.functions.invoke('data-api', {
        body: { 
          code: codeUser.accessCode, 
          action: 'insert-ticket',
          data: {
            subject: result.data.subject,
            message: result.data.message,
            status: 'open',
            priority: 'normal',
          }
        }
      });

      if (error) throw error;

      toast.success('Ticket created successfully');
      setShowNewTicket(false);
      setSubject('');
      setMessage('');
      loadTickets();
    } catch (error) {
      console.error('Failed to create ticket:', error);
      toast.error('Failed to create ticket');
    }

    setCreating(false);
  }

  async function sendReply() {
    const result = replySchema.safeParse({ message: replyMessage });
    
    if (!result.success) {
      setReplyError(result.error.errors[0].message);
      return;
    }
    
    setReplyError(null);
    
    if (!selectedTicket || !codeUser?.accessCode) return;

    setSendingReply(true);

    try {
      const { error } = await supabase.functions.invoke('data-api', {
        body: { 
          code: codeUser.accessCode, 
          action: 'insert-ticket-reply',
          data: {
            ticketId: selectedTicket.id,
            message: result.data.message,
          }
        }
      });

      if (error) throw error;

      setReplyMessage('');
      loadReplies(selectedTicket.id);
    } catch (error) {
      console.error('Failed to send reply:', error);
      toast.error('Failed to send reply');
    }

    setSendingReply(false);
  }

  async function updateTicketStatus(ticketId: string, status: string) {
    if (!codeUser?.accessCode) return;

    try {
      const { error } = await supabase.functions.invoke('data-api', {
        body: { 
          code: codeUser.accessCode, 
          action: 'update-ticket',
          data: { id: ticketId, updates: { status } }
        }
      });

      if (error) throw error;

      toast.success('Status updated');
      loadTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status });
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  }

  function openTicket(ticket: Ticket) {
    setSelectedTicket(ticket);
    loadReplies(ticket.id);
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'open':
        return <Badge variant="outline" className="border-success text-success">Open</Badge>;
      case 'pending':
        return <Badge variant="outline" className="border-warning text-warning">Pending</Badge>;
      case 'closed':
        return <Badge variant="outline" className="border-muted-foreground text-muted-foreground">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function getPriorityBadge(priority: string) {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'normal':
        return <Badge variant="secondary">Normal</Badge>;
      case 'low':
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Ticket detail view
  if (selectedTicket) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedTicket(null)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{selectedTicket.subject}</h1>
            <p className="text-sm text-muted-foreground">
              Created {format(new Date(selectedTicket.created_at), 'MMM d, yyyy HH:mm')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(selectedTicket.status)}
            {isAdmin && (
              <Select value={selectedTicket.status} onValueChange={(v) => updateTicketStatus(selectedTicket.id, v)}>
                <SelectTrigger className="w-32 bg-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <span className="text-sm text-muted-foreground">User Code: </span>
            <code className="font-mono font-bold text-foreground">{selectedTicket.access_code}</code>
          </div>
        )}

        <Card className="glass">
          <CardContent className="pt-6">
            <p className="text-foreground whitespace-pre-wrap">{selectedTicket.message}</p>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {loadingReplies ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            replies.map((reply) => (
              <div
                key={reply.id}
                className={`p-4 rounded-lg ${
                  reply.is_admin 
                    ? 'bg-primary/10 border border-primary/20 ml-8' 
                    : 'bg-muted/30 border border-border mr-8'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-foreground">
                    {reply.is_admin ? 'Support' : 'You'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(reply.created_at), 'MMM d, HH:mm')}
                  </span>
                </div>
                <p className="text-foreground whitespace-pre-wrap">{reply.message}</p>
              </div>
            ))
          )}
        </div>

        {selectedTicket.status !== 'closed' && (
          <Card className="glass">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <div className="flex-1">
                  <Textarea
                    placeholder="Type your reply..."
                    value={replyMessage}
                    onChange={(e) => {
                      setReplyMessage(e.target.value);
                      setReplyError(null);
                    }}
                    className={`bg-input min-h-[80px] ${replyError ? 'border-destructive' : ''}`}
                    maxLength={5000}
                  />
                  {replyError && (
                    <p className="text-sm text-destructive mt-1">{replyError}</p>
                  )}
                </div>
                <Button 
                  onClick={sendReply} 
                  disabled={sendingReply || !replyMessage.trim()}
                  className="glow-sm"
                >
                  {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* OG Reseller Header */}
      {isReseller && (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-orange-500/20 border border-amber-500/30 p-6">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-400/10 via-transparent to-transparent"></div>
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <span className="text-2xl font-black text-black">OG</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-amber-400 tracking-wide">OG RESELLER SUPPORT</h2>
              <p className="text-amber-200/70 text-sm">Priority assistance for verified resellers</p>
            </div>
          </div>
          <div className="absolute top-2 right-4 text-amber-500/20 text-6xl font-black select-none">VIP</div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${isReseller ? 'text-amber-400' : 'text-foreground'}`}>
            {isReseller ? 'OG Support' : 'Ticket'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? 'Manage tickets' : isReseller ? 'Exclusive reseller support channel' : 'Get help with your access'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={loadTickets}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          {!isAdmin && (
            <Button 
              onClick={() => setShowNewTicket(true)} 
              className={isReseller ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-semibold shadow-lg shadow-amber-500/30' : 'glow-sm'}
            >
              <Plus className="w-4 h-4 mr-2" />
              {isReseller ? 'Open VIP Ticket' : 'New Ticket'}
            </Button>
          )}
        </div>
      </div>

      <Dialog open={showNewTicket} onOpenChange={(open) => {
        setShowNewTicket(open);
        if (!open) {
          setFormErrors({});
        }
      }}>
        <DialogContent className={isReseller ? 'border-amber-500/30 bg-gradient-to-br from-background via-background to-amber-900/10' : 'glass'}>
          <DialogHeader>
            <DialogTitle className={isReseller ? 'text-amber-400' : ''}>
              {isReseller ? 'Open VIP Ticket' : 'Create New Ticket'}
            </DialogTitle>
            <DialogDescription>
              {isReseller ? 'Priority support for OG resellers' : 'Describe your issue and we will help you'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Input
                placeholder="Subject"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  if (formErrors.subject) setFormErrors(prev => ({ ...prev, subject: undefined }));
                }}
                className={`bg-input ${formErrors.subject ? 'border-destructive' : ''}`}
                maxLength={200}
              />
              {formErrors.subject && (
                <p className="text-sm text-destructive mt-1">{formErrors.subject}</p>
              )}
            </div>
            <div>
              <Textarea
                placeholder="Describe your issue..."
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (formErrors.message) setFormErrors(prev => ({ ...prev, message: undefined }));
                }}
                className={`bg-input min-h-[150px] ${formErrors.message ? 'border-destructive' : ''}`}
                maxLength={5000}
              />
              {formErrors.message && (
                <p className="text-sm text-destructive mt-1">{formErrors.message}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={createTicket} 
                disabled={creating} 
                className={isReseller ? 'flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-semibold' : 'flex-1 glow-sm'}
              >
                {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                {isReseller ? 'Submit VIP Ticket' : 'Create Ticket'}
              </Button>
              <Button variant="outline" onClick={() => setShowNewTicket(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card className={isReseller ? 'border-amber-500/20 bg-gradient-to-br from-background via-background to-amber-900/5' : 'glass'}>
        <CardHeader>
          <CardTitle className={isReseller ? 'text-amber-400' : ''}>
            {isAdmin ? 'All Tickets' : isReseller ? 'VIP Tickets' : 'Your Tickets'}
          </CardTitle>
          <CardDescription>
            {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} {isReseller && '• Priority Queue'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className={`w-12 h-12 mx-auto mb-3 ${isReseller ? 'text-amber-500/50' : 'text-muted-foreground'}`} />
              <p className="text-muted-foreground">
                {isAdmin ? 'No support tickets yet' : isReseller ? 'No VIP tickets yet. Open one for priority support!' : 'No tickets yet. Create one if you need help!'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => openTicket(ticket)}
                  className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-colors ${
                    isReseller 
                      ? 'bg-amber-500/5 border border-amber-500/20 hover:bg-amber-500/10 hover:border-amber-500/30' 
                      : 'bg-muted/30 border border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-medium text-foreground truncate">
                        {ticket.subject}
                      </span>
                      {isAdmin && ticket.reseller_code && (
                        <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold border-0">
                          Reseller
                        </Badge>
                      )}
                      {getStatusBadge(ticket.status)}
                      {getPriorityBadge(ticket.priority)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {isAdmin && (
                        <span className="font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">
                          {ticket.access_code}
                        </span>
                      )}
                      <span>{format(new Date(ticket.created_at), 'MMM d, yyyy HH:mm')}</span>
                    </div>
                  </div>
                  <MessageSquare className="w-5 h-5 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
