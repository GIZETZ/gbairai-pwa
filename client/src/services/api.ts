import { apiRequest } from "@/lib/queryClient";
import { 
  GbairaiWithInteractions, 
  InsertGbairai, 
  EmotionAnalysisResult,
  LocationData 
} from "@shared/schema";

export const gbairaiApi = {
  // Get all gbairais
  getGbairais: async (params?: {
    limit?: number;
    offset?: number;
    emotion?: string;
  }): Promise<GbairaiWithInteractions[]> => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    if (params?.emotion) searchParams.append('emotion', params.emotion);
    
    const response = await fetch(`/api/gbairais?${searchParams}`);
    if (!response.ok) throw new Error('Failed to fetch gbairais');
    return response.json();
  },

  // Get gbairai by ID
  getGbairai: async (id: number): Promise<GbairaiWithInteractions> => {
    const response = await fetch(`/api/gbairais/${id}`);
    if (!response.ok) throw new Error('Failed to fetch gbairai');
    return response.json();
  },

  // Create new gbairai
  createGbairai: async (data: InsertGbairai): Promise<GbairaiWithInteractions> => {
    const response = await apiRequest("POST", "/api/gbairais", data);
    return response.json();
  },

  // Delete gbairai
  deleteGbairai: async (id: number): Promise<void> => {
    await apiRequest("DELETE", `/api/gbairais/${id}`);
  },

  // Interact with gbairai (like, comment, share)
  interactWithGbairai: async (id: number, type: 'like' | 'comment' | 'share', content?: string, parentCommentId?: number) => {
    const response = await apiRequest("POST", `/api/gbairais/${id}/interact`, {
      type,
      content,
      parentCommentId
    });
    return response.json();
  },

  // Get nearby gbairais
  getNearbyGbairais: async (location: LocationData, radius: number = 10): Promise<GbairaiWithInteractions[]> => {
    const searchParams = new URLSearchParams({
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
      radius: radius.toString()
    });
    
    const response = await fetch(`/api/gbairais/nearby?${searchParams}`);
    if (!response.ok) throw new Error('Failed to fetch nearby gbairais');
    return response.json();
  },

  // Get user's gbairais
  getUserGbairais: async (userId: number): Promise<GbairaiWithInteractions[]> => {
    const response = await fetch(`/api/users/${userId}/gbairais`);
    if (!response.ok) throw new Error('Failed to fetch user gbairais');
    return response.json();
  },

  // Get comments for a gbairai
  getGbairaiComments: async (gbairaiId: number) => {
    const response = await fetch(`/api/gbairais/${gbairaiId}/comments`);
    if (!response.ok) throw new Error('Failed to fetch comments');
    return response.json();
  },

  // Get replies for a comment
  getCommentReplies: async (commentId: number) => {
    const response = await fetch(`/api/comments/${commentId}/replies`);
    if (!response.ok) throw new Error('Failed to fetch replies');
    return response.json();
  }
};

export const emotionApi = {
  // Analyze emotion
  analyzeEmotion: async (text: string, language: string = 'fr-ci'): Promise<EmotionAnalysisResult> => {
    const response = await apiRequest("POST", "/api/analyze-emotion", {
      text,
      language
    });
    return response.json();
  },

  // Validate content
  validateContent: async (content: string) => {
    const response = await apiRequest("POST", "/api/validate-content", {
      content
    });
    return response.json();
  }
};

export const notificationsApi = {
  // Get notifications
  getNotifications: async () => {
    const response = await apiRequest("GET", "/api/notifications");
    return response.json();
  },

  // Mark notification as read
  markAsRead: async (notificationId: number) => {
    const response = await apiRequest("PUT", `/api/notifications/${notificationId}/read`);
    return response.json();
  },

  // Mark all notifications as read
  markAllAsRead: async () => {
    const response = await apiRequest("PUT", "/api/notifications/read-all");
    return response.json();
  }
};

export const healthApi = {
  // Check API health
  checkHealth: async () => {
    const response = await fetch('/api/health');
    if (!response.ok) throw new Error('API health check failed');
    return response.json();
  }
};
