import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, MessageCircle, Search, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

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

export default function MessagesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState("");

  // Récupérer tous les utilisateurs
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: !!user,
  });

  // Récupérer les conversations
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ['/api/conversations'],
    enabled: !!user,
  });

  // Mutation pour créer une nouvelle conversation
  const createConversationMutation = useMutation({
    mutationFn: async (participantId: number) => {
      const response = await apiRequest("POST", "/api/conversations", {
        participants: [user!.id, participantId]
      });
      return response.json();
    },
    onSuccess: (newConversation) => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      // Rediriger vers la nouvelle conversation
      window.location.href = `/messages/${newConversation.id}`;
    },
  });

  const handleStartConversation = (userId: number) => {
    // Vérifier si une conversation existe déjà
    const existingConversation = conversations.find(conv => 
      conv.participants.some(p => p.id === userId)
    );
    
    if (existingConversation) {
      window.location.href = `/messages/${existingConversation.id}`;
    } else {
      createConversationMutation.mutate(userId);
    }
  };

  const filteredUsers = allUsers.filter(u => 
    u.id !== user?.id && 
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* En-tête avec bouton de retour */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Link href="/">
                    <Button variant="outline" size="sm">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Retour
                    </Button>
                  </Link>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    Messages
                  </h1>
                </div>
                <Badge variant="secondary">
                  {conversations.length} conversations
                </Badge>
              </div>
            </CardHeader>
          </Card>

          {/* Recherche d'utilisateurs */}
          <Card>
            <CardHeader className="pb-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Commencer une nouvelle conversation
              </h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Rechercher un utilisateur..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => handleStartConversation(user.id)}
                    className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-blue-500 text-white text-sm">
                        {user.username[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.username}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Liste des conversations */}
          <Card>
            <CardHeader className="pb-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Vos conversations
              </h2>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {conversations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Aucune conversation</p>
                    <p className="text-sm">Commencez en cherchant un utilisateur</p>
                  </div>
                ) : (
                  conversations.map((conversation) => {
                    const otherUser = conversation.participants.find(p => p.id !== user.id);
                    return (
                      <Link key={conversation.id} href={`/messages/${conversation.id}`}>
                        <div className="flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors border hover:bg-gray-100 dark:hover:bg-gray-800 border-transparent">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className="bg-green-500 text-white">
                              {otherUser?.username[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {otherUser?.username}
                            </p>
                            {conversation.lastMessage && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {conversation.lastMessage.content}
                              </p>
                            )}
                          </div>
                          {conversation.unreadCount > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {conversation.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}