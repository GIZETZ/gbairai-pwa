import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { gbairaiApi } from "@/services/api";
import { GbairaiWithInteractions, InsertGbairai } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useGbairais(params?: {
  limit?: number;
  offset?: number;
  emotion?: string;
  region?: string;
  followingOnly?: boolean;
}) {
  return useQuery<GbairaiWithInteractions[], Error>({
    queryKey: ["/api/gbairais", params],
    queryFn: () => gbairaiApi.getGbairais(params),
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });
}

export function useGbairai(id: number) {
  return useQuery<GbairaiWithInteractions, Error>({
    queryKey: ["/api/gbairais", id],
    queryFn: () => gbairaiApi.getGbairai(id),
    enabled: !!id,
  });
}

export function useCreateGbairai() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: InsertGbairai) => gbairaiApi.createGbairai(data),
    onSuccess: () => {
      // Invalidate and refetch gbairais
      queryClient.invalidateQueries({ queryKey: ["/api/gbairais"] });
      toast({
        title: "Succès",
        description: "Gbairai publié avec succès !",
      });
    },
    onError: (error: any) => {
      // Handle specific moderation errors
      if (error.response?.status === 400 && error.response?.data?.error === 'Contenu modéré') {
        toast({
          title: "Contenu modéré",
          description: error.response.data.message || "Contenu non autorisé",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erreur",
          description: error.message || "Une erreur est survenue",
          variant: "destructive",
        });
      }
    },
  });
}

export function useDeleteGbairai() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: number) => gbairaiApi.deleteGbairai(id),
    onSuccess: () => {
      // Invalidate and refetch gbairais
      queryClient.invalidateQueries({ queryKey: ["/api/gbairais"] });
      toast({
        title: "Succès",
        description: "Gbairai supprimé avec succès !",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useInteractWithGbairai() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ 
      gbairaiId, 
      type, 
      content,
      parentCommentId 
    }: { 
      gbairaiId: number; 
      type: 'like' | 'comment' | 'share'; 
      content?: string; 
      parentCommentId?: number;
    }) => gbairaiApi.interactWithGbairai(gbairaiId, type, content, parentCommentId),
    onSuccess: (data, variables) => {
      // Invalidate and refetch gbairais
      queryClient.invalidateQueries({ queryKey: ["/api/gbairais"] });
      
      if (variables.type === 'like') {
        toast({
          title: data.action === 'created' ? "Like ajouté" : "Like retiré",
          description: data.action === 'created' ? "Vous aimez ce gbairai" : "Vous n'aimez plus ce gbairai",
        });
      }
    },
    onError: (error: any) => {
      // Handle specific moderation errors for comments
      if (error.response?.status === 400 && error.response?.data?.error === 'Contenu modéré') {
        toast({
          title: "Commentaire modéré",
          description: error.response.data.message || "Commentaire non autorisé",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erreur",
          description: error.message || "Une erreur est survenue",
          variant: "destructive",
        });
      }
    },
  });
}

export function useNearbyGbairais(latitude?: number, longitude?: number, radius: number = 10) {
  return useQuery<GbairaiWithInteractions[], Error>({
    queryKey: ["/api/gbairais/nearby", latitude, longitude, radius],
    queryFn: () => {
      if (!latitude || !longitude) {
        throw new Error("Location required for nearby gbairais");
      }
      return gbairaiApi.getNearbyGbairais(
        { latitude, longitude, city: "", region: "", country: "Côte d'Ivoire" },
        radius
      );
    },
    enabled: !!latitude && !!longitude,
  });
}

export function useUserGbairais(userId: number) {
  return useQuery<GbairaiWithInteractions[], Error>({
    queryKey: ["/api/users", userId, "gbairais"],
    queryFn: () => gbairaiApi.getUserGbairais(userId),
    enabled: !!userId,
  });
}

export function useGbairaiComments(gbairaiId: number) {
  return useQuery({
    queryKey: ["/api/gbairais", gbairaiId, "comments"],
    queryFn: () => gbairaiApi.getGbairaiComments(gbairaiId),
    enabled: !!gbairaiId,
  });
}
