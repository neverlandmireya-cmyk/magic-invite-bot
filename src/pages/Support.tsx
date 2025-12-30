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

interface Ticket {
  id: string;
  access_code: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

interface TicketReply {
  id: string;
  ticket_id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

export default function Support() {
  const { isAdmin, codeUser } = useAuth();
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
  
  // Reply form
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    loadTickets();
  }, [codeUser, isAdmin]);

  async function loadTickets() {
    setLoading(true);
    
    let query = supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false });
    
    // If user, only show their tickets
    if (codeUser && !isAdmin) {
      query = query.eq('access_code', codeUser.accessCode);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error loading tickets:', error);
      toast.error('Failed to load tickets');
    } else {
      setTickets(data || []);
    }
    
    setLoading(false);
  }

  async function loadReplies(ticketId: string) {
    setLoadingReplies(true);
    
    const { data, error } = await supabase
      .from('ticket_replies')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error loading replies:', error);
    } else {
      setReplies(data || []);
    }
    
    setLoadingReplies(false);
  }

  async function createTicket() {
    if (!subject.trim() || !message.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!codeUser) {
      toast.error('You must be logged in');
      return;
    }

    setCreating(true);

    const { error } = await supabase
      .from('tickets')
      .insert({
        access_code: codeUser.accessCode,
        subject: subject.trim(),
        message: message.trim(),
        status: 'open',
        priority: 'normal',
      });

    if (error) {
      console.error('Error creating ticket:', error);
      toast.error('Failed to create ticket');
    } else {
      toast.success('Ticket created successfully');
      setShowNewTicket(false);
      setSubject('');
      setMessage('');
      loadTickets();
    }

    setCreating(false);
  }

  async function sendReply() {
    if (!replyMessage.trim() || !selectedTicket) return;

    setSendingReply(true);

    const { error } = await supabase
      .from('ticket_replies')
      .insert({
        ticket_id: selectedTicket.id,
        message: replyMessage.trim(),
        is_admin: isAdmin,
      });

    if (error) {
      console.error('Error sending reply:', error);
      toast.error('Failed to send reply');
    } else {
      setReplyMessage('');
      loadReplies(selectedTicket.id);
      
      // Update ticket updated_at
      await supabase
        .from('tickets')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedTicket.id);
    }

    setSendingReply(false);
  }

  async function updateTicketStatus(ticketId: string, status: string) {
    const { error } = await supabase
      .from('tickets')
      .update({ status })
      .eq('id', ticketId);

    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success('Status updated');
      loadTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status });
      }
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

        {/* Original message */}
        <Card className="glass">
          <CardContent className="pt-6">
            <p className="text-foreground whitespace-pre-wrap">{selectedTicket.message}</p>
          </CardContent>
        </Card>

        {/* Replies */}
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

        {/* Reply form */}
        {selectedTicket.status !== 'closed' && (
          <Card className="glass">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Textarea
                  placeholder="Type your reply..."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  className="flex-1 bg-input min-h-[80px]"
                />
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Support</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? 'Manage support tickets' : 'Get help with your access'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={loadTickets}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          {!isAdmin && (
            <Button onClick={() => setShowNewTicket(true)} className="glow-sm">
              <Plus className="w-4 h-4 mr-2" />
              New Ticket
            </Button>
          )}
        </div>
      </div>

      {/* New Ticket Dialog */}
      <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Create New Ticket</DialogTitle>
            <DialogDescription>Describe your issue and we will help you</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Input
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="bg-input"
              />
            </div>
            <div>
              <Textarea
                placeholder="Describe your issue..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="bg-input min-h-[150px]"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={createTicket} disabled={creating} className="flex-1 glow-sm">
                {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Create Ticket
              </Button>
              <Button variant="outline" onClick={() => setShowNewTicket(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tickets List */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>
            {isAdmin ? 'All Tickets' : 'Your Tickets'}
          </CardTitle>
          <CardDescription>
            {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {isAdmin ? 'No support tickets yet' : 'No tickets yet. Create one if you need help!'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => openTicket(ticket)}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-medium text-foreground truncate">
                        {ticket.subject}
                      </span>
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