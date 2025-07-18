import React from "react";
import { GbairaiWithInteractions } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Heart, MessageCircle, Share2, MapPin, Send, X, User, ArrowLeft, Plus, MoreVertical, Trash2, Languages, Flag, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useInteractWithGbairai, useGbairaiComments } from "@/hooks/useGbairais";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { CommentItem } from "./CommentItem";
import { EmojiPicker } from "../Common/EmojiPicker";
import { emotionConfig, getEmotionDisplay } from "@/components/Gbairai/GbairaiCard";
import { ShareToConversationModal } from "./ShareToConversationModal";
import { useState, useRef, useEffect } from "react";

interface GbairaiCardMobileProps {
  gbairai: GbairaiWithInteractions;
  onCommentsToggle?: (isOpen: boolean) => void;
}

export function GbairaiCardMobile({ gbairai, onCommentsToggle }: GbairaiCardMobileProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const interactMutation = useInteractWithGbairai();
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [activeCommentMenu, setActiveCommentMenu] = useState<{
    commentId: number;
    isOwner: boolean;
  } | null>(null);
  const [replyingTo, setReplyingTo] = useState<{
    commentId: number;
    username: string;
  } | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());
  const [repliesOverlay, setRepliesOverlay] = useState<{
    isVisible: boolean;
    commentId: number | null;
    parentComment: any;
  }>({
    isVisible: false,
    commentId: null,
    parentComment: null
  });
  const [isCommentEditorFocused, setIsCommentEditorFocused] = useState(false);
  const [commentReplies, setCommentReplies] = useState<Record<number, any[]>>({});
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    show: boolean;
    commentId: number | null;
    commentContent: string;
  }>({
    show: false,
    commentId: null,
    commentContent: ''
  });

  // État optimiste pour les likes de commentaires
  const [optimisticLikes, setOptimisticLikes] = useState<Set<number>>(new Set());

  
  const { data: comments = [], isLoading: commentsLoading, refetch: refetchComments } = useGbairaiComments(gbairai.id);
  
  // Charger les réponses pour chaque commentaire
  useEffect(() => {
    const loadRepliesForComments = async () => {
      const mainComments = comments.filter((comment: any) => !comment.parentCommentId);
      
      for (const comment of mainComments as any[]) {
        try {
          const response = await fetch(`/api/comments/${comment.id}/replies`, {
            credentials: 'include'
          });
          if (response.ok) {
            const replies = await response.json();
            setCommentReplies(prev => ({
              ...prev,
              [comment.id]: replies
            }));
          }
        } catch (error) {
          console.error('Erreur lors du chargement des réponses:', error);
        }
      }
    };

    if (comments.length > 0) {
      loadRepliesForComments();
    }
  }, [comments]);

  // Nettoyer les likes optimistes après mise à jour des données
  useEffect(() => {
    if (gbairai.interactions.length > 0) {
      // Supprimer les likes optimistes qui sont maintenant confirmés par le serveur
      setOptimisticLikes(prev => {
        const newSet = new Set(prev);
        prev.forEach(commentId => {
          const existingLike = gbairai.interactions.find(interaction => 
            interaction.type === 'like' && 
            interaction.userId === user?.id && 
            interaction.parentCommentId === commentId
          );
          if (existingLike) {
            newSet.delete(commentId);
          }
        });
        return newSet;
      });
    }
  }, [gbairai.interactions, user?.id]);

  const emotion = getEmotionDisplay(gbairai.emotion);

  const location = gbairai.location as any;
  const locationText = location ? `${location.city || location.region || 'Côte d\'Ivoire'}` : 'Côte d\'Ivoire';

  const timeAgo = formatDistanceToNow(new Date(gbairai.createdAt!), { 
    addSuffix: true,
    locale: fr 
  });

  const handleInteraction = async (type: string) => {
    if (!user) {
      toast({
        title: "Connexion requise",
        description: "Vous devez vous connecter pour interagir.",
        variant: "destructive",
      });
      return;
    }

    // Vérifier que l'ID est valide
    if (!gbairai.id || isNaN(gbairai.id)) {
      toast({
        title: "Erreur",
        description: "Impossible d'interagir avec ce Gbairai.",
        variant: "destructive",
      });
      return;
    }

    // Pour les commentaires, ouvrir la vue commentaires au lieu de créer une interaction vide
    if (type === 'comment') {
      setShowComments(true);
      onCommentsToggle?.(true);
      return;
    }

    // Pour le partage, ne pas traiter ici - géré par le menu de partage
    if (type === 'share') {
      return;
    }

    try {
      await interactMutation.mutateAsync({
        gbairaiId: gbairai.id,
        type: type as 'like' | 'comment' | 'share',
        content: undefined,
      });
    } catch (error) {
      console.error('Erreur lors de l\'interaction:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'interagir pour le moment.",
        variant: "destructive",
      });
    }
  };

  const handleCommentSubmit = async () => {
    if (!commentText.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir un commentaire.",
        variant: "destructive",
      });
      return;
    }

    try {
      const commentData: any = {
        gbairaiId: gbairai.id,
        type: 'comment',
        content: commentText.trim(),
      };

      // Si c'est une réponse, ajouter le parentCommentId
      if (replyingTo) {
        commentData.parentCommentId = replyingTo.commentId;
      }

      await interactMutation.mutateAsync(commentData);
      
      setCommentText("");
      setReplyingTo(null);
      
      // Rafraîchir les commentaires
      refetchComments();
      
      // Si c'était une réponse, recharger les réponses pour ce commentaire
      if (replyingTo?.commentId) {
        try {
          const response = await fetch(`/api/comments/${replyingTo.commentId}/replies`, {
            credentials: 'include'
          });
          if (response.ok) {
            const replies = await response.json();
            setCommentReplies(prev => ({
              ...prev,
              [replyingTo.commentId]: replies
            }));
          }
        } catch (error) {
          console.error('Erreur lors du rechargement des réponses:', error);
        }
      }
      
      // Si nous sommes dans l'overlay des réponses, ne pas fermer l'overlay
      // L'overlay reste ouvert pour continuer la conversation
      
      toast({
        title: replyingTo ? "Réponse ajoutée" : "Commentaire ajouté",
        description: replyingTo ? "Votre réponse a été publiée avec succès !" : "Votre commentaire a été publié avec succès !",
      });
    } catch (error) {
      console.error('Erreur lors du commentaire:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le commentaire.",
        variant: "destructive",
      });
    }
  };

  // Removed old comment form handlers

  const handleCloseComments = () => {
    setShowComments(false);
    setCommentText("");
    setReplyingTo(null);
    onCommentsToggle?.(false);
  };

  // Gestion des touches d'échappement
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (repliesOverlay.isVisible) {
          // Fermer l'overlay des réponses en priorité
          closeRepliesOverlay();
        } else if (showComments) {
          // Fermer les commentaires si l'overlay n'est pas ouvert
          handleCloseComments();
        }
      }
    };

    // Ajouter l'event listener quand les commentaires ou l'overlay sont ouverts
    if (showComments || repliesOverlay.isVisible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showComments, repliesOverlay.isVisible]);

  // Gestion du menu déroulant de commentaire
  const handleCommentMenuToggle = (commentId: number, isOwner: boolean) => {
    if (activeCommentMenu?.commentId === commentId) {
      // Fermer le menu s'il est déjà ouvert pour ce commentaire
      setActiveCommentMenu(null);
    } else {
      // Ouvrir le menu pour ce commentaire
      setActiveCommentMenu({
        commentId,
        isOwner
      });
    }
  };

  const closeCommentMenu = () => {
    setActiveCommentMenu(null);
  };

  // Fonction pour vérifier si un commentaire est aimé par l'utilisateur actuel
  const isCommentLikedByUser = (commentId: number) => {
    if (!user) return false;
    
    // Vérifier d'abord l'état optimiste pour une réponse instantanée
    if (optimisticLikes.has(commentId)) {
      return true;
    }
    
    // Chercher dans les interactions du gbairai si l'utilisateur a liké ce commentaire
    const userLike = gbairai.interactions.find(interaction => 
      interaction.type === 'like' && 
      interaction.userId === user.id && 
      interaction.parentCommentId === commentId
    );
    
    return !!userLike;
  };

  // Fonction pour compter le nombre de likes spécifiquement pour un commentaire
  const getCommentLikesCount = (commentId: number) => {
    let count = gbairai.interactions.filter(interaction => 
      interaction.type === 'like' && 
      interaction.parentCommentId === commentId
    ).length;
    
    // Ajouter 1 si le commentaire est dans les likes optimistes et l'utilisateur ne l'a pas encore liké
    if (optimisticLikes.has(commentId) && !gbairai.interactions.some(interaction => 
      interaction.type === 'like' && 
      interaction.userId === user?.id && 
      interaction.parentCommentId === commentId
    )) {
      count += 1;
    }
    
    return count;
  };

  const handleLikeComment = async (commentId: number) => {
    if (!user) {
      toast({
        title: "Connexion requise",
        description: "Vous devez être connecté pour aimer un commentaire",
        variant: "destructive",
      });
      return;
    }

    // Vérifier si déjà liké
    if (isCommentLikedByUser(commentId)) {
      toast({
        title: "Déjà aimé",
        description: "Vous avez déjà aimé ce commentaire",
        variant: "destructive",
      });
      return;
    }

    // Mise à jour optimiste instantanée
    setOptimisticLikes(prev => new Set([...prev, commentId]));

    try {
      // Utiliser l'API d'interaction existante avec type "like"
      const response = await fetch(`/api/gbairais/${gbairai.id}/interact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          type: 'like',
          parentCommentId: commentId // Le commentaire ciblé
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Recharger les commentaires pour mettre à jour le compteur de likes
        refetchComments();
        
        // Recharger les réponses si nécessaire
        const allComments = [...comments, ...Object.values(commentReplies).flat()];
        const likedComment = allComments.find((comment: any) => comment.id === commentId);
        
        if (likedComment && likedComment.parentCommentId) {
          // Si c'est une réponse, recharger les réponses du commentaire parent
          const response = await fetch(`/api/comments/${likedComment.parentCommentId}/replies`, {
            credentials: 'include'
          });
          if (response.ok) {
            const replies = await response.json();
            setCommentReplies(prev => ({
              ...prev,
              [likedComment.parentCommentId]: replies
            }));
          }
        }
        
        toast({
          title: "👍",
          description: "Commentaire aimé !",
        });
      } else {
        // Annuler la mise à jour optimiste en cas d'erreur
        setOptimisticLikes(prev => {
          const newSet = new Set(prev);
          newSet.delete(commentId);
          return newSet;
        });
        
        const error = await response.json();
        if (response.status === 409) {
          toast({
            title: "Déjà aimé",
            description: "Vous avez déjà aimé ce commentaire",
            variant: "destructive",
          });
        } else {
          throw new Error(error.message || 'Erreur lors du like');
        }
      }
    } catch (error) {
      // Annuler la mise à jour optimiste en cas d'erreur
      setOptimisticLikes(prev => {
        const newSet = new Set(prev);
        newSet.delete(commentId);
        return newSet;
      });
      
      toast({
        title: "Erreur",
        description: "Impossible d'aimer le commentaire",
        variant: "destructive",
      });
    }
  };

  // Fermer le menu déroulant avec Échap
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeCommentMenu();
        if (deleteConfirmation.show) {
          cancelDeleteComment();
        }
      }
    };

    if (activeCommentMenu || deleteConfirmation.show) {
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [activeCommentMenu, deleteConfirmation.show]);

  const handleDeleteComment = async (commentId?: number) => {
    const idToDelete = commentId || activeCommentMenu?.commentId;
    if (!idToDelete) return;
    
    // Trouver le commentaire à supprimer pour afficher son contenu
    const allComments = [...comments, ...Object.values(commentReplies).flat()];
    const commentToDelete = allComments.find((comment: any) => comment.id === idToDelete);
    
    if (!commentToDelete) return;
    
    // Afficher la boîte de confirmation
    setDeleteConfirmation({
      show: true,
      commentId: idToDelete,
      commentContent: commentToDelete.content
    });
    
    closeCommentMenu();
  };

  const confirmDeleteComment = async () => {
    if (!deleteConfirmation.commentId) return;
    
    try {
      const response = await fetch(`/api/interactions/${deleteConfirmation.commentId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        // Recharger les commentaires
        refetchComments();
        
        // Recharger les réponses si nécessaire
        const allComments = [...comments, ...Object.values(commentReplies).flat()];
        const deletedComment = allComments.find((comment: any) => comment.id === deleteConfirmation.commentId);
        
        if (deletedComment && deletedComment.parentCommentId) {
          // Si c'est une réponse, recharger les réponses du commentaire parent
          const response = await fetch(`/api/comments/${deletedComment.parentCommentId}/replies`, {
            credentials: 'include'
          });
          if (response.ok) {
            const replies = await response.json();
            setCommentReplies(prev => ({
              ...prev,
              [deletedComment.parentCommentId]: replies
            }));
          }
        }
        
        toast({
          title: "Commentaire supprimé",
          description: "Le commentaire a été supprimé avec succès",
        });
      } else {
        throw new Error('Erreur lors de la suppression');
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le commentaire",
        variant: "destructive",
      });
    }
    
    // Fermer la boîte de confirmation
    setDeleteConfirmation({
      show: false,
      commentId: null,
      commentContent: ''
    });
  };

  const cancelDeleteComment = () => {
    setDeleteConfirmation({
      show: false,
      commentId: null,
      commentContent: ''
    });
  };

  const handleTranslateComment = async () => {
    if (!activeCommentMenu) return;
    
    const comment = comments.find((c: any) => c.id === activeCommentMenu.commentId);
    if (!comment) return;

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: comment.content })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Traduction",
          description: result.translatedText,
        });
      } else {
        throw new Error('Erreur lors de la traduction');
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de traduire le commentaire",
        variant: "destructive",
      });
    }
    closeCommentMenu();
  };

  const handleReportComment = async () => {
    if (!activeCommentMenu) return;
    
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          type: 'comment',
          targetId: activeCommentMenu.commentId,
          reason: 'Contenu inapproprié'
        })
      });

      if (response.ok) {
        toast({
          title: "Signalement envoyé",
          description: "Le commentaire a été signalé aux modérateurs",
        });
      } else {
        throw new Error('Erreur lors du signalement');
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de signaler le commentaire",
        variant: "destructive",
      });
    }
    closeCommentMenu();
  };

  const handleExternalShare = async () => {
    const shareUrl = `${window.location.origin}/gbairai/${gbairai.id}`;
    
    // Essayer d'utiliser l'API Web Share si disponible
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Gbairai',
          text: `Découvrez ce Gbairai: "${gbairai.content}"`,
          url: shareUrl
        });
        return;
      } catch (error) {
        // L'utilisateur a annulé le partage, continuer avec la copie
      }
    }
    
    // Fallback: copier le lien
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Lien copié",
        description: "Le lien du Gbairai a été copié dans le presse-papier"
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de copier le lien",
        variant: "destructive"
      });
    }
  };

  const handleReplyToComment = (comment: any, parentUsername?: string) => {
    const username = comment.user?.username || comment.username;
    // Si on est dans l'overlay, on répond au commentaire parent
    if (repliesOverlay.isVisible && repliesOverlay.commentId) {
      setReplyingTo({ commentId: repliesOverlay.commentId, username });
    } else {
      setReplyingTo({ commentId: comment.id, username });
    }
    // Auto-tag the parent comment author or the specific user being replied to
    const taggedUser = parentUsername || username;
    setCommentText(`@${taggedUser} `);
  };

  const toggleReplies = (commentId: number) => {
    setExpandedReplies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  };

  const openRepliesOverlay = async (commentId: number, parentComment: any) => {
    // Recharger les réponses avant d'ouvrir l'overlay
    try {
      const response = await fetch(`/api/comments/${commentId}/replies`, {
        credentials: 'include'
      });
      if (response.ok) {
        const replies = await response.json();
        setCommentReplies(prev => ({
          ...prev,
          [commentId]: replies
        }));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des réponses:', error);
    }
    
    setRepliesOverlay({
      isVisible: true,
      commentId,
      parentComment
    });
  };

  const closeRepliesOverlay = () => {
    setRepliesOverlay({
      isVisible: false,
      commentId: null,
      parentComment: null
    });
  };

  // Séparer les commentaires principaux des réponses
  const mainComments = comments.filter((comment: any) => !comment.parentCommentId);

  
  // Fonction pour récupérer les réponses d'un commentaire
  const getRepliesForComment = (commentId: number) => {
    return commentReplies[commentId] || [];
  };

  // Fonction pour organiser les réponses par ordre chronologique des réponses taguées
  const getOrganizedReplies = (commentId: number) => {
    const replies = getRepliesForComment(commentId);
    if (replies.length === 0) return [];

    // Identifier les réponses qui sont des réponses directes (taguées)
    const taggedReplies: any[] = [];
    const responseMap: { [key: string]: any[] } = {};

    // Parcourir toutes les réponses
    replies.forEach((reply: any) => {
      // Extraire le tag @username du début du contenu
      const tagMatch = reply.content.match(/^@(\w+)/);
      if (tagMatch) {
        const taggedUsername = tagMatch[1];
        
        // Vérifier si c'est une réponse directe au commentaire parent
        // (tag correspond à l'auteur du commentaire parent)
        const parentComment = repliesOverlay.parentComment;
        const parentUsername = parentComment?.user?.username || parentComment?.username;
        
        if (taggedUsername === parentUsername) {
          // C'est une réponse directe au commentaire parent
          taggedReplies.push(reply);
          responseMap[reply.id] = [];
        } else {
          // C'est une réponse à une autre réponse
          // Trouver la réponse taguée correspondante
          const targetReply = replies.find((r: any) => 
            (r.user?.username || r.username) === taggedUsername
          );
          
          if (targetReply) {
            if (!responseMap[targetReply.id]) {
              responseMap[targetReply.id] = [];
            }
            responseMap[targetReply.id].push(reply);
          } else {
            // Si on ne trouve pas la réponse taguée, traiter comme réponse directe
            taggedReplies.push(reply);
            responseMap[reply.id] = [];
          }
        }
      } else {
        // Pas de tag, traiter comme réponse directe
        taggedReplies.push(reply);
        responseMap[reply.id] = [];
      }
    });

    // Trier les réponses taguées par ordre chronologique
    taggedReplies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Construire la liste organisée
    const organizedReplies: any[] = [];
    taggedReplies.forEach(taggedReply => {
      // Ajouter la réponse taguée
      organizedReplies.push(taggedReply);
      
      // Ajouter ses réponses associées, triées par ordre chronologique
      const responses = responseMap[taggedReply.id] || [];
      responses.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      organizedReplies.push(...responses);
    });

    return organizedReplies;
  };

  // Fonction pour charger les réponses d'un commentaire
  const loadReplies = async (commentId: number) => {
    try {
      const response = await fetch(`/api/comments/${commentId}/replies`);
      if (response.ok) {
        const replies = await response.json();
        setCommentReplies(prev => ({
          ...prev,
          [commentId]: replies
        }));
      }
    } catch (error) {
      console.error('Error loading replies:', error);
    }
  };

  // Charger les réponses pour tous les commentaires principaux
  useEffect(() => {
    if (mainComments.length > 0) {
      mainComments.forEach((comment: any) => {
        // Éviter de recharger si déjà chargé
        if (!commentReplies[comment.id]) {
          loadReplies(comment.id);
        }
      });
    }
  }, [mainComments.length]); // Dépendre seulement de la longueur pour éviter la boucle infinie

  return (
    <div 
      className="gbairai-card-mobile"
      style={{ 
        '--emotion-color': emotion.color,
      } as any}
    >
      <div className="background"></div>
      <div className="overlay"></div>
      <div className="content">
        <div className="emotion-header">
          <span className="emotion-emoji">{emotion.emoji}</span>
          <span className="emotion-label">{emotion.label}</span>
          <span className="location">
            <MapPin className="w-3 h-3" />
            {locationText}
          </span>
        </div>
        
        <div className="gbairai-content pt-[0px] pb-[0px] text-[30px] font-semibold" style={{ 
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexGrow: 1,
          height: '100%',
          fontSize: '30px'
        }}>
          {gbairai.content}
        </div>
        
        <div className="gbairai-footer">
          <div className="meta">
            {/* Afficher le nom de l'utilisateur si la publication n'est pas anonyme */}
            {!gbairai.isAnonymous && gbairai.user && (
              <div className="author-info" style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px',
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                <User className="w-4 h-4" />
                <span>Par {gbairai.user.username}</span>
              </div>
            )}
            {timeAgo}
          </div>
          
          <div className="actions">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleInteraction('like')}
              className="action-btn"
              disabled={interactMutation.isPending}
            >
              <Heart className="w-4 h-4" />
              {gbairai.likesCount > 0 && <span>{gbairai.likesCount}</span>}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleInteraction('comment')}
              className="action-btn"
              disabled={interactMutation.isPending}
            >
              <MessageCircle className="w-4 h-4" />
              {gbairai.commentsCount > 0 && <span>{gbairai.commentsCount}</span>}
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="action-btn"
                  disabled={interactMutation.isPending}
                >
                  <Share2 className="w-4 h-4" />
                  {gbairai.sharesCount > 0 && <span>{gbairai.sharesCount}</span>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                className="bg-black/90 border-white/20 backdrop-blur-md"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.95)',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(10px)',
                  zIndex: 9999
                }}
              >
                <DropdownMenuItem 
                  onClick={handleExternalShare}
                  className="text-white hover:bg-white/10 focus:bg-white/10"
                  style={{
                    color: 'white',
                    padding: '8px 12px'
                  }}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Partager le lien
                </DropdownMenuItem>
                <ShareToConversationModal 
                  gbairaiId={gbairai.id} 
                  gbairaiContent={gbairai.content}
                  trigger={
                    <DropdownMenuItem 
                      onSelect={(e) => e.preventDefault()}
                      className="text-white hover:bg-white/10 focus:bg-white/10"
                      style={{
                        color: 'white',
                        padding: '8px 12px'
                      }}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Partager dans une discussion
                    </DropdownMenuItem>
                  }
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Comments View - Card Style */}
        {showComments && (
          <div className="comments-card bg-[#ffffff00] text-[#ebebeb]" style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            width: '100vw',
            height: '100vh',
            zIndex: 50,
            backgroundColor: 'rgba(0,0,0,0.95)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            margin: 0,
            padding: 0
          }}>
            <div className="comments-header" style={{ 
              position: 'sticky', 
              top: 0, 
              zIndex: 10,
              backgroundColor: 'rgba(0,0,0,0.9)',
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseComments}
                  className="back-btn"
                  style={{ 
                    color: 'white',
                    padding: '8px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)'
                  }}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <h2 style={{ color: 'white', margin: 0 }}>Commentaires ({comments.length})</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ 
                  color: 'rgba(255,255,255,0.6)', 
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  Appuyez sur Échap pour fermer
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseComments}
                  className="close-btn"
                  style={{ 
                    color: 'white',
                    padding: '8px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)'
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div 
              className="comments-list"
              style={{ 
                flex: 1,
                overflowY: 'auto', 
                overflowX: 'hidden',
                padding: '8px 12px',
                paddingBottom: '120px',
                WebkitOverflowScrolling: 'touch',
                position: 'relative',
                touchAction: 'pan-y',
                scrollPaddingBottom: '120px'
              }}
            >
              {commentsLoading ? (
                <div style={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '200px',
                  color: '#9CA3AF'
                }}>
                  <div style={{ 
                    width: '32px',
                    height: '32px',
                    border: '3px solid rgba(255,255,255,0.1)',
                    borderTop: '3px solid #3B82F6',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginBottom: '16px'
                  }}></div>
                  <p>Chargement des commentaires...</p>
                </div>
              ) : comments.length === 0 ? (
                <>
                  {/* Indicateur de scroll - premiers commentaires - VERSION COMPACTE */}
                  <div style={{ 
                    marginBottom: '8px',
                    padding: '6px 12px',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    textAlign: 'center',
                    color: '#8A8A8A',
                    fontSize: '11px',
                    opacity: '0.6'
                  }}>
                    • Début des commentaires •
                  </div>

                  <div style={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '200px',
                    color: '#9CA3AF',
                    textAlign: 'center'
                  }}>
                    <MessageCircle className="w-12 h-12 opacity-50" style={{ marginBottom: '16px' }} />
                    <p style={{ marginBottom: '8px' }}>Aucun commentaire pour le moment</p>
                    <p style={{ fontSize: '14px', opacity: '0.7' }}>Soyez le premier à commenter !</p>
                  </div>

                  {/* Indicateur de scroll - fin des commentaires - VERSION COMPACTE */}
                  <div style={{ 
                    marginTop: '12px',
                    marginBottom: '20px',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    textAlign: 'center',
                    color: '#8A8A8A',
                    fontSize: '12px',
                    opacity: '0.7'
                  }}>
                    • Fin des commentaires •
                  </div>
                </>
              ) : (
                <>
                  {/* Indicateur de scroll - premiers commentaires - VERSION COMPACTE */}
                  <div
                    style={{ 
                      marginBottom: '8px',
                      padding: '6px 12px',
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      textAlign: 'center',
                      color: '#8A8A8A',
                      fontSize: '11px',
                      opacity: '0.6'
                    }}>
                    • Début des commentaires •
                  </div>
                  
                  {mainComments.map((comment: any, index: number) => {
                    const isOwner = comment.userId === user?.id;
                    const replies = getRepliesForComment(comment.id);
                    return (
                      <div key={comment.id} style={{ 
                        display: 'flex',
                        padding: '8px 4px',
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                        transition: 'background-color 0.2s',
                        marginBottom: '4px'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#252525'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        {/* Avatar */}
                        <div style={{ 
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          marginRight: '12px',
                          flexShrink: 0,
                          background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          color: 'white',
                          fontSize: '12px'
                        }}>
                          {(comment.user?.username || comment.username)?.charAt(0).toUpperCase() || '?'}
                        </div>
                        
                        {/* Contenu du commentaire */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            marginBottom: '2px' 
                          }}>
                            <span style={{ 
                              fontWeight: '600',
                              color: '#ffffff',
                              marginRight: '8px',
                              fontSize: '13px'
                            }}>
                              {comment.user?.username || comment.username}
                            </span>
                          </div>
                          
                          <div style={{ 
                            color: '#e0e0e0',
                            lineHeight: '1.3',
                            marginBottom: '6px',
                            fontSize: '14px',
                            wordWrap: 'break-word'
                          }}>
                            {comment.content}
                          </div>
                          
                          <div style={{ 
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            fontSize: '12px',
                            color: '#8A8A8A',
                            marginBottom: '4px'
                          }}>
                            <span style={{ color: '#8A8A8A' }}>
                              {formatDistanceToNow(new Date(comment.createdAt), { 
                                addSuffix: true, 
                                locale: fr 
                              })}
                            </span>
                            <button 
                              onClick={() => handleReplyToComment(comment)}
                              style={{ 
                                background: 'none',
                                border: 'none',
                                color: '#8A8A8A',
                                cursor: 'pointer',
                                fontSize: '12px',
                                transition: 'color 0.2s',
                                textDecoration: 'none'
                              }}
                              onMouseOver={(e) => (e.target as HTMLElement).style.color = '#ffffff'}
                              onMouseOut={(e) => (e.target as HTMLElement).style.color = '#8A8A8A'}
                            >
                              Répondre
                            </button>
                            {isOwner && (
                              <button 
                                onClick={() => handleDeleteComment(comment.id)}
                                style={{ 
                                  background: 'none',
                                  border: 'none',
                                  color: '#EF4444',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  transition: 'color 0.2s',
                                  textDecoration: 'none'
                                }}
                              >
                                Supprimer
                              </button>
                            )}
                          </div>
                          
                          {/* Bouton pour ouvrir l'overlay des réponses */}
                          {replies.length > 0 && (
                            <button 
                              onClick={() => openRepliesOverlay(comment.id, comment)}
                              style={{ 
                                background: 'none',
                                border: 'none',
                                color: '#8A8A8A',
                                cursor: 'pointer',
                                fontSize: '12px',
                                transition: 'color 0.2s',
                                textDecoration: 'none',
                                display: 'block',
                                marginTop: '4px',
                                textAlign: 'left',
                                padding: '0'
                              }}
                              onMouseOver={(e) => (e.target as HTMLElement).style.color = '#ffffff'}
                              onMouseOut={(e) => (e.target as HTMLElement).style.color = '#8A8A8A'}
                            >
                              Voir les réponses ({replies.length})
                            </button>
                          )}
                        </div>
                        
                        {/* Colonne droite avec like - Style exact du template */}
                        <div style={{ 
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                          marginLeft: '8px'
                        }}>
                          <button 
                            onClick={() => handleLikeComment(comment.id)}
                            style={{ 
                              background: 'none',
                              border: 'none',
                              color: isCommentLikedByUser(comment.id) ? '#ff6b6b' : '#8A8A8A',
                              cursor: 'pointer',
                              fontSize: '16px',
                              transition: 'color 0.2s',
                              padding: '4px'
                            }}
                            onMouseOver={(e) => (e.target as HTMLElement).style.color = '#ff6b6b'}
                            onMouseOut={(e) => (e.target as HTMLElement).style.color = isCommentLikedByUser(comment.id) ? '#ff6b6b' : '#8A8A8A'}
                          >
                            {isCommentLikedByUser(comment.id) ? '❤️' : '🤍'}
                          </button>
                          <span style={{ 
                            fontSize: '11px',
                            color: '#8A8A8A',
                            minWidth: '20px',
                            textAlign: 'center'
                          }}>
                            {getCommentLikesCount(comment.id)}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                {/* Indicateur de scroll - fin des commentaires - VERSION COMPACTE */}
                <div style={{ 
                  marginTop: '12px',
                  marginBottom: '20px',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  textAlign: 'center',
                  color: '#8A8A8A',
                  fontSize: '12px',
                  opacity: '0.7'
                }}>
                  • Fin des commentaires •
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Comment Editor - Floating SMS-style overlay */}
      {showComments && (
        <div 
          className="comment-editor-overlay" 
          style={{ 
            position: 'fixed', 
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(0,0,0,0.95)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s ease-in-out',
            transform: isCommentEditorFocused || commentText.trim() || replyingTo ? 'translateY(0)' : 'translateY(0)',
            zIndex: 1000,
            paddingTop: isCommentEditorFocused || commentText.trim() || replyingTo ? '12px' : '8px',
            paddingLeft: '16px',
            paddingRight: '16px',
            paddingBottom: isCommentEditorFocused || commentText.trim() || replyingTo ? 'calc(16px + env(safe-area-inset-bottom))' : 'calc(8px + env(safe-area-inset-bottom))',
            minHeight: isCommentEditorFocused || commentText.trim() || replyingTo ? '100px' : '60px'
          }}
        >
          {/* Reply indicator - shown above input when replying */}
          {replyingTo && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              marginBottom: '12px',
              padding: '8px 12px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#9CA3AF',
              opacity: 1,
              transform: 'translateY(0)',
              transition: 'all 0.3s ease'
            }}>
              <span>Répondre à {replyingTo.username}</span>
              <button
                onClick={() => {
                  setReplyingTo(null);
                  setCommentText('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9CA3AF',
                  cursor: 'pointer',
                  padding: '2px'
                }}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div style={{ 
            display: 'flex', 
            alignItems: 'flex-end', 
            gap: '12px',
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderRadius: '20px',
            padding: '8px 16px',
            border: '1px solid rgba(255,255,255,0.1)',
            minHeight: '44px',
            transition: 'all 0.3s ease'
          }}>
            {/* Text Input */}
            <div style={{ flex: 1 }}>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={replyingTo ? `Répondre à ${replyingTo.username}...` : 'Commenter...'}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'white',
                  fontSize: '14px',
                  resize: 'none',
                  minHeight: '20px',
                  maxHeight: isCommentEditorFocused || commentText.trim() ? '120px' : '20px',
                  paddingTop: '2px',
                  paddingBottom: '2px',
                  fontFamily: 'inherit',
                  lineHeight: '1.4',
                  transition: 'max-height 0.3s ease',
                  overflowY: 'auto'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCommentSubmit();
                  }
                }}
                onFocus={() => {
                  setIsCommentEditorFocused(true);
                }}
                onBlur={() => {
                  setTimeout(() => setIsCommentEditorFocused(false), 150);
                }}
              />
            </div>
            
            {/* Action Buttons - Always show send button, formatting buttons only when active */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              marginLeft: '8px'
            }}>
              {/* Formatting Buttons - Only show when focused or has content */}
              {(isCommentEditorFocused || commentText.trim()) && (
                <div style={{ 
                  display: 'flex', 
                  gap: '4px',
                  borderRight: '1px solid rgba(255,255,255,0.2)',
                  paddingRight: '8px',
                  opacity: 1,
                  transform: 'translateX(0)',
                  transition: 'all 0.3s ease'
                }}>
                  <button 
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#9CA3AF',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      padding: '4px 6px',
                      borderRadius: '4px',
                      minWidth: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    B
                  </button>
                  <button 
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#9CA3AF',
                      fontSize: '12px',
                      fontStyle: 'italic',
                      cursor: 'pointer',
                      padding: '4px 6px',
                      borderRadius: '4px',
                      minWidth: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    I
                  </button>
                  <button 
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#9CA3AF',
                      fontSize: '12px',
                      cursor: 'pointer',
                      padding: '4px 6px',
                      borderRadius: '4px',
                      minWidth: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    😊
                  </button>
                </div>
              )}
              
              {/* Send Button - Always visible */}
              <button
                onClick={handleCommentSubmit}
                disabled={!commentText.trim() || interactMutation.isPending}
                style={{
                  background: commentText.trim() ? '#3B82F6' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: commentText.trim() ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s ease',
                  color: 'white',
                  transform: 'rotate(0deg)'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 12L21 3L12 21L9 12L3 12Z" fill="currentColor"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay des réponses */}
      {repliesOverlay.isVisible && repliesOverlay.commentId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Header de l'overlay */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #2a2a2a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#1a1a1a',
            position: 'sticky',
            top: 0
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              gap: '12px'
            }}>
              <button 
                onClick={closeRepliesOverlay}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '8px'
                }}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div style={{ 
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                color: 'white',
                fontSize: '12px'
              }}>
                {(repliesOverlay.parentComment?.user?.username || repliesOverlay.parentComment?.username)?.charAt(0).toUpperCase() || '?'}
              </div>
              <div>
                <div style={{ 
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: '600'
                }}>
                  Réponses à {repliesOverlay.parentComment?.user?.username || repliesOverlay.parentComment?.username}
                </div>
                <div style={{ 
                  color: '#8A8A8A',
                  fontSize: '12px'
                }}>
                  {getRepliesForComment(repliesOverlay.commentId).length} réponse{getRepliesForComment(repliesOverlay.commentId).length > 1 ? 's' : ''}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ 
                color: 'rgba(255,255,255,0.6)', 
                fontSize: '12px',
                fontWeight: '500'
              }}>
                Appuyez sur Échap pour fermer
              </span>
              <button 
                onClick={closeRepliesOverlay}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Commentaire parent */}
          <div style={{
            padding: '20px',
            borderBottom: '1px solid #2a2a2a',
            backgroundColor: '#1a1a1a'
          }}>
            <div style={{ 
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}>
              <div style={{ 
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                color: 'white',
                fontSize: '14px'
              }}>
                {(repliesOverlay.parentComment?.user?.username || repliesOverlay.parentComment?.username)?.charAt(0).toUpperCase() || '?'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ 
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '600',
                  marginBottom: '4px'
                }}>
                  {repliesOverlay.parentComment?.user?.username || repliesOverlay.parentComment?.username}
                </div>
                <div style={{ 
                  color: '#e0e0e0',
                  fontSize: '14px',
                  lineHeight: '1.4',
                  marginBottom: '8px'
                }}>
                  {repliesOverlay.parentComment?.content}
                </div>
                <div style={{ 
                  color: '#8A8A8A',
                  fontSize: '12px'
                }}>
                  {formatDistanceToNow(new Date(repliesOverlay.parentComment?.createdAt), { 
                    addSuffix: true, 
                    locale: fr 
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Liste des réponses */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0'
          }}>
            {getOrganizedReplies(repliesOverlay.commentId).map((reply: any) => {
              const isReplyOwner = reply.userId === user?.id;
              
              // Déterminer si c'est une réponse directe ou une réponse à une réponse
              const tagMatch = reply.content.match(/^@(\w+)/);
              const parentComment = repliesOverlay.parentComment;
              const parentUsername = parentComment?.user?.username || parentComment?.username;
              const isDirectReply = tagMatch && tagMatch[1] === parentUsername;
              
              return (
                <div key={reply.id} style={{ 
                  display: 'flex',
                  padding: '16px 20px',
                  paddingLeft: isDirectReply ? '20px' : '40px', // Indentation pour les réponses aux réponses
                  borderBottom: '1px solid #2a2a2a',
                  transition: 'background-color 0.2s',
                  backgroundColor: isDirectReply ? 'transparent' : '#1a1a1a' // Fond légèrement différent
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#252525'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = isDirectReply ? 'transparent' : '#1a1a1a'}
                >
                  {/* Avatar réponse */}
                  <div style={{ 
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    marginRight: '12px',
                    flexShrink: 0,
                    background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    color: 'white',
                    fontSize: '12px'
                  }}>
                    {(reply.user?.username || reply.username)?.charAt(0).toUpperCase() || '?'}
                  </div>
                  
                  {/* Contenu réponse */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      marginBottom: '4px' 
                    }}>
                      <span style={{ 
                        fontWeight: '600',
                        color: '#ffffff',
                        marginRight: '8px',
                        fontSize: '14px'
                      }}>
                        {reply.user?.username || reply.username}
                      </span>
                      <span style={{ 
                        color: '#8A8A8A',
                        fontSize: '12px'
                      }}>
                        {formatDistanceToNow(new Date(reply.createdAt), { 
                          addSuffix: true, 
                          locale: fr 
                        })}
                      </span>
                    </div>
                    
                    <div style={{ 
                      color: '#e0e0e0',
                      lineHeight: '1.4',
                      marginBottom: '8px',
                      fontSize: '14px',
                      wordWrap: 'break-word'
                    }}>
                      {reply.content}
                    </div>
                    
                    <div style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      fontSize: '12px',
                      color: '#8A8A8A'
                    }}>
                      <button 
                        onClick={() => {
                          // Répondre à la réponse spécifique, pas au commentaire parent
                          const replyUsername = reply.user?.username || reply.username;
                          setReplyingTo({ commentId: repliesOverlay.commentId!, username: replyUsername });
                          setCommentText(`@${replyUsername} `);
                          // Ne pas fermer l'overlay pour rester dans la section des réponses
                        }}
                        style={{ 
                          background: 'none',
                          border: 'none',
                          color: '#8A8A8A',
                          cursor: 'pointer',
                          fontSize: '12px',
                          transition: 'color 0.2s',
                          textDecoration: 'none'
                        }}
                        onMouseOver={(e) => (e.target as HTMLElement).style.color = '#ffffff'}
                        onMouseOut={(e) => (e.target as HTMLElement).style.color = '#8A8A8A'}
                      >
                        Répondre
                      </button>
                      
                      {/* Bouton de like pour les réponses */}
                      <div style={{ 
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px'
                      }}>
                        <button 
                          onClick={() => handleLikeComment(reply.id)}
                          style={{ 
                            background: 'none',
                            border: 'none',
                            color: isCommentLikedByUser(reply.id) ? '#ff6b6b' : '#8A8A8A',
                            cursor: 'pointer',
                            fontSize: '14px',
                            transition: 'color 0.2s',
                            padding: '2px'
                          }}
                          onMouseOver={(e) => (e.target as HTMLElement).style.color = '#ff6b6b'}
                          onMouseOut={(e) => (e.target as HTMLElement).style.color = isCommentLikedByUser(reply.id) ? '#ff6b6b' : '#8A8A8A'}
                        >
                          {isCommentLikedByUser(reply.id) ? '❤️' : '🤍'}
                        </button>
                        <span style={{ 
                          fontSize: '10px',
                          color: '#8A8A8A',
                          minWidth: '16px',
                          textAlign: 'center'
                        }}>
                          {getCommentLikesCount(reply.id)}
                        </span>
                      </div>
                      {isReplyOwner && (
                        <button 
                          onClick={() => handleDeleteComment(reply.id)}
                          style={{ 
                            background: 'none',
                            border: 'none',
                            color: '#EF4444',
                            cursor: 'pointer',
                            fontSize: '12px',
                            transition: 'color 0.2s',
                            textDecoration: 'none'
                          }}
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Colonne droite réponse avec like */}
                  <div style={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    marginLeft: '8px'
                  }}>
                    <button 
                      onClick={() => handleLikeComment(reply.id)}
                      style={{ 
                        background: 'none',
                        border: 'none',
                        color: '#8A8A8A',
                        cursor: 'pointer',
                        fontSize: '16px',
                        transition: 'color 0.2s',
                        padding: '4px'
                      }}
                      onMouseOver={(e) => (e.target as HTMLElement).style.color = '#ff6b6b'}
                      onMouseOut={(e) => (e.target as HTMLElement).style.color = '#8A8A8A'}
                    >
                      🤍
                    </button>
                    <span style={{ 
                      fontSize: '11px',
                      color: '#8A8A8A',
                      minWidth: '20px',
                      textAlign: 'center'
                    }}>
                      {reply.likesCount || 0}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Zone de réponse dans l'overlay */}
          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid #2a2a2a',
            backgroundColor: '#1a1a1a'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'flex-end', 
              gap: '12px',
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderRadius: '20px',
              padding: '8px 16px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div style={{ flex: 1 }}>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={replyingTo ? `Répondre à ${replyingTo.username}...` : `Répondre à ${repliesOverlay.parentComment?.user?.username || repliesOverlay.parentComment?.username}...`}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'white',
                    fontSize: '14px',
                    resize: 'none',
                    minHeight: '20px',
                    maxHeight: '120px',
                    paddingTop: '2px',
                    paddingBottom: '2px',
                    fontFamily: 'inherit',
                    lineHeight: '1.4',
                    overflowY: 'auto'
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleCommentSubmit();
                    }
                  }}
                />
              </div>
              <button 
                onClick={handleCommentSubmit}
                disabled={!commentText.trim()}
                style={{
                  background: commentText.trim() ? 'var(--emotion-color)' : 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: commentText.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  color: 'white',
                  transition: 'all 0.2s'
                }}
              >
                ↗
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Boîte de confirmation de suppression */}
      {deleteConfirmation.show && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '400px',
            width: '100%',
            border: '1px solid #333333',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <div style={{
                backgroundColor: '#EF4444',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '12px'
              }}>
                <Trash2 size={20} color="white" />
              </div>
              <div>
                <h3 style={{
                  color: 'white',
                  fontSize: '18px',
                  fontWeight: '600',
                  margin: '0 0 4px 0'
                }}>
                  Supprimer le commentaire
                </h3>
                <p style={{
                  color: '#8A8A8A',
                  fontSize: '14px',
                  margin: '0'
                }}>
                  Cette action est irréversible
                </p>
              </div>
            </div>

            <div style={{
              backgroundColor: '#2a2a2a',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '20px',
              border: '1px solid #333333'
            }}>
              <p style={{
                color: '#e0e0e0',
                fontSize: '14px',
                margin: '0',
                fontStyle: 'italic',
                lineHeight: '1.4'
              }}>
                "{deleteConfirmation.commentContent.length > 100 
                  ? deleteConfirmation.commentContent.substring(0, 100) + '...' 
                  : deleteConfirmation.commentContent}"
              </p>
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={cancelDeleteComment}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid #333333',
                  color: '#ffffff',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#333333';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Annuler
              </button>
              <button
                onClick={confirmDeleteComment}
                style={{
                  backgroundColor: '#EF4444',
                  border: 'none',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#DC2626';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#EF4444';
                }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

export default GbairaiCardMobile;