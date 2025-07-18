import { pgTable, text, serial, timestamp, boolean, jsonb, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").default("user"),
  createdAt: timestamp("created_at").defaultNow(),
  isActive: boolean("is_active").default(true),
  profile: jsonb("profile"),
});

export const gbairais = pgTable("gbairais", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  content: text("content").notNull(),
  emotion: text("emotion").notNull(),
  location: jsonb("location"),
  isAnonymous: boolean("is_anonymous").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  status: text("status").default("active"),
  metadata: jsonb("metadata"),
});

export const interactions = pgTable("interactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  gbairaiId: integer("gbairai_id").references(() => gbairais.id),
  type: text("type").notNull(), // like, comment, share
  content: text("content"),
  parentCommentId: integer("parent_comment_id").references(() => interactions.id), // Pour les réponses
  createdAt: timestamp("created_at").defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  participants: jsonb("participants").notNull(),
  isEncrypted: boolean("is_encrypted").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  lastMessageAt: timestamp("last_message_at"),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => conversations.id),
  senderId: integer("sender_id").references(() => users.id),
  content: text("content").notNull(),
  type: text("type").default("text"), // text, image, audio, file
  fileUrl: text("file_url"), // URL du fichier pour les médias
  fileName: text("file_name"), // Nom original du fichier
  fileSize: integer("file_size"), // Taille en bytes
  mimeType: text("mime_type"), // Type MIME du fichier
  duration: integer("duration"), // Durée en secondes pour les audios
  metadata: jsonb("metadata"), // Métadonnées additionnelles
  createdAt: timestamp("created_at").defaultNow(),
});

export const follows = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").references(() => users.id).notNull(),
  followingId: integer("following_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  gbairais: many(gbairais),
  interactions: many(interactions),
  messages: many(messages),
  following: many(follows, {
    relationName: 'following',
  }),
  followers: many(follows, {
    relationName: 'followers',
  }),
}));

export const gbairaisRelations = relations(gbairais, ({ one, many }) => ({
  user: one(users, {
    fields: [gbairais.userId],
    references: [users.id],
  }),
  interactions: many(interactions),
}));

export const interactionsRelations = relations(interactions, ({ one, many }) => ({
  user: one(users, {
    fields: [interactions.userId],
    references: [users.id],
  }),
  gbairai: one(gbairais, {
    fields: [interactions.gbairaiId],
    references: [gbairais.id],
  }),
  parentComment: one(interactions, {
    fields: [interactions.parentCommentId],
    references: [interactions.id],
  }),
  replies: many(interactions),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, {
    fields: [follows.followerId],
    references: [users.id],
    relationName: 'followers',
  }),
  following: one(users, {
    fields: [follows.followingId],
    references: [users.id],
    relationName: 'following',
  }),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
});

export const updateUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
}).partial();

export const userProfileSchema = z.object({
  bio: z.string().max(200).optional(),
  location: z.string().max(100).optional(),
  website: z.string().url().optional(),
  avatar: z.string().url().optional(),
});

export const insertFollowSchema = createInsertSchema(follows).omit({
  id: true,
  createdAt: true,
});

export const insertGbairaiSchema = createInsertSchema(gbairais).omit({
  id: true,
  createdAt: true,
  status: true,
});

export const insertInteractionSchema = createInsertSchema(interactions).omit({
  id: true,
  createdAt: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  lastMessageAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type Gbairai = typeof gbairais.$inferSelect;
export type InsertGbairai = z.infer<typeof insertGbairaiSchema>;
export type Interaction = typeof interactions.$inferSelect;
export type InsertInteraction = z.infer<typeof insertInteractionSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Follow = typeof follows.$inferSelect;
export type InsertFollow = z.infer<typeof insertFollowSchema>;

// Extended types for UI
export type GbairaiWithInteractions = Gbairai & {
  interactions: Interaction[];
  user?: User;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
};

export type UserWithStats = User & {
  followersCount: number;
  followingCount: number;
  gbairaisCount: number;
  isFollowing?: boolean;
};

export type LocationData = {
  latitude: number;
  longitude: number;
  city: string;
  region: string;
  country: string;
};

export type EmotionSuggestion = {
  emotion: string;
  confidence: number;
  reasoning: string;
};

export type EmotionAnalysisResult = {
  emotion: string;
  confidence: number;
  localTerms: string[];
  suggestions: EmotionSuggestion[];
};
