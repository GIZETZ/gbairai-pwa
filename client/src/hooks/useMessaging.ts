import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Message, Conversation, User } from '@shared/schema';

export interface ConversationWithDetails extends Conversation {
  participants: Array<{
    id: number;
    username: string;
    email: string;
  }>;
  lastMessage?: {
    content: string;
    timestamp: Date;
    senderId: number;
  };
  unreadCount: number;
}

export function useUsers() {
  return useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users');
      return response.json();
    },
  });
}

export function useConversations() {
  return useQuery<ConversationWithDetails[]>({
    queryKey: ['/api/conversations'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/conversations');
      return response.json();
    },
  });
}

export function useMessages(conversationId: number) {
  return useQuery<Message[]>({
    queryKey: ['/api/conversations', conversationId, 'messages'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/conversations/${conversationId}/messages`);
      return response.json();
    },
    enabled: !!conversationId,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recipientId: number) => {
      const response = await apiRequest('POST', '/api/conversations', {
        recipientId,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      content,
      type = 'text',
    }: {
      conversationId: number;
      content: string;
      type?: string;
    }) => {
      const response = await apiRequest('POST', `/api/conversations/${conversationId}/messages`, {
        content,
        type,
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Mise à jour optimiste pour éviter les re-rendus
      queryClient.setQueryData(['/api/conversations', variables.conversationId, 'messages'], (oldData: any) => {
        if (!oldData) return [data];
        return [...oldData, data];
      });
      
      // Invalidation différée pour éviter les problèmes de focus
      setTimeout(() => {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/conversations', variables.conversationId, 'messages'] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['/api/conversations'] 
        });
      }, 200);
    },
  });
}