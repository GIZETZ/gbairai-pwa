import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { EmotionAnalysisService } from "./services/emotionAnalysis";
import { ContentValidationService } from "./services/contentValidation";
import { moderateContent } from "./services/contentModeration";
import { insertGbairaiSchema, insertInteractionSchema, insertMessageSchema } from "@shared/schema";
import { z } from "zod";
import OpenAI from "openai";
import multer from "multer";
import path from "path";
import { promises as fs } from "fs";
import express from "express";
import { healthCheck } from './health';

// Middleware pour vérifier l'authentification
function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentification requise" });
  }
  next();
}

// Declaration pour TypeScript
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      email: string;
      role: string;
    }
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Configuration de l'authentification
  setupAuth(app);

  // Service d'analyse d'émotion
  const emotionService = EmotionAnalysisService.getInstance();
  const validationService = new ContentValidationService();

  // Configuration multer pour l'upload des fichiers
  const storage_multer = multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads');
      try {
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      } catch (error) {
        cb(error as Error, uploadDir);
      }
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    }
  });

  const fileFilter = (req: any, file: any, cb: any) => {
    const allowedTypes = [
      'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/mp3', 
      'audio/webm', 'audio/mp4', 'audio/aac', 'audio/flac'
    ];

    console.log('Type de fichier reçu:', file.mimetype);

    // Vérifier si c'est un type audio (même avec des codecs)
    const isAudioFile = allowedTypes.includes(file.mimetype) || file.mimetype.startsWith('audio/');

    if (isAudioFile) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers audio sont autorisés'), false);
    }
  };

  const upload = multer({
    storage: storage_multer,
    fileFilter,
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB maximum
    }
  });

  // Servir les fichiers uploadés
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Routes d'analyse
  app.post("/api/analyze-emotion", async (req, res) => {
    try {
      const { text, language = 'fr-ci' } = req.body;

      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Texte requis' });
      }

      const result = await emotionService.analyzeEmotion(text, language);

      res.json({
        success: true,
        emotion: result.emotion,
        confidence: result.confidence,
        suggestions: result.suggestions,
        localTerms: result.localTerms
      });
    } catch (error) {
      console.error('Erreur analyse émotion:', error);
      res.status(500).json({ error: 'Erreur lors de l\'analyse' });
    }
  });

  app.post("/api/validate-content", async (req, res) => {
    try {
      const { content } = req.body;

      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: 'Contenu requis' });
      }

      const result = await validationService.validateContent(content);
      res.json(result);
    } catch (error) {
      console.error('Erreur validation contenu:', error);
      res.status(500).json({ error: 'Erreur lors de la validation' });
    }
  });

  // Endpoint pour tester la modération de contenu
  app.post("/api/moderate-content", async (req, res) => {
    try {
      const { content } = req.body;

      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: 'Contenu requis' });
      }

      const result = await moderateContent(content);
      res.json(result);
    } catch (error) {
      console.error('Erreur modération contenu:', error);
      res.status(500).json({ error: 'Erreur lors de la modération' });
    }
  });

  // Routes Gbairais
  app.get("/api/gbairais", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const emotion = req.query.emotion as string;
      const region = req.query.region as string;
      const followingOnly = req.query.followingOnly === 'true';
      const userId = req.user?.id;

      let gbairais;
      
      if (followingOnly && userId) {
        // Récupérer les gbairais des utilisateurs suivis
        gbairais = await storage.getGbairaisFromFollowing(userId, limit, offset);
      } else if (region) {
        // Filtrer par région de Côte d'Ivoire
        gbairais = await storage.getGbairaisByRegion(region, limit, offset);
      } else if (emotion) {
        gbairais = await storage.getGbairaisByEmotion(emotion, limit);
      } else {
        gbairais = await storage.getGbairais(limit, offset);
      }

      res.json(gbairais);
    } catch (error) {
      console.error('Erreur récupération gbairais:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération' });
    }
  });

  // Route pour récupérer un Gbairai individuel
  app.get("/api/gbairais/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: 'ID invalide' });
      }

      const gbairai = await storage.getGbairaiById(id);

      if (!gbairai) {
        return res.status(404).json({ error: 'Gbairai non trouvé' });
      }

      res.json(gbairai);
    } catch (error) {
      console.error('Erreur récupération gbairai:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération' });
    }
  });



  app.post("/api/gbairais", requireAuth, async (req, res) => {
    try {
      console.log('Données reçues:', req.body);
      console.log('Utilisateur:', req.user);
      
      const validationResult = insertGbairaiSchema.safeParse(req.body);
      if (!validationResult.success) {
        console.log('Erreur validation:', validationResult.error.issues);
        return res.status(400).json({ 
          error: 'Données invalides',
          details: validationResult.error.issues 
        });
      }

      const { content, emotion, location, isAnonymous } = validationResult.data;

      // Étape 1: Modération du contenu avec IA et liste noire
      const moderationResult = await moderateContent(content);
      if (!moderationResult.approved) {
        return res.status(400).json({
          error: 'Contenu modéré',
          message: moderationResult.reason,
          suggestion: moderationResult.suggestion,
          foundWords: moderationResult.foundWords
        });
      }

      // Étape 2: Validation du contenu (format, longueur, etc.)
      const contentValidation = await validationService.validateContent(content);
      if (!contentValidation.isValid) {
        return res.status(400).json({
          error: 'Contenu invalide',
          issues: contentValidation.issues,
          suggestions: contentValidation.suggestedChanges
        });
      }

      // Créer le Gbairai
      const gbairai = await storage.createGbairai({
        userId: req.user?.id,
        content,
        emotion,
        location,
        isAnonymous: isAnonymous !== false,
        metadata: {}
      });

      // Envoyer notification à tous les utilisateurs
      const authorName = isAnonymous !== false ? "Quelqu'un" : req.user?.username || "Un utilisateur";
      const notificationMessage = `${authorName} a publié un nouveau gbairai avec l'émotion "${emotion}"`;
      
      try {
        await storage.createNotificationForAllUsers(
          'new_post',
          notificationMessage,
          req.user?.id,
          gbairai.id,
          req.user?.id // Exclure l'auteur
        );
        console.log(`Notifications envoyées pour le gbairai ${gbairai.id}`);
      } catch (error) {
        console.error('Erreur envoi notifications:', error);
        // Ne pas faire échouer la création du gbairai si les notifications échouent
      }

      res.status(201).json(gbairai);
    } catch (error) {
      console.error('Erreur création gbairai:', error);
      res.status(500).json({ error: 'Erreur lors de la création' });
    }
  });

  app.delete("/api/gbairais/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteGbairai(id, req.user?.id || 0);

      if (!success) {
        return res.status(404).json({ error: 'Gbairai non trouvé ou non autorisé' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Erreur suppression gbairai:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
  });

  // Routes d'interaction
  app.post("/api/gbairais/:id/interact", requireAuth, async (req, res) => {
    try {
      const gbairaiId = parseInt(req.params.id);
      const { type, content } = req.body;

      if (!['like', 'comment', 'share'].includes(type)) {
        return res.status(400).json({ error: 'Type d\'interaction invalide' });
      }

      // Vérifier si l'interaction existe déjà pour les likes
      if (type === 'like') {
        const existingInteraction = await storage.getUserInteraction(
          req.user?.id || 0,
          gbairaiId,
          'like'
        );

        if (existingInteraction) {
          // Supprimer le like existant
          await storage.deleteInteraction(existingInteraction.id, req.user?.id || 0);
          return res.json({ success: true, action: 'unliked' });
        }
      }

      // Modération du contenu pour les commentaires
      if (type === 'comment' && content) {
        const moderationResult = await moderateContent(content);
        if (!moderationResult.approved) {
          return res.status(400).json({
            error: 'Contenu modéré',
            message: moderationResult.reason,
            suggestion: moderationResult.suggestion,
            foundWords: moderationResult.foundWords
          });
        }
      }

      // Créer l'interaction
      const interaction = await storage.createInteraction({
        userId: req.user?.id || 0,
        gbairaiId,
        type,
        content: content || null,
        parentCommentId: req.body.parentCommentId || null
      });

      // Créer une notification pour le propriétaire du Gbairai
      const gbairai = await storage.getGbairaiById(gbairaiId);
      if (gbairai && gbairai.userId !== req.user?.id) {
        const currentUser = await storage.getUser(req.user?.id || 0);
        let notificationMessage = '';
        
        switch (type) {
          case 'like':
            notificationMessage = `${currentUser?.username} a aimé votre Gbairai`;
            break;
          case 'comment':
            notificationMessage = `${currentUser?.username} a commenté votre Gbairai`;
            break;
          case 'share':
            notificationMessage = `${currentUser?.username} a partagé votre Gbairai`;
            break;
        }

        if (notificationMessage) {
          await storage.createNotification({
            userId: gbairai.userId,
            type: type as 'like' | 'comment',
            fromUserId: req.user?.id,
            gbairaiId,
            message: notificationMessage
          });
        }
      }

      res.status(201).json({ success: true, interaction, action: 'created' });
    } catch (error) {
      console.error('Erreur création interaction:', error);
      res.status(500).json({ error: 'Erreur lors de l\'interaction' });
    }
  });

  // Routes de localisation
  app.get("/api/gbairais/nearby", requireAuth, async (req, res) => {
    try {
      const { latitude, longitude, radius = 10 } = req.query;

      if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Coordonnées requises' });
      }

      const location = {
        latitude: parseFloat(latitude as string),
        longitude: parseFloat(longitude as string),
        city: '',
        region: '',
        country: 'Côte d\'Ivoire'
      };

      const gbairais = await storage.getGbairaisByLocation(
        location,
        parseFloat(radius as string),
        20
      );

      res.json(gbairais);
    } catch (error) {
      console.error('Erreur récupération gbairais proches:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération' });
    }
  });

  // Routes utilisateur
  app.get("/api/users/:id/gbairais", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const gbairais = await storage.getUserGbairais(userId, 20);

      res.json(gbairais);
    } catch (error) {
      console.error('Erreur récupération gbairais utilisateur:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération' });
    }
  });

  app.put("/api/users/profile", requireAuth, async (req, res) => {
    try {
      const { username, email } = req.body;

      // Validate input
      if (!username || !email) {
        return res.status(400).json({ error: "Username and email are required" });
      }

      // Check if username is already taken by another user
      const existingUserByUsername = await storage.getUserByUsername(username);
      if (existingUserByUsername && existingUserByUsername.id !== req.user?.id) {
        return res.status(400).json({ error: "Ce nom d'utilisateur est déjà pris" });
      }

      // Check if email is already taken by another user
      const existingUserByEmail = await storage.getUserByEmail(email);
      if (existingUserByEmail && existingUserByEmail.id !== req.user?.id) {
        return res.status(400).json({ error: "Cette adresse email est déjà utilisée" });
      }

      // Update user profile
      const updatedUser = await storage.updateUser(req.user?.id || 0, { username, email });

      if (!updatedUser) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ error: "Erreur interne du serveur" });
    }
  });

  // Route pour récupérer les commentaires d'un Gbairai
  app.get("/api/gbairais/:id/comments", async (req, res) => {
    try {
      const gbairaiId = parseInt(req.params.id);
      const comments = await storage.getInteractionsByGbairai(gbairaiId);

      // Filtrer seulement les commentaires principaux (pas les likes/shares et pas les réponses)
      const mainCommentsOnly = comments.filter(comment => 
        comment.type === 'comment' && !comment.parentCommentId
      );

      res.json(mainCommentsOnly);
    } catch (error) {
      console.error('Erreur récupération commentaires:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des commentaires' });
    }
  });

  // Route pour récupérer les réponses d'un commentaire spécifique
  app.get("/api/comments/:id/replies", async (req, res) => {
    try {
      const commentId = parseInt(req.params.id);
      const replies = await storage.getRepliesByCommentId(commentId);

      res.json(replies);
    } catch (error) {
      console.error('Erreur récupération réponses:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des réponses' });
    }
  });

  // Route pour supprimer une interaction/commentaire
  app.delete("/api/interactions/:id", requireAuth, async (req, res) => {
    try {
      const interactionId = parseInt(req.params.id);
      const userId = req.user?.id || 0;

      const success = await storage.deleteInteraction(interactionId, userId);

      if (success) {
        res.json({ message: 'Interaction supprimée avec succès' });
      } else {
        res.status(404).json({ error: 'Interaction non trouvée ou non autorisée' });
      }
    } catch (error) {
      console.error('Erreur suppression interaction:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
  });

  // Route pour traduire du texte avec OpenAI
  app.post("/api/translate", requireAuth, async (req, res) => {
    try {
      const { text } = req.body;

      if (!text) {
        return res.status(400).json({ error: 'Texte requis' });
      }

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "Tu es un traducteur professionnel. Traduis le texte suivant en français standard si c'est en nouchi ou en langue locale ivoirienne, ou en nouchi/français local si c'est en français standard. Garde le sens et l'émotion du message original."
          },
          {
            role: "user",
            content: text
          }
        ],
        max_tokens: 200,
        temperature: 0.3,
      });

      const translatedText = response.choices[0].message.content;

      res.json({ translatedText });
    } catch (error) {
      console.error('Erreur traduction:', error);
      res.status(500).json({ error: 'Erreur lors de la traduction' });
    }
  });

  // Route pour signaler du contenu
  app.post("/api/reports", requireAuth, async (req, res) => {
    try {
      const { type, targetId, reason } = req.body;
      const userId = req.user?.id || 0;

      // Pour le moment, on simule juste l'enregistrement du signalement
      // En production, on enregistrerait cela dans une table de signalements
      console.log('Signalement reçu:', {
        userId,
        type,
        targetId,
        reason,
        timestamp: new Date().toISOString()
      });

      res.json({ message: 'Signalement enregistré avec succès' });
    } catch (error) {
      console.error('Erreur signalement:', error);
      res.status(500).json({ error: 'Erreur lors du signalement' });
    }
  });

  // Routes de messagerie
  // Récupérer tous les utilisateurs (authentifié - pour la messagerie)
  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error('Erreur récupération utilisateurs:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
    }
  });

  // Endpoint pour la recherche d'utilisateurs (public)
  app.get("/api/users/search", async (req, res) => {
    try {
      const { q } = req.query;
      const currentUserId = req.user?.id;

      if (!q || typeof q !== 'string') {
        return res.json([]);
      }

      const users = await storage.searchUsers(q, currentUserId);

      res.json(users);
    } catch (error) {
      console.error('Erreur recherche utilisateurs:', error);
      res.status(500).json({ error: 'Erreur lors de la recherche des utilisateurs' });
    }
  });

  // Route pour obtenir le profil d'un utilisateur
  app.get("/api/users/:id/profile", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const profile = await storage.getUserProfile(userId);

      if (!profile) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      res.json(profile);
    } catch (error) {
      console.error('Erreur récupération profil:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
    }
  });

  // Route pour mettre à jour le profil d'un utilisateur
  app.put("/api/users/profile", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Utilisateur non authentifié' });
      }

      const { bio, location, website, avatar } = req.body;
      const profileData = { bio, location, website, avatar };

      const updatedUser = await storage.updateUserProfile(userId, profileData);

      if (!updatedUser) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error('Erreur mise à jour profil:', error);
      res.status(500).json({ error: 'Erreur lors de la mise à jour du profil' });
    }
  });

  // Route pour suivre un utilisateur
  app.post("/api/users/:id/follow", requireAuth, async (req, res) => {
    try {
      const followingId = parseInt(req.params.id);
      const followerId = req.user?.id;

      if (!followerId) {
        return res.status(401).json({ error: 'Utilisateur non authentifié' });
      }

      if (followerId === followingId) {
        return res.status(400).json({ error: 'Vous ne pouvez pas vous suivre vous-même' });
      }

      // Vérifier si l'utilisateur suit déjà
      const isAlreadyFollowing = await storage.isFollowing(followerId, followingId);

      if (isAlreadyFollowing) {
        return res.status(400).json({ error: 'Vous suivez déjà cet utilisateur' });
      }

      const follow = await storage.followUser(followerId, followingId);

      res.status(201).json(follow);
    } catch (error) {
      console.error('Erreur follow utilisateur:', error);
      res.status(500).json({ error: 'Erreur lors du suivi' });
    }
  });

  // Route pour ne plus suivre un utilisateur
  app.delete("/api/users/:id/follow", requireAuth, async (req, res) => {
    try {
      const followingId = parseInt(req.params.id);
      const followerId = req.user?.id;

      if (!followerId) {
        return res.status(401).json({ error: 'Utilisateur non authentifié' });
      }

      const success = await storage.unfollowUser(followerId, followingId);

      if (!success) {
        return res.status(404).json({ error: 'Vous ne suivez pas cet utilisateur' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Erreur unfollow utilisateur:', error);
      res.status(500).json({ error: 'Erreur lors de l\'arrêt du suivi' });
    }
  });

  // Route pour obtenir les followers d'un utilisateur
  app.get("/api/users/:id/followers", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const followers = await storage.getUserFollowers(userId);

      res.json(followers);
    } catch (error) {
      console.error('Erreur récupération followers:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des abonnés' });
    }
  });

  // Route pour obtenir les utilisateurs suivis
  app.get("/api/users/:id/following", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const following = await storage.getUserFollowing(userId);

      res.json(following);
    } catch (error) {
      console.error('Erreur récupération following:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des abonnements' });
    }
  });

  // Route pour obtenir les gbairais d'un utilisateur
  app.get("/api/users/:id/gbairais", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const gbairais = await storage.getUserGbairais(userId);

      res.json(gbairais);
    } catch (error) {
      console.error('Erreur récupération gbairais utilisateur:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des gbairais' });
    }
  });

  // Créer une nouvelle conversation
  app.post("/api/conversations", requireAuth, async (req, res) => {
    try {
      const { recipientId } = req.body;
      const userId = req.user?.id || 0;

      if (!recipientId || recipientId === userId) {
        return res.status(400).json({ error: 'ID destinataire invalide' });
      }

      // Vérifier si une conversation existe déjà
      const participants = [userId, recipientId].sort();
      const existingConversation = await storage.getConversationByParticipants(participants);

      if (existingConversation) {
        return res.json(existingConversation);
      }

      // Créer une nouvelle conversation
      const newConversation = await storage.createConversation({
        participants,
        isEncrypted: true,
      });

      res.status(201).json(newConversation);
    } catch (error) {
      console.error('Erreur création conversation:', error);
      res.status(500).json({ error: 'Erreur lors de la création de la conversation' });
    }
  });

  // Récupérer les détails d'une conversation spécifique
  app.get("/api/conversations/:id", requireAuth, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const userId = req.user?.id || 0;

      const conversation = await storage.getConversationById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation non trouvée' });
      }

      const participants = conversation.participants as number[];
      if (!participants.includes(userId)) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      // Enrichir avec les informations des participants
      const participantsData = await Promise.all(
        participants.map(async (id) => {
          const user = await storage.getUser(id);
          return user ? { id: user.id, username: user.username, email: user.email } : null;
        })
      );

      const enrichedConversation = {
        ...conversation,
        participants: participantsData.filter(Boolean),
        unreadCount: 0,
      };

      res.json(enrichedConversation);
    } catch (error) {
      console.error('Erreur récupération conversation:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération de la conversation' });
    }
  });

  // Récupérer les conversations d'un utilisateur
  app.get("/api/conversations", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id || 0;
      const conversations = await storage.getConversationsByUserId(userId);

      // Enrichir les conversations avec les informations des participants
      const enrichedConversations = await Promise.all(
        conversations.map(async (conversation) => {
          const participants = conversation.participants as number[];
          const participantsData = await Promise.all(
            participants.map(async (id) => {
              const user = await storage.getUser(id);
              return user ? { id: user.id, username: user.username, email: user.email } : null;
            })
          );

          // Récupérer le dernier message
          const messages = await storage.getMessagesByConversationId(conversation.id);
          const lastMessage = messages[messages.length - 1];

          return {
            ...conversation,
            participants: participantsData.filter(Boolean),
            lastMessage: lastMessage ? {
              content: lastMessage.content,
              timestamp: lastMessage.createdAt,
              senderId: lastMessage.senderId,
            } : null,
            unreadCount: 0, // À implémenter plus tard
          };
        })
      );

      res.json(enrichedConversations);
    } catch (error) {
      console.error('Erreur récupération conversations:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des conversations' });
    }
  });

  // Récupérer les messages d'une conversation
  app.get("/api/conversations/:id/messages", requireAuth, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const userId = req.user?.id || 0;

      // Désactiver le cache pour cette route
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });



      // Vérifier que l'utilisateur fait partie de la conversation
      const conversation = await storage.getConversationById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation non trouvée' });
      }

      const participants = conversation.participants as number[];
      if (!participants.includes(userId)) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      const messages = await storage.getMessagesByConversationId(conversationId);


      res.json(messages);
    } catch (error) {
      console.error('Erreur récupération messages:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des messages' });
    }
  });

  // Envoyer un message texte
  app.post("/api/conversations/:id/messages", requireAuth, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const userId = req.user?.id || 0;
      const { content, type = 'text' } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ error: 'Contenu du message requis' });
      }



      // Vérifier que l'utilisateur fait partie de la conversation
      const conversation = await storage.getConversationById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation non trouvée' });
      }

      const participants = conversation.participants as number[];
      if (!participants.includes(userId)) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      // Créer le message
      const newMessage = await storage.createMessage({
        conversationId,
        senderId: userId,
        content: content.trim(),
        type,
      });



      res.status(201).json(newMessage);
    } catch (error) {
      console.error('Erreur envoi message:', error);
      res.status(500).json({ error: 'Erreur lors de l\'envoi du message' });
    }
  });

  // Envoyer un message avec fichier
  app.post("/api/conversations/:id/messages/upload", requireAuth, upload.single('file'), async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const userId = req.user?.id || 0;
      const { content = '', type } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'Fichier requis' });
      }

      // Vérifier que l'utilisateur fait partie de la conversation
      const conversation = await storage.getConversationById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation non trouvée' });
      }

      const participants = conversation.participants as number[];
      if (!participants.includes(userId)) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      // Déterminer le type de message selon le type de fichier
      let messageType = type;
      if (!messageType) {
        if (file.mimetype.startsWith('audio/')) {
          messageType = 'audio';
        } else {
          messageType = 'file';
        }
      }

      // Créer le message avec les métadonnées du fichier
      const newMessage = await storage.createMessage({
        conversationId,
        senderId: userId,
        content: content<previous_generation> || file.originalname,
        type: messageType,
        fileUrl: `/uploads/${file.filename}`,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
        }
      });

      res.status(201).json(newMessage);
    } catch (error) {
      console.error('Erreur envoi message fichier:', error);
      res.status(500).json({ error: 'Erreur lors de l\'envoi du message avec fichier' });
    }
  });

  // Routes pour les notifications
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id || 0;
      const since = req.query.since ? new Date(req.query.since as string) : undefined;

      const notifications = await storage.getNotifications(userId, 20);

      // Ajouter un header pour indiquer s'il y a de nouvelles notifications
      const hasNewNotifications = notifications.some(n => !n.read);
      res.setHeader('X-Has-New-Notifications', hasNewNotifications.toString());

      res.json(notifications);
    } catch (error) {
      console.error('Erreur récupération notifications:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des notifications' });
    }
  });

  // Marquer une notification comme lue
  app.put("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      const userId = req.user?.id || 0;

      await storage.markNotificationAsRead(notificationId);

      res.json({ success: true });
    } catch (error) {
      console.error('Erreur marquage notification lue:', error);
      res.status(500).json({ error: 'Erreur lors du marquage comme lu' });
    }
  });

  // Marquer toutes les notifications comme lues
  app.put("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id || 0;

      // Marquer toutes les notifications comme lues pour l'utilisateur
      const userNotifications = await storage.getNotifications(userId, 100);
      for (const notification of userNotifications) {
        if (!notification.read) {
          await storage.markNotificationAsRead(notification.id);
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Erreur marquage toutes notifications lues:', error);
      res.status(500).json({ error: 'Erreur lors du marquage de toutes les notifications comme lues' });
    }
  });

  // Route de santé
  app.get("/api/health", (req, res) => {
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
