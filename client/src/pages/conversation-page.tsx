import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Send, MessageCircle, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Link, useParams, useLocation } from "wouter";

interface User {
  id: number;
  username: string;
  email: string;
}

interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  content: string;
  type: 'text' | 'image' | 'audio' | 'file';
  createdAt: string;
}

interface Conversation {
  id: number;
  participants: User[];
  lastMessage?: {
    content: string;
    timestamp: string;
    senderId: number;
  };
  unreadCount: number;
}

// Fonction pour rendre les liens internes cliquables
function renderMessageContent(content: string) {
  // Regex pour détecter les liens internes (/gbairai/ID)
  const linkPattern = /(\/gbairai\/\d+)/g;
  const parts = content.split(linkPattern);
  
  return parts.map((part, index) => {
    if (part.match(linkPattern)) {
      return (
        <Link key={index} href={part}>
          <span 
            className="inline-block px-2 py-1 mt-1 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 hover:text-blue-200 rounded-md text-sm font-medium cursor-pointer transition-colors"
            style={{
              border: '1px solid rgba(59, 130, 246, 0.3)',
              textDecoration: 'none'
            }}
          >
            📱 Ouvrir le Gbairai
          </span>
        </Link>
      );
    }
    return part;
  });
}

export default function ConversationPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const params = useParams();
  const conversationId = parseInt(params.id as string);
  
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Récupérer les détails de la conversation
  const { data: conversation } = useQuery<Conversation>({
    queryKey: ['/api/conversations', conversationId],
    enabled: !!conversationId,
  });

  // Récupérer les messages de la conversation
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['/api/conversations', conversationId, 'messages'],
    enabled: !!conversationId,
    refetchInterval: 2000,
  });

  // Mutation pour envoyer un message
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { content: string; type: string }) => {
      const response = await apiRequest("POST", `/api/conversations/${conversationId}/messages`, messageData);
      return response.json();
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', conversationId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
  });

  // Auto-scroll vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    sendMessageMutation.mutate({
      content: newMessage.trim(),
      type: 'text'
    });
  };

  const otherParticipant = conversation?.participants.find(p => p.id !== user?.id);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Connexion requise
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Veuillez vous connecter pour accéder à vos messages
          </p>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Conversation non trouvée
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Cette conversation n'existe pas ou vous n'y avez pas accès
          </p>
          <Link href="/messages">
            <Button className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour aux messages
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <Card className="h-[calc(100vh-8rem)] flex flex-col">
            {/* En-tête de la conversation */}
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center space-x-3">
                <Link href="/messages">
                  <Button variant="outline" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Retour
                  </Button>
                </Link>
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-green-500 text-white">
                    {otherParticipant?.username[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {otherParticipant?.username}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {messages.length} message{messages.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </CardHeader>

            {/* Messages */}
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                  <div className="text-center">
                    <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Aucun message pour le moment</p>
                    <p className="text-sm">Commencez la conversation !</p>
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex",
                      message.senderId === user.id ? "justify-end" : "justify-start"
                    )}
                  >
                    <div className="max-w-[70%]">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span className="font-medium">
                          {message.senderId === user.id ? 'Vous' : otherParticipant?.username}
                        </span>
                        <span className="ml-2">
                          {format(new Date(message.createdAt), 'HH:mm', { locale: fr })}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "px-4 py-2 rounded-2xl text-white break-words",
                          message.senderId === user.id
                            ? "bg-blue-500 rounded-br-sm"
                            : "bg-gray-600 rounded-bl-sm"
                        )}
                      >
                        {renderMessageContent(message.content)}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </CardContent>

            {/* Zone de saisie */}
            <div className="p-4 border-t">
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Tapez votre message..."
                  className="flex-1"
                  disabled={sendMessageMutation.isPending}
                />
                <Button 
                  type="submit" 
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}