import { 
  users, 
  gbairais, 
  interactions, 
  conversations, 
  messages,
  follows,
  type User, 
  type InsertUser,
  type UpdateUser,
  type UserProfile,
  type UserWithStats,
  type Gbairai,
  type InsertGbairai,
  type GbairaiWithInteractions,
  type Interaction,
  type InsertInteraction,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type Follow,
  type InsertFollow,
  type LocationData
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import createMemoryStore from "memorystore";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);
const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: UpdateUser): Promise<User | undefined>;
  
  createGbairai(gbairai: InsertGbairai): Promise<Gbairai>;
  getGbairais(limit?: number, offset?: number): Promise<GbairaiWithInteractions[]>;
  getGbairaiById(id: number): Promise<GbairaiWithInteractions | undefined>;
  getGbairaisByEmotion(emotion: string, limit?: number): Promise<GbairaiWithInteractions[]>;
  getGbairaisByLocation(location: LocationData, radius: number, limit?: number): Promise<GbairaiWithInteractions[]>;
  getUserGbairais(userId: number, limit?: number): Promise<GbairaiWithInteractions[]>;
  deleteGbairai(id: number, userId: number): Promise<boolean>;
  
  createInteraction(interaction: InsertInteraction): Promise<Interaction>;
  getInteractionsByGbairai(gbairaiId: number): Promise<Interaction[]>;
  getUserInteraction(userId: number, gbairaiId: number, type: string): Promise<Interaction | undefined>;
  deleteInteraction(id: number, userId: number): Promise<boolean>;
  getRepliesByCommentId(commentId: number): Promise<Interaction[]>;
  
  // Messagerie
  getAllUsers(): Promise<User[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  getConversationsByUserId(userId: number): Promise<Conversation[]>;
  getConversationById(id: number): Promise<Conversation | undefined>;
  getConversationByParticipants(participants: number[]): Promise<Conversation | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  getMessagesByConversationId(conversationId: number): Promise<Message[]>;
  
  // Profils et follows
  getUserProfile(userId: number): Promise<UserWithStats | undefined>;
  updateUserProfile(userId: number, profile: UserProfile): Promise<User | undefined>;
  followUser(followerId: number, followingId: number): Promise<Follow>;
  unfollowUser(followerId: number, followingId: number): Promise<boolean>;
  isFollowing(followerId: number, followingId: number): Promise<boolean>;
  getUserFollowers(userId: number): Promise<User[]>;
  getUserFollowing(userId: number): Promise<User[]>;
  getUserStats(userId: number): Promise<{ followersCount: number; followingCount: number; gbairaisCount: number; }>;
  searchUsers(query: string, currentUserId?: number): Promise<UserWithStats[]>;
  
  sessionStore: any;
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true,
      tableName: 'session'
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: number, updateUser: UpdateUser): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updateUser)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async createGbairai(insertGbairai: InsertGbairai): Promise<Gbairai> {
    const [gbairai] = await db
      .insert(gbairais)
      .values(insertGbairai)
      .returning();
    return gbairai;
  }

  async getGbairais(limit = 20, offset = 0): Promise<GbairaiWithInteractions[]> {
    const gbairaisData = await db
      .select()
      .from(gbairais)
      .leftJoin(users, eq(gbairais.userId, users.id))
      .where(eq(gbairais.status, 'active'))
      .orderBy(desc(gbairais.createdAt))
      .limit(limit)
      .offset(offset);

    const gbairaisWithInteractions: GbairaiWithInteractions[] = [];

    for (const row of gbairaisData) {
      const gbairai = row.gbairais;
      const user = row.users;
      
      const interactionsData = await this.getInteractionsByGbairai(gbairai.id);
      
      const likesCount = interactionsData.filter(i => i.type === 'like').length;
      const commentsCount = interactionsData.filter(i => i.type === 'comment').length;
      const sharesCount = interactionsData.filter(i => i.type === 'share').length;

      gbairaisWithInteractions.push({
        ...gbairai,
        interactions: interactionsData,
        user: user || undefined,
        likesCount,
        commentsCount,
        sharesCount
      });
    }

    return gbairaisWithInteractions;
  }

  async getGbairaiById(id: number): Promise<GbairaiWithInteractions | undefined> {
    const [gbairaiData] = await db
      .select()
      .from(gbairais)
      .leftJoin(users, eq(gbairais.userId, users.id))
      .where(and(eq(gbairais.id, id), eq(gbairais.status, 'active')));

    if (!gbairaiData) return undefined;

    const gbairai = gbairaiData.gbairais;
    const user = gbairaiData.users;
    
    const interactionsData = await this.getInteractionsByGbairai(gbairai.id);
    
    const likesCount = interactionsData.filter(i => i.type === 'like').length;
    const commentsCount = interactionsData.filter(i => i.type === 'comment').length;
    const sharesCount = interactionsData.filter(i => i.type === 'share').length;

    return {
      ...gbairai,
      interactions: interactionsData,
      user: user || undefined,
      likesCount,
      commentsCount,
      sharesCount
    };
  }

  async getGbairaisByEmotion(emotion: string, limit = 20): Promise<GbairaiWithInteractions[]> {
    const gbairaisData = await db
      .select()
      .from(gbairais)
      .leftJoin(users, eq(gbairais.userId, users.id))
      .where(and(eq(gbairais.emotion, emotion), eq(gbairais.status, 'active')))
      .orderBy(desc(gbairais.createdAt))
      .limit(limit);

    const gbairaisWithInteractions: GbairaiWithInteractions[] = [];

    for (const row of gbairaisData) {
      const gbairai = row.gbairais;
      const user = row.users;
      
      const interactionsData = await this.getInteractionsByGbairai(gbairai.id);
      
      const likesCount = interactionsData.filter(i => i.type === 'like').length;
      const commentsCount = interactionsData.filter(i => i.type === 'comment').length;
      const sharesCount = interactionsData.filter(i => i.type === 'share').length;

      gbairaisWithInteractions.push({
        ...gbairai,
        interactions: interactionsData,
        user: user || undefined,
        likesCount,
        commentsCount,
        sharesCount
      });
    }

    return gbairaisWithInteractions;
  }

  async getGbairaisByLocation(location: LocationData, radius: number, limit = 20): Promise<GbairaiWithInteractions[]> {
    // Using simple distance calculation for now
    // In production, use PostGIS for proper geospatial queries
    const gbairaisData = await db
      .select()
      .from(gbairais)
      .leftJoin(users, eq(gbairais.userId, users.id))
      .where(eq(gbairais.status, 'active'))
      .orderBy(desc(gbairais.createdAt))
      .limit(limit * 2); // Get more to filter by distance

    const gbairaisWithInteractions: GbairaiWithInteractions[] = [];

    for (const row of gbairaisData) {
      const gbairai = row.gbairais;
      const user = row.users;
      
      // Check if gbairai has location data
      if (gbairai.location && typeof gbairai.location === 'object') {
        const gbairaiLocation = gbairai.location as any;
        if (gbairaiLocation.latitude && gbairaiLocation.longitude) {
          // Simple distance calculation
          const distance = this.calculateDistance(
            location.latitude,
            location.longitude,
            gbairaiLocation.latitude,
            gbairaiLocation.longitude
          );
          
          if (distance <= radius) {
            const interactionsData = await this.getInteractionsByGbairai(gbairai.id);
            
            const likesCount = interactionsData.filter(i => i.type === 'like').length;
            const commentsCount = interactionsData.filter(i => i.type === 'comment').length;
            const sharesCount = interactionsData.filter(i => i.type === 'share').length;

            gbairaisWithInteractions.push({
              ...gbairai,
              interactions: interactionsData,
              user: user || undefined,
              likesCount,
              commentsCount,
              sharesCount
            });
          }
        }
      }
    }

    return gbairaisWithInteractions.slice(0, limit);
  }

  async getUserGbairais(userId: number, limit = 20): Promise<GbairaiWithInteractions[]> {
    const gbairaisData = await db
      .select()
      .from(gbairais)
      .leftJoin(users, eq(gbairais.userId, users.id))
      .where(and(eq(gbairais.userId, userId), eq(gbairais.status, 'active')))
      .orderBy(desc(gbairais.createdAt))
      .limit(limit);

    const gbairaisWithInteractions: GbairaiWithInteractions[] = [];

    for (const row of gbairaisData) {
      const gbairai = row.gbairais;
      const user = row.users;
      
      const interactionsData = await this.getInteractionsByGbairai(gbairai.id);
      
      const likesCount = interactionsData.filter(i => i.type === 'like').length;
      const commentsCount = interactionsData.filter(i => i.type === 'comment').length;
      const sharesCount = interactionsData.filter(i => i.type === 'share').length;

      gbairaisWithInteractions.push({
        ...gbairai,
        interactions: interactionsData,
        user: user || undefined,
        likesCount,
        commentsCount,
        sharesCount
      });
    }

    return gbairaisWithInteractions;
  }

  async deleteGbairai(id: number, userId: number): Promise<boolean> {
    const [result] = await db
      .update(gbairais)
      .set({ status: 'deleted' })
      .where(and(eq(gbairais.id, id), eq(gbairais.userId, userId)))
      .returning();
    
    return !!result;
  }

  async createInteraction(insertInteraction: InsertInteraction): Promise<Interaction> {
    const [interaction] = await db
      .insert(interactions)
      .values(insertInteraction)
      .returning();
    return interaction;
  }

  async getInteractionsByGbairai(gbairaiId: number): Promise<Interaction[]> {
    const result = await db
      .select({
        id: interactions.id,
        userId: interactions.userId,
        gbairaiId: interactions.gbairaiId,
        type: interactions.type,
        content: interactions.content,
        createdAt: interactions.createdAt,
        parentCommentId: interactions.parentCommentId,
        user: {
          id: users.id,
          username: users.username,
          email: users.email,
        }
      })
      .from(interactions)
      .leftJoin(users, eq(interactions.userId, users.id))
      .where(eq(interactions.gbairaiId, gbairaiId))
      .orderBy(desc(interactions.createdAt));
    
    return result as any;
  }

  async getUserInteraction(userId: number, gbairaiId: number, type: string): Promise<Interaction | undefined> {
    const [interaction] = await db
      .select()
      .from(interactions)
      .where(and(
        eq(interactions.userId, userId),
        eq(interactions.gbairaiId, gbairaiId),
        eq(interactions.type, type)
      ));
    return interaction || undefined;
  }

  async deleteInteraction(id: number, userId: number): Promise<boolean> {
    const [result] = await db
      .delete(interactions)
      .where(and(eq(interactions.id, id), eq(interactions.userId, userId)))
      .returning();
    
    return !!result;
  }

  async getRepliesByCommentId(commentId: number): Promise<Interaction[]> {
    const result = await db
      .select({
        id: interactions.id,
        userId: interactions.userId,
        gbairaiId: interactions.gbairaiId,
        type: interactions.type,
        content: interactions.content,
        createdAt: interactions.createdAt,
        parentCommentId: interactions.parentCommentId,
        user: {
          id: users.id,
          username: users.username,
          email: users.email,
        }
      })
      .from(interactions)
      .leftJoin(users, eq(interactions.userId, users.id))
      .where(and(
        eq(interactions.parentCommentId, commentId),
        eq(interactions.type, 'comment')
      ))
      .orderBy(desc(interactions.createdAt));
    
    return result as any;
  }

  // Méthodes de messagerie pour DatabaseStorage
  async getAllUsers(): Promise<User[]> {
    const allUsers = await db.select().from(users)
      .where(eq(users.isActive, true))
      .orderBy(users.username);
    return allUsers;
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [newConversation] = await db.insert(conversations)
      .values(conversation)
      .returning();
    return newConversation;
  }

  async getConversationsByUserId(userId: number): Promise<Conversation[]> {
    const userConversations = await db.select().from(conversations)
      .where(sql`${conversations.participants} @> ${JSON.stringify([userId])}`)
      .orderBy(desc(conversations.lastMessageAt));
    
    return userConversations;
  }

  async getConversationById(id: number): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations)
      .where(eq(conversations.id, id));
    return conversation || undefined;
  }

  async getConversationByParticipants(participants: number[]): Promise<Conversation | undefined> {
    const sortedParticipants = participants.sort();
    const [conversation] = await db.select().from(conversations)
      .where(sql`${conversations.participants} = ${JSON.stringify(sortedParticipants)}`);
    return conversation || undefined;
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages)
      .values(message)
      .returning();
    
    // Mettre à jour la dernière activité de la conversation
    await db.update(conversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(conversations.id, message.conversationId!));
    
    return newMessage;
  }

  async getMessagesByConversationId(conversationId: number): Promise<Message[]> {
    return await db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  // Méthodes pour les profils et follows
  async getUserProfile(userId: number): Promise<UserWithStats | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return undefined;

    const stats = await this.getUserStats(userId);
    return {
      ...user,
      ...stats,
    };
  }

  async updateUserProfile(userId: number, profile: UserProfile): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ profile })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async followUser(followerId: number, followingId: number): Promise<Follow> {
    const [follow] = await db
      .insert(follows)
      .values({ followerId, followingId })
      .returning();
    return follow;
  }

  async unfollowUser(followerId: number, followingId: number): Promise<boolean> {
    const result = await db
      .delete(follows)
      .where(and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, followingId)
      ));
    return result.rowCount > 0;
  }

  async isFollowing(followerId: number, followingId: number): Promise<boolean> {
    const [follow] = await db
      .select()
      .from(follows)
      .where(and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, followingId)
      ));
    return !!follow;
  }

  async getUserFollowers(userId: number): Promise<User[]> {
    return await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        password: users.password,
        role: users.role,
        createdAt: users.createdAt,
        isActive: users.isActive,
        profile: users.profile,
      })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(eq(follows.followingId, userId));
  }

  async getUserFollowing(userId: number): Promise<User[]> {
    return await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        password: users.password,
        role: users.role,
        createdAt: users.createdAt,
        isActive: users.isActive,
        profile: users.profile,
      })
      .from(follows)
      .innerJoin(users, eq(follows.followingId, users.id))
      .where(eq(follows.followerId, userId));
  }

  async getUserStats(userId: number): Promise<{ followersCount: number; followingCount: number; gbairaisCount: number; }> {
    const [followersCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followingId, userId));

    const [followingCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followerId, userId));

    const [gbairaisCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(gbairais)
      .where(and(
        eq(gbairais.userId, userId),
        eq(gbairais.status, 'active')
      ));

    return {
      followersCount: followersCount?.count || 0,
      followingCount: followingCount?.count || 0,
      gbairaisCount: gbairaisCount?.count || 0,
    };
  }

  async searchUsers(query: string, currentUserId?: number): Promise<UserWithStats[]> {
    const usersData = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.isActive, true),
          sql`lower(${users.username}) like lower('%' || ${query} || '%')`
        )
      )
      .limit(20);

    const usersWithStats: UserWithStats[] = [];
    for (const user of usersData) {
      const stats = await this.getUserStats(user.id);
      const isFollowing = currentUserId ? await this.isFollowing(currentUserId, user.id) : false;
      
      usersWithStats.push({
        ...user,
        ...stats,
        isFollowing,
      });
    }

    return usersWithStats;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private gbairais: Map<number, Gbairai>;
  private interactions: Map<number, Interaction>;
  private conversations: Map<number, Conversation>;
  private messages: Map<number, Message>;
  private currentUserId: number;
  private currentGbairaiId: number;
  private currentInteractionId: number;
  private currentConversationId: number;
  private currentMessageId: number;
  sessionStore: any;

  constructor() {
    this.users = new Map();
    this.gbairais = new Map();
    this.interactions = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.currentUserId = 1;
    this.currentGbairaiId = 1;
    this.currentInteractionId = 1;
    this.currentConversationId = 1;
    this.currentMessageId = 1;
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { 
      ...insertUser, 
      id, 
      role: 'user',
      createdAt: new Date(),
      isActive: true,
      profile: null
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updateUser: UpdateUser): Promise<User | undefined> {
    const existingUser = this.users.get(id);
    if (!existingUser) return undefined;

    const updatedUser = { ...existingUser, ...updateUser };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async createGbairai(insertGbairai: InsertGbairai): Promise<Gbairai> {
    const id = this.currentGbairaiId++;
    const gbairai: Gbairai = {
      ...insertGbairai,
      id,
      createdAt: new Date(),
      status: 'active',
      userId: insertGbairai.userId ?? null,
      location: insertGbairai.location ?? null,
      isAnonymous: insertGbairai.isAnonymous ?? true,
      metadata: insertGbairai.metadata ?? null
    };
    this.gbairais.set(id, gbairai);
    return gbairai;
  }

  async getGbairais(limit = 20, offset = 0): Promise<GbairaiWithInteractions[]> {
    const allGbairais = Array.from(this.gbairais.values())
      .filter(g => g.status === 'active')
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(offset, offset + limit);

    const result: GbairaiWithInteractions[] = [];
    
    for (const gbairai of allGbairais) {
      const interactionsData = await this.getInteractionsByGbairai(gbairai.id);
      const user = gbairai.userId ? await this.getUser(gbairai.userId) : undefined;
      
      const likesCount = interactionsData.filter(i => i.type === 'like').length;
      const commentsCount = interactionsData.filter(i => i.type === 'comment').length;
      const sharesCount = interactionsData.filter(i => i.type === 'share').length;

      result.push({
        ...gbairai,
        interactions: interactionsData,
        user,
        likesCount,
        commentsCount,
        sharesCount
      });
    }

    return result;
  }

  async getGbairaiById(id: number): Promise<GbairaiWithInteractions | undefined> {
    const gbairai = this.gbairais.get(id);
    if (!gbairai || gbairai.status !== 'active') return undefined;

    const interactionsData = await this.getInteractionsByGbairai(gbairai.id);
    const user = gbairai.userId ? await this.getUser(gbairai.userId) : undefined;
    
    const likesCount = interactionsData.filter(i => i.type === 'like').length;
    const commentsCount = interactionsData.filter(i => i.type === 'comment').length;
    const sharesCount = interactionsData.filter(i => i.type === 'share').length;

    return {
      ...gbairai,
      interactions: interactionsData,
      user,
      likesCount,
      commentsCount,
      sharesCount
    };
  }

  async getGbairaisByEmotion(emotion: string, limit = 20): Promise<GbairaiWithInteractions[]> {
    const filteredGbairais = Array.from(this.gbairais.values())
      .filter(g => g.status === 'active' && g.emotion === emotion)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);

    const result: GbairaiWithInteractions[] = [];
    
    for (const gbairai of filteredGbairais) {
      const interactionsData = await this.getInteractionsByGbairai(gbairai.id);
      const user = gbairai.userId ? await this.getUser(gbairai.userId) : undefined;
      
      const likesCount = interactionsData.filter(i => i.type === 'like').length;
      const commentsCount = interactionsData.filter(i => i.type === 'comment').length;
      const sharesCount = interactionsData.filter(i => i.type === 'share').length;

      result.push({
        ...gbairai,
        interactions: interactionsData,
        user,
        likesCount,
        commentsCount,
        sharesCount
      });
    }

    return result;
  }

  async getGbairaisByLocation(location: LocationData, radius: number, limit = 20): Promise<GbairaiWithInteractions[]> {
    const filteredGbairais = Array.from(this.gbairais.values())
      .filter(g => {
        if (g.status !== 'active' || !g.location) return false;
        const gbairaiLocation = g.location as any;
        if (!gbairaiLocation.latitude || !gbairaiLocation.longitude) return false;
        
        const distance = this.calculateDistance(
          location.latitude,
          location.longitude,
          gbairaiLocation.latitude,
          gbairaiLocation.longitude
        );
        return distance <= radius;
      })
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);

    const result: GbairaiWithInteractions[] = [];
    
    for (const gbairai of filteredGbairais) {
      const interactionsData = await this.getInteractionsByGbairai(gbairai.id);
      const user = gbairai.userId ? await this.getUser(gbairai.userId) : undefined;
      
      const likesCount = interactionsData.filter(i => i.type === 'like').length;
      const commentsCount = interactionsData.filter(i => i.type === 'comment').length;
      const sharesCount = interactionsData.filter(i => i.type === 'share').length;

      result.push({
        ...gbairai,
        interactions: interactionsData,
        user,
        likesCount,
        commentsCount,
        sharesCount
      });
    }

    return result;
  }

  async getUserGbairais(userId: number, limit = 20): Promise<GbairaiWithInteractions[]> {
    const userGbairais = Array.from(this.gbairais.values())
      .filter(g => g.status === 'active' && g.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);

    const result: GbairaiWithInteractions[] = [];
    
    for (const gbairai of userGbairais) {
      const interactionsData = await this.getInteractionsByGbairai(gbairai.id);
      const user = await this.getUser(gbairai.userId!);
      
      const likesCount = interactionsData.filter(i => i.type === 'like').length;
      const commentsCount = interactionsData.filter(i => i.type === 'comment').length;
      const sharesCount = interactionsData.filter(i => i.type === 'share').length;

      result.push({
        ...gbairai,
        interactions: interactionsData,
        user,
        likesCount,
        commentsCount,
        sharesCount
      });
    }

    return result;
  }

  async deleteGbairai(id: number, userId: number): Promise<boolean> {
    const gbairai = this.gbairais.get(id);
    if (!gbairai || gbairai.userId !== userId) return false;
    
    gbairai.status = 'deleted';
    this.gbairais.set(id, gbairai);
    return true;
  }

  async createInteraction(insertInteraction: InsertInteraction): Promise<Interaction> {
    const id = this.currentInteractionId++;
    const interaction: Interaction = {
      ...insertInteraction,
      id,
      createdAt: new Date(),
      userId: insertInteraction.userId ?? null,
      gbairaiId: insertInteraction.gbairaiId ?? null,
      content: insertInteraction.content ?? null
    };
    this.interactions.set(id, interaction);
    return interaction;
  }

  async getInteractionsByGbairai(gbairaiId: number): Promise<Interaction[]> {
    return Array.from(this.interactions.values())
      .filter(i => i.gbairaiId === gbairaiId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getUserInteraction(userId: number, gbairaiId: number, type: string): Promise<Interaction | undefined> {
    return Array.from(this.interactions.values())
      .find(i => i.userId === userId && i.gbairaiId === gbairaiId && i.type === type);
  }

  async deleteInteraction(id: number, userId: number): Promise<boolean> {
    const interaction = this.interactions.get(id);
    if (!interaction || interaction.userId !== userId) return false;
    
    this.interactions.delete(id);
    return true;
  }

  async getRepliesByCommentId(commentId: number): Promise<Interaction[]> {
    return Array.from(this.interactions.values())
      .filter(i => i.parentCommentId === commentId && i.type === 'comment')
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  // Méthodes de messagerie pour MemStorage
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values())
      .filter(u => u.isActive)
      .sort((a, b) => a.username.localeCompare(b.username));
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const id = this.currentConversationId++;
    const newConversation: Conversation = {
      ...conversation,
      id,
      createdAt: new Date(),
      lastMessageAt: new Date(),
      participants: conversation.participants || [],
      isEncrypted: conversation.isEncrypted || false,
    };
    this.conversations.set(id, newConversation);
    return newConversation;
  }

  async getConversationsByUserId(userId: number): Promise<Conversation[]> {
    return Array.from(this.conversations.values())
      .filter(c => (c.participants as number[]).includes(userId))
      .sort((a, b) => (b.lastMessageAt?.getTime() || 0) - (a.lastMessageAt?.getTime() || 0));
  }

  async getConversationById(id: number): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async getConversationByParticipants(participants: number[]): Promise<Conversation | undefined> {
    const sortedParticipants = participants.sort();
    return Array.from(this.conversations.values())
      .find(c => {
        const conversationParticipants = (c.participants as number[]).sort();
        return JSON.stringify(conversationParticipants) === JSON.stringify(sortedParticipants);
      });
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const id = this.currentMessageId++;
    const newMessage: Message = {
      ...message,
      id,
      createdAt: new Date(),
      senderId: message.senderId || 0,
      conversationId: message.conversationId || 0,
      content: message.content || '',
      type: message.type || 'text',
    };
    this.messages.set(id, newMessage);
    
    // Mettre à jour la dernière activité de la conversation
    if (message.conversationId) {
      const conversation = this.conversations.get(message.conversationId);
      if (conversation) {
        conversation.lastMessageAt = new Date();
        this.conversations.set(message.conversationId, conversation);
      }
    }
    
    return newMessage;
  }

  async getMessagesByConversationId(conversationId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(m => m.conversationId === conversationId)
      .sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));
  }

  // Méthodes pour les profils et follows (implémentation simplifiée pour MemStorage)
  async getUserProfile(userId: number): Promise<UserWithStats | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;

    const stats = await this.getUserStats(userId);
    return {
      ...user,
      ...stats,
    };
  }

  async updateUserProfile(userId: number, profile: UserProfile): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;

    const updatedUser = { ...user, profile };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async followUser(followerId: number, followingId: number): Promise<Follow> {
    // Implémentation simplifiée pour MemStorage
    const follow: Follow = {
      id: Date.now(),
      followerId,
      followingId,
      createdAt: new Date(),
    };
    return follow;
  }

  async unfollowUser(followerId: number, followingId: number): Promise<boolean> {
    // Implémentation simplifiée pour MemStorage
    return true;
  }

  async isFollowing(followerId: number, followingId: number): Promise<boolean> {
    // Implémentation simplifiée pour MemStorage
    return false;
  }

  async getUserFollowers(userId: number): Promise<User[]> {
    // Implémentation simplifiée pour MemStorage
    return [];
  }

  async getUserFollowing(userId: number): Promise<User[]> {
    // Implémentation simplifiée pour MemStorage
    return [];
  }

  async getUserStats(userId: number): Promise<{ followersCount: number; followingCount: number; gbairaisCount: number; }> {
    const gbairaisCount = Array.from(this.gbairais.values())
      .filter(g => g.userId === userId && g.status === 'active').length;

    return {
      followersCount: 0,
      followingCount: 0,
      gbairaisCount,
    };
  }

  async searchUsers(query: string, currentUserId?: number): Promise<UserWithStats[]> {
    const users = Array.from(this.users.values())
      .filter(user => 
        user.isActive && 
        user.username.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 20);

    const usersWithStats: UserWithStats[] = [];
    for (const user of users) {
      const stats = await this.getUserStats(user.id);
      usersWithStats.push({
        ...user,
        ...stats,
        isFollowing: false,
      });
    }

    return usersWithStats;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}

export const storage = process.env.DATABASE_URL ? new DatabaseStorage() : new MemStorage();
