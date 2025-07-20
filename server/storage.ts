import { 
  notes, 
  type Note, 
  type InsertNote, 
  users, 
  type User, 
  type InsertUser,
  type UpsertUser,
  periodAnalyses,
  type PeriodAnalysis,
  type InsertPeriodAnalysis
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { Pool } from "pg";
import connectPg from "connect-pg-simple";
import { primaryPool } from "./db"; // Import primaryPool from db.ts to ensure we use the same connection

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);

// No need to recreate pool here, imported from db.ts

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  getUserByReplitId(replitId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserResetToken(userId: number, token: string, expiry: Date): Promise<void>;
  updateUserPassword(userId: number, password: string): Promise<void>;
  getNotesByDate(date: string, userId?: number): Promise<Note[]>;
  getNotesByDateRange(startDate: string, endDate: string, userId: number): Promise<Note[]>;
  getAllDates(userId?: number): Promise<string[]>;
  createNote(note: InsertNote): Promise<Note>;
  deleteNote(noteId: number, userId: number): Promise<boolean>;
  getRecentDays(limit: number, userId?: number): Promise<{ date: string; count: number }[]>;
  getDatesWithNotes(userId?: number): Promise<string[]>;
  saveAnalysis(date: string, analysis: string, userId: number): Promise<void>;
  getAnalysis(date: string, userId: number): Promise<string | null>;
  savePeriodAnalysis(periodAnalysis: InsertPeriodAnalysis): Promise<PeriodAnalysis>;
  getPeriodAnalysis(startDate: string, endDate: string, periodType: string, userId: number): Promise<PeriodAnalysis | null>;
  // Search functionality
  searchNotes(searchTerm: string, userId: number): Promise<Array<Note & { date: string }>>;
  // Streak functionality
  getUserStreak(userId: number): Promise<{ currentStreak: number; longestStreak: number; lastEntryDate: string | null }>;
  // Moments related methods
  toggleMoment(noteId: number, userId: number): Promise<{ success: boolean; isNowMoment?: boolean }>;
  getMoments(userId: number): Promise<Note[]>;
  analyzeMoments(userId: number): Promise<string>;
  // Ideas related methods
  toggleIdea(noteId: number, userId: number): Promise<{ success: boolean; isNowIdea?: boolean }>;
  getIdeas(userId: number): Promise<Note[]>;
  // Admin statistics methods
  getTotalUsers(): Promise<number>;
  getActiveUsersSince(date: Date): Promise<number>;
  getTotalNotes(): Promise<number>;
  getTotalAnalyses(): Promise<number>;
  // Admin user management
  getAllUsers(): Promise<User[]>;
  getActiveUsersWithDetails(date: Date): Promise<Array<User & { lastActive: string }>>;
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private notes: Map<number, Note>;
  private periodAnalyses: Map<number, PeriodAnalysis>;
  private userCurrentId: number;
  private noteCurrentId: number;
  private periodAnalysisCurrentId: number;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.notes = new Map();
    this.periodAnalyses = new Map();
    this.userCurrentId = 1;
    this.noteCurrentId = 1;
    this.periodAnalysisCurrentId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
  }
  
  // Function to reset all data for deployment/testing
  reset() {
    this.users.clear();
    this.notes.clear();
    this.periodAnalyses.clear();
    this.userCurrentId = 1;
    this.noteCurrentId = 1;
    this.periodAnalysisCurrentId = 1;
    console.log("Storage reset: All users, notes, and analyses have been removed");
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

  async getUserByResetToken(token: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.resetToken === token,
    );
  }

  async getUserByReplitId(replitId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.replitId === replitId,
    );
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Find existing user by replitId
    const existingUser = await this.getUserByReplitId(userData.replitId!);
    
    if (existingUser) {
      // Update existing user
      const updatedUser = {
        ...existingUser,
        ...userData,
        updatedAt: new Date(),
      };
      this.users.set(existingUser.id, updatedUser);
      return updatedUser;
    } else {
      // Create new user
      const id = this.userCurrentId++;
      const user: User = { 
        ...userData,
        id,
        username: null,
        password: null,
        name: null,
        resetToken: null,
        resetTokenExpiry: null,
        authProvider: userData.authProvider || "replit",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.users.set(id, user);
      return user;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { 
      ...insertUser, 
      id,
      name: insertUser.name || null,
      resetToken: null,
      resetTokenExpiry: null 
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserResetToken(userId: number, token: string, expiry: Date): Promise<void> {
    const user = await this.getUser(userId);
    if (user) {
      user.resetToken = token;
      user.resetTokenExpiry = expiry;
      this.users.set(userId, user);
    }
  }

  async updateUserPassword(userId: number, password: string): Promise<void> {
    const user = await this.getUser(userId);
    if (user) {
      user.password = password;
      user.resetToken = null;
      user.resetTokenExpiry = null;
      this.users.set(userId, user);
    }
  }

  async getNotesByDate(date: string, userId?: number): Promise<Note[]> {
    return Array.from(this.notes.values())
      .filter(note => note.date === date && (userId === undefined || note.userId === userId))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async getAllDates(userId?: number): Promise<string[]> {
    const dates = new Set<string>();
    Array.from(this.notes.values())
      .filter(note => userId === undefined || note.userId === userId)
      .forEach(note => {
        dates.add(note.date);
      });
    return Array.from(dates).sort((a, b) => b.localeCompare(a)); // Sort dates in descending order
  }

  async createNote(insertNote: InsertNote): Promise<Note> {
    const id = this.noteCurrentId++;
    const note: Note = { 
      ...insertNote, 
      id, 
      timestamp: new Date(),
      analysis: null,
      isMoment: insertNote.isMoment || false
    };
    this.notes.set(id, note);
    return note;
  }
  
  async deleteNote(noteId: number, userId: number): Promise<boolean> {
    const note = this.notes.get(noteId);
    
    // Only delete the note if it exists and belongs to the user
    if (note && note.userId === userId) {
      this.notes.delete(noteId);
      return true;
    }
    
    return false;
  }

  async getRecentDays(limit: number, userId?: number): Promise<{ date: string; count: number }[]> {
    const dateMap = new Map<string, number>();
    
    // Count notes per date
    Array.from(this.notes.values())
      .filter(note => userId === undefined || note.userId === userId)
      .forEach(note => {
        const count = dateMap.get(note.date) || 0;
        dateMap.set(note.date, count + 1);
      });
    
    // Convert to array and sort
    return Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }

  async getDatesWithNotes(userId?: number): Promise<string[]> {
    const dates = new Set<string>();
    Array.from(this.notes.values())
      .filter(note => userId === undefined || note.userId === userId)
      .forEach(note => {
        dates.add(note.date);
      });
    return Array.from(dates);
  }
  
  async saveAnalysis(date: string, analysis: string, userId: number): Promise<void> {
    // Find all notes for this date and user and update their analysis field
    Array.from(this.notes.values())
      .filter(note => note.date === date && note.userId === userId)
      .forEach(note => {
        // Update the note with analysis
        note.analysis = analysis;
        this.notes.set(note.id, note);
      });
  }
  
  async getAnalysis(date: string, userId: number): Promise<string | null> {
    // Get the first note for this date and user that has an analysis
    const noteWithAnalysis = Array.from(this.notes.values())
      .find(note => note.date === date && note.userId === userId && note.analysis);
    
    return noteWithAnalysis?.analysis || null;
  }
  
  async getNotesByDateRange(startDate: string, endDate: string, userId: number): Promise<Note[]> {
    return Array.from(this.notes.values())
      .filter(note => {
        // Check if note date is within range and belongs to the user
        return note.date >= startDate && 
               note.date <= endDate && 
               note.userId === userId;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
  
  async savePeriodAnalysis(periodAnalysis: InsertPeriodAnalysis): Promise<PeriodAnalysis> {
    const id = this.periodAnalysisCurrentId++;
    const analysis: PeriodAnalysis = {
      ...periodAnalysis,
      id,
      createdAt: new Date()
    };
    this.periodAnalyses.set(id, analysis);
    return analysis;
  }
  
  async getPeriodAnalysis(startDate: string, endDate: string, periodType: string, userId: number): Promise<PeriodAnalysis | null> {
    const analysis = Array.from(this.periodAnalyses.values())
      .find(analysis => 
        analysis.startDate === startDate && 
        analysis.endDate === endDate && 
        analysis.periodType === periodType &&
        analysis.userId === userId
      );
    
    return analysis || null;
  }
  
  // Admin statistics methods
  async getTotalUsers(): Promise<number> {
    return this.users.size;
  }
  
  async getActiveUsersSince(date: Date): Promise<number> {
    // For MemStorage, we just return total users as we don't track login dates
    return this.users.size;
  }
  
  async getTotalNotes(): Promise<number> {
    return this.notes.size;
  }
  
  async getTotalAnalyses(): Promise<number> {
    // Count daily analyses (notes with non-null analysis field) + period analyses
    const dailyAnalysesCount = Array.from(this.notes.values())
      .filter(note => note.analysis !== null)
      .length;
    
    return dailyAnalysesCount + this.periodAnalyses.size;
  }
  
  // Admin user management methods
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  async getActiveUsersWithDetails(date: Date): Promise<Array<User & { lastActive: string }>> {
    // For MemStorage, we just return all users with current date as lastActive
    const now = new Date().toISOString();
    return Array.from(this.users.values()).map(user => ({
      ...user,
      lastActive: now
    }));
  }

  // Moments related methods
  async toggleMoment(noteId: number, userId: number): Promise<{ success: boolean; isNowMoment?: boolean }> {
    const note = this.notes.get(noteId);
    if (note && note.userId === userId) {
      // Toggle the moment flag
      note.isMoment = !note.isMoment;
      this.notes.set(noteId, note);
      return { success: true, isNowMoment: note.isMoment };
    }
    return { success: false };
  }

  async getMoments(userId: number): Promise<Note[]> {
    return Array.from(this.notes.values())
      .filter(note => note.userId === userId && note.isMoment === true)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // Ideas related methods
  async toggleIdea(noteId: number, userId: number): Promise<{ success: boolean; isNowIdea?: boolean }> {
    const note = this.notes.get(noteId);
    if (note && note.userId === userId) {
      // Toggle the idea flag
      note.isIdea = !note.isIdea;
      this.notes.set(noteId, note);
      return { success: true, isNowIdea: note.isIdea };
    }
    return { success: false };
  }

  async getIdeas(userId: number): Promise<Note[]> {
    return Array.from(this.notes.values())
      .filter(note => note.userId === userId && note.isIdea === true)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async searchNotes(searchTerm: string, userId: number): Promise<Array<Note & { date: string }>> {
    // Convert search term to lowercase for case-insensitive search
    const term = searchTerm.toLowerCase();
    
    return Array.from(this.notes.values())
      .filter(note => 
        // Only include notes from the specified user
        note.userId === userId && 
        // Check if content includes the search term (case insensitive)
        note.content.toLowerCase().includes(term)
      )
      .map(note => ({
        ...note,
        date: note.date // Date is already included in the note, but we include it for type safety
      }))
      .sort((a, b) => 
        // Sort by date first (descending)
        b.date.localeCompare(a.date) || 
        // Then by timestamp (descending)
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  }

  async analyzeMoments(userId: number): Promise<string> {
    // Get the moments for this user
    const moments = await this.getMoments(userId);
    if (moments.length === 0) {
      return "No moments found to analyze.";
    }
    
    // Use the OpenAI integration
    const { analyzeMoments } = await import("./openai");
    return await analyzeMoments(moments);
  }
  
  async getUserStreak(userId: number): Promise<{ currentStreak: number; longestStreak: number; lastEntryDate: string | null }> {
    // Get all dates that have notes for this user
    const allDates = await this.getAllDates(userId);
    
    if (allDates.length === 0) {
      return { currentStreak: 0, longestStreak: 0, lastEntryDate: null };
    }
    
    // Get the current date in the same format for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    // Find the most recent entry date
    const sortedDates = [...allDates].sort((a, b) => b.localeCompare(a));
    const lastEntryDate = sortedDates[0];
    
    // Calculate current streak
    let currentStreak = 0;
    
    // Check if the user has an entry for today
    const hasEntryToday = allDates.includes(todayStr);
    
    if (hasEntryToday) {
      // Start with today's entry
      currentStreak = 1;
      let checkDate = new Date(today);
      
      // Check backwards for consecutive days
      while (true) {
        // Move to previous day
        checkDate.setDate(checkDate.getDate() - 1);
        const previousDayStr = checkDate.toISOString().split('T')[0];
        
        // If there's an entry for the previous day, increment streak
        if (allDates.includes(previousDayStr)) {
          currentStreak++;
        } else {
          // Break the loop when we find a day without an entry
          break;
        }
      }
    } else {
      // Check if the most recent entry was yesterday
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      if (lastEntryDate === yesterdayStr) {
        // Start streak from yesterday
        currentStreak = 1;
        let checkDate = new Date(yesterday);
        
        // Check backwards for consecutive days
        while (true) {
          // Move to previous day
          checkDate.setDate(checkDate.getDate() - 1);
          const previousDayStr = checkDate.toISOString().split('T')[0];
          
          // If there's an entry for the previous day, increment streak
          if (allDates.includes(previousDayStr)) {
            currentStreak++;
          } else {
            // Break the loop when we find a day without an entry
            break;
          }
        }
      } else {
        // The streak is broken (no entry today or yesterday)
        currentStreak = 0;
      }
    }
    
    // Calculate longest streak
    let longestStreak = 0;
    
    // Convert date strings to Date objects for easier manipulation
    const dateObjects = allDates.map((dateStr: string) => new Date(dateStr));
    dateObjects.sort((a: Date, b: Date) => a.getTime() - b.getTime());
    
    // Only calculate longest streak if we have dates
    if (dateObjects.length > 0) {
      let currentLongestStreak = 1;
      
      for (let i = 1; i < dateObjects.length; i++) {
        const currentDate = dateObjects[i];
        const prevDate = dateObjects[i - 1];
        
        // Calculate days between dates
        const diffTime = Math.abs(currentDate.getTime() - prevDate.getTime());
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          // Consecutive day, increment current streak
          currentLongestStreak++;
        } else {
          // Non-consecutive day, reset streak but save it if it's the longest
          if (currentLongestStreak > longestStreak) {
            longestStreak = currentLongestStreak;
          }
          currentLongestStreak = 1;
        }
      }
      
      // Check one last time after the loop ends
      if (currentLongestStreak > longestStreak) {
        longestStreak = currentLongestStreak;
      }
    }
    
    // The current streak should never be greater than the longest streak
    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }
    
    return { 
      currentStreak, 
      longestStreak, 
      lastEntryDate 
    };
  }
}

export class PostgresStorage implements IStorage {
  sessionStore: session.Store;
  
  async searchNotes(searchTerm: string, userId: number): Promise<Array<Note & { date: string }>> {
    try {
      // Use PostgreSQL's ILIKE operator for case-insensitive search
      const query = `
        SELECT id, content, timestamp, date, user_id as "userId", analysis, is_moment as "isMoment", is_idea as "isIdea"
        FROM notes 
        WHERE user_id = $1 
        AND content ILIKE $2
        ORDER BY date DESC, timestamp DESC
      `;
      
      // Use % wildcards to search for the term anywhere in the content
      const result = await this.executeQuery(query, [userId, `%${searchTerm}%`]);
      
      // The date is already included in the Note type, but we need to satisfy the return type
      return result.rows.map((note: any) => ({
        ...note,
        date: note.date
      }));
    } catch (error) {
      console.error(`Error searching notes with term "${searchTerm}":`, error);
      return [];
    }
  }

  constructor() {
    // Set up PostgreSQL session store with error handling
    try {
      this.sessionStore = new PostgresSessionStore({
        pool: primaryPool,
        createTableIfMissing: true,
        // Error handling for session store
        errorLog: (error) => {
          console.error('[SESSION STORE ERROR]', error);
        }
      });
      console.log("PostgreSQL session store initialized");
    } catch (error) {
      console.error("Failed to initialize PostgreSQL session store:", error);
      // Fallback to memory store if PostgreSQL fails
      console.warn("Falling back to in-memory session store");
      this.sessionStore = new MemoryStore({
        checkPeriod: 86400000 // 24h
      });
    }
  }
  
  // Helper method to execute database queries with error handling
  private async executeQuery(query: string, params: any[] = []): Promise<any> {
    try {
      return await primaryPool.query(query, params);
    } catch (error) {
      console.error(`[DB ERROR] Query failed: ${query.substring(0, 100)}...`, error);
      throw error;
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
      const result = await this.executeQuery('SELECT * FROM users WHERE id = $1', [id]);
      return result.rows[0] || undefined;
    } catch (error) {
      console.error(`Error getting user with id ${id}:`, error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await this.executeQuery('SELECT * FROM users WHERE username = $1', [username]);
      return result.rows[0] || undefined;
    } catch (error) {
      console.error(`Error getting user by username ${username}:`, error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const result = await this.executeQuery('SELECT * FROM users WHERE email = $1', [email]);
      return result.rows[0] || undefined;
    } catch (error) {
      console.error(`Error getting user by email:`, error);
      return undefined;
    }
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    try {
      const result = await this.executeQuery(
        'SELECT * FROM users WHERE reset_token = $1 AND reset_token_expiry > NOW()', 
        [token]
      );
      return result.rows[0] || undefined;
    } catch (error) {
      console.error('Error getting user by reset token:', error);
      return undefined;
    }
  }

  async getUserByReplitId(replitId: string): Promise<User | undefined> {
    try {
      const result = await this.executeQuery('SELECT * FROM users WHERE replit_id = $1', [replitId]);
      return result.rows[0] || undefined;
    } catch (error) {
      console.error(`Error getting user by Replit ID ${replitId}:`, error);
      return undefined;
    }
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    try {
      const result = await this.executeQuery(`
        INSERT INTO users (replit_id, email, first_name, last_name, profile_image_url, auth_provider, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (replit_id) 
        DO UPDATE SET 
          email = EXCLUDED.email,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          profile_image_url = EXCLUDED.profile_image_url,
          updated_at = NOW()
        RETURNING *
      `, [
        userData.replitId,
        userData.email,
        userData.firstName,
        userData.lastName,
        userData.profileImageUrl,
        userData.authProvider || "replit"
      ]);
      return result.rows[0];
    } catch (error) {
      console.error('Error upserting user:', error);
      throw error;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    const { username, password, email, name } = user;
    try {
      const result = await this.executeQuery(
        'INSERT INTO users (username, password, email, name, reset_token, reset_token_expiry) VALUES ($1, $2, $3, $4, NULL, NULL) RETURNING *',
        [username, password, email, name || null]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Failed to create user. Please try again later.');
    }
  }

  async updateUserResetToken(userId: number, token: string, expiry: Date): Promise<void> {
    try {
      await this.executeQuery(
        'UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3',
        [token, expiry, userId]
      );
    } catch (error) {
      console.error(`Error updating reset token for user ${userId}:`, error);
      throw new Error('Failed to update reset token. Please try again later.');
    }
  }

  async updateUserPassword(userId: number, password: string): Promise<void> {
    try {
      await this.executeQuery(
        'UPDATE users SET password = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2',
        [password, userId]
      );
    } catch (error) {
      console.error(`Error updating password for user ${userId}:`, error);
      throw new Error('Failed to update password. Please try again later.');
    }
  }

  async getNotesByDate(date: string, userId?: number): Promise<Note[]> {
    try {
      let query = 'SELECT id, content, timestamp, date, user_id as "userId", analysis, is_moment as "isMoment", is_idea as "isIdea" FROM notes WHERE date = $1';
      const params: any[] = [date];

      if (userId !== undefined) {
        query += ' AND user_id = $2';
        params.push(userId);
      }

      query += ' ORDER BY timestamp DESC';
      
      const result = await this.executeQuery(query, params);
      return result.rows;
    } catch (error) {
      console.error(`Error getting notes for date ${date}:`, error);
      return [];
    }
  }

  async getAllDates(userId?: number): Promise<string[]> {
    try {
      let query = 'SELECT DISTINCT date FROM notes';
      const params: any[] = [];

      if (userId !== undefined) {
        query += ' WHERE user_id = $1';
        params.push(userId);
      }

      query += ' ORDER BY date DESC';
      
      const result = await this.executeQuery(query, params);
      return result.rows.map((row: any) => row.date);
    } catch (error) {
      console.error('Error getting all dates:', error);
      return [];
    }
  }

  async createNote(note: InsertNote): Promise<Note> {
    try {
      const { content, date, userId, isMoment, isIdea } = note;
      const result = await this.executeQuery(
        'INSERT INTO notes (content, date, user_id, timestamp, analysis, is_moment, is_idea) VALUES ($1, $2, $3, NOW(), NULL, $4, $5) RETURNING *',
        [content, date, userId, isMoment || false, isIdea || false]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error creating note:', error);
      throw new Error('Failed to create note. Please try again later.');
    }
  }

  async deleteNote(noteId: number, userId: number): Promise<boolean> {
    try {
      const result = await this.executeQuery(
        'DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id',
        [noteId, userId]
      );
      
      return (result.rowCount as number) > 0;
    } catch (error) {
      console.error(`Error deleting note ${noteId}:`, error);
      return false;
    }
  }

  async getRecentDays(limit: number, userId?: number): Promise<{ date: string; count: number }[]> {
    try {
      let query = `
        SELECT date, COUNT(*) as count
        FROM notes
      `;
      
      const params: any[] = [];
      
      if (userId !== undefined) {
        query += ' WHERE user_id = $1';
        params.push(userId);
      }
      
      query += `
        GROUP BY date
        ORDER BY date DESC
        LIMIT $${params.length + 1}
      `;
      
      params.push(limit);
      
      const result = await this.executeQuery(query, params);
      return result.rows.map((row: any) => ({
        date: row.date,
        count: parseInt(row.count, 10)
      }));
    } catch (error) {
      console.error(`Error getting recent days (limit: ${limit}):`, error);
      return [];
    }
  }

  async getDatesWithNotes(userId?: number): Promise<string[]> {
    try {
      let query = 'SELECT DISTINCT date FROM notes';
      const params: any[] = [];

      if (userId !== undefined) {
        query += ' WHERE user_id = $1';
        params.push(userId);
      }
      
      const result = await this.executeQuery(query, params);
      return result.rows.map((row: any) => row.date);
    } catch (error) {
      console.error('Error getting dates with notes:', error);
      return [];
    }
  }
  
  async saveAnalysis(date: string, analysis: string, userId: number): Promise<void> {
    try {
      // Update the analysis field for all notes for this date and user
      await this.executeQuery(
        'UPDATE notes SET analysis = $1 WHERE date = $2 AND user_id = $3',
        [analysis, date, userId]
      );
    } catch (error) {
      console.error(`Error saving analysis for date ${date}:`, error);
      throw new Error('Failed to save analysis. Please try again later.');
    }
  }
  
  async getAnalysis(date: string, userId: number): Promise<string | null> {
    try {
      const result = await this.executeQuery(
        'SELECT analysis FROM notes WHERE date = $1 AND user_id = $2 AND analysis IS NOT NULL LIMIT 1',
        [date, userId]
      );
      
      if (result.rows.length > 0 && result.rows[0].analysis) {
        return result.rows[0].analysis;
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting analysis for date ${date}:`, error);
      return null;
    }
  }
  
  async getNotesByDateRange(startDate: string, endDate: string, userId: number): Promise<Note[]> {
    try {
      const query = `
        SELECT id, content, timestamp, date, user_id as "userId", analysis, is_moment as "isMoment" FROM notes 
        WHERE user_id = $1 
        AND date >= $2 
        AND date <= $3 
        ORDER BY date ASC, timestamp DESC
      `;
      
      const result = await this.executeQuery(query, [userId, startDate, endDate]);
      return result.rows;
    } catch (error) {
      console.error(`Error getting notes for date range ${startDate} to ${endDate}:`, error);
      return [];
    }
  }
  
  async savePeriodAnalysis(periodAnalysis: InsertPeriodAnalysis): Promise<PeriodAnalysis> {
    try {
      const { userId, startDate, endDate, periodType, analysis } = periodAnalysis;
      
      // Check if an analysis for this period already exists
      const existingResult = await this.executeQuery(
        `SELECT * FROM period_analyses 
         WHERE user_id = $1 
         AND start_date = $2 
         AND end_date = $3 
         AND period_type = $4`,
        [userId, startDate, endDate, periodType]
      );
      
      // If an analysis exists, update it
      if (existingResult.rows.length > 0) {
        const result = await this.executeQuery(
          `UPDATE period_analyses 
           SET analysis = $1, created_at = NOW() 
           WHERE id = $2 
           RETURNING *`,
          [analysis, existingResult.rows[0].id]
        );
        return result.rows[0];
      }
      
      // Otherwise, create a new analysis
      const result = await this.executeQuery(
        `INSERT INTO period_analyses 
         (user_id, start_date, end_date, period_type, analysis, created_at) 
         VALUES ($1, $2, $3, $4, $5, NOW()) 
         RETURNING *`,
        [userId, startDate, endDate, periodType, analysis]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error(`Error saving period analysis:`, error);
      throw new Error('Failed to save period analysis. Please try again later.');
    }
  }
  
  async getPeriodAnalysis(startDate: string, endDate: string, periodType: string, userId: number): Promise<PeriodAnalysis | null> {
    try {
      const result = await this.executeQuery(
        `SELECT * FROM period_analyses 
         WHERE user_id = $1 
         AND start_date = $2 
         AND end_date = $3 
         AND period_type = $4`,
        [userId, startDate, endDate, periodType]
      );
      
      if (result.rows.length > 0) {
        return result.rows[0];
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting period analysis:`, error);
      return null;
    }
  }
  
  // Admin statistics methods
  async getTotalUsers(): Promise<number> {
    try {
      const result = await this.executeQuery('SELECT COUNT(*) as count FROM users');
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      console.error('Error getting total users count:', error);
      return 0;
    }
  }
  
  async getActiveUsersSince(date: Date): Promise<number> {
    try {
      // Since we don't track login dates directly, 
      // use the most recent note timestamp as a proxy for user activity
      const result = await this.executeQuery(
        `SELECT COUNT(DISTINCT user_id) as count 
         FROM notes 
         WHERE timestamp >= $1`,
        [date]
      );
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      console.error('Error getting active users count:', error);
      return 0;
    }
  }
  
  async getTotalNotes(): Promise<number> {
    try {
      const result = await this.executeQuery('SELECT COUNT(*) as count FROM notes');
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      console.error('Error getting total notes count:', error);
      return 0;
    }
  }
  
  async getTotalAnalyses(): Promise<number> {
    try {
      // Count daily analyses (notes with non-null analysis field) + period analyses
      const dailyResult = await this.executeQuery(
        `SELECT COUNT(DISTINCT user_id, date) as count
         FROM notes
         WHERE analysis IS NOT NULL`
      );
      
      const periodResult = await this.executeQuery(
        'SELECT COUNT(*) as count FROM period_analyses'
      );
      
      const dailyCount = parseInt(dailyResult.rows[0].count, 10);
      const periodCount = parseInt(periodResult.rows[0].count, 10);
      
      return dailyCount + periodCount;
    } catch (error) {
      console.error('Error getting total analyses count:', error);
      return 0;
    }
  }
  
  // Admin user management methods
  async getAllUsers(): Promise<User[]> {
    try {
      const result = await this.executeQuery(
        'SELECT * FROM users ORDER BY username'
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }
  
  async getActiveUsersWithDetails(date: Date): Promise<Array<User & { lastActive: string }>> {
    try {
      // Join users with their most recent note to get activity data
      const result = await this.executeQuery(
        `SELECT u.*, 
          (SELECT MAX(timestamp) FROM notes WHERE user_id = u.id) as last_active
         FROM users u
         WHERE EXISTS (
           SELECT 1 FROM notes 
           WHERE user_id = u.id AND timestamp >= $1
         )
         ORDER BY last_active DESC`,
        [date]
      );
      
      return result.rows.map((row: any) => ({
        ...row,
        lastActive: row.last_active ? new Date(row.last_active).toISOString() : null
      }));
    } catch (error) {
      console.error('Error getting active users with details:', error);
      return [];
    }
  }

  // Moments related methods
  async toggleMoment(noteId: number, userId: number): Promise<{ success: boolean; isNowMoment?: boolean }> {
    try {
      // First check if the note exists and belongs to the user
      const checkResult = await this.executeQuery(
        'SELECT is_moment FROM notes WHERE id = $1 AND user_id = $2',
        [noteId, userId]
      );
      
      if (checkResult.rows.length === 0) {
        return { success: false };
      }
      
      // Toggle the is_moment value
      const currentValue = checkResult.rows[0].is_moment || false;
      const newValue = !currentValue;
      
      await this.executeQuery(
        'UPDATE notes SET is_moment = $1 WHERE id = $2 AND user_id = $3',
        [newValue, noteId, userId]
      );
      
      return { success: true, isNowMoment: newValue };
    } catch (error) {
      console.error(`Error toggling moment for note ${noteId}:`, error);
      return { success: false };
    }
  }

  async getMoments(userId: number): Promise<Note[]> {
    try {
      const result = await this.executeQuery(
        'SELECT id, content, timestamp, date, user_id as "userId", analysis, is_moment as "isMoment", is_idea as "isIdea" FROM notes WHERE user_id = $1 AND is_moment = true ORDER BY timestamp DESC',
        [userId]
      );
      
      return result.rows;
    } catch (error) {
      console.error(`Error getting moments for user ${userId}:`, error);
      return [];
    }
  }

  // Ideas related methods
  async toggleIdea(noteId: number, userId: number): Promise<{ success: boolean; isNowIdea?: boolean }> {
    try {
      // First check if the note exists and belongs to the user
      const checkResult = await this.executeQuery(
        'SELECT is_idea FROM notes WHERE id = $1 AND user_id = $2',
        [noteId, userId]
      );
      
      if (checkResult.rows.length === 0) {
        return { success: false };
      }
      
      // Toggle the is_idea value
      const currentValue = checkResult.rows[0].is_idea || false;
      const newValue = !currentValue;
      
      await this.executeQuery(
        'UPDATE notes SET is_idea = $1 WHERE id = $2 AND user_id = $3',
        [newValue, noteId, userId]
      );
      
      return { success: true, isNowIdea: newValue };
    } catch (error) {
      console.error(`Error toggling idea for note ${noteId}:`, error);
      return { success: false };
    }
  }

  async getIdeas(userId: number): Promise<Note[]> {
    try {
      const result = await this.executeQuery(
        'SELECT id, content, timestamp, date, user_id as "userId", analysis, is_moment as "isMoment", is_idea as "isIdea" FROM notes WHERE user_id = $1 AND is_idea = true ORDER BY timestamp DESC',
        [userId]
      );
      
      return result.rows;
    } catch (error) {
      console.error(`Error getting ideas for user ${userId}:`, error);
      return [];
    }
  }

  async analyzeMoments(userId: number): Promise<string> {
    try {
      const moments = await this.getMoments(userId);
      
      if (moments.length === 0) {
        return "No moments found to analyze.";
      }
      
      // Use the OpenAI integration
      const { analyzeMoments } = await import("./openai");
      return await analyzeMoments(moments);
    } catch (error) {
      console.error(`Error analyzing moments for user ${userId}:`, error);
      return "An error occurred while analyzing your moments.";
    }
  }
  
  async getUserStreak(userId: number): Promise<{ currentStreak: number; longestStreak: number; lastEntryDate: string | null }> {
    try {
      // Get all the dates with notes for this user
      const result = await this.executeQuery(
        'SELECT DISTINCT date FROM notes WHERE user_id = $1 ORDER BY date',
        [userId]
      );
      
      if (result.rows.length === 0) {
        return { currentStreak: 0, longestStreak: 0, lastEntryDate: null };
      }
      
      // Get all dates as strings in YYYY-MM-DD format
      const allDates = result.rows.map((row: any) => row.date);
      
      // Get the current system date in the same format for comparison
      const today = new Date();
      // Make sure we're just comparing the date part (no time)
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      // Filter out any future dates based on system time
      const validDates = allDates.filter((date: string) => date <= todayStr);
      
      // If there are no valid dates, return zero streak
      if (validDates.length === 0) {
        return { currentStreak: 0, longestStreak: 0, lastEntryDate: null };
      }
      
      // Sort valid dates in descending order (newest first)
      const sortedDates = [...validDates].sort((a: string, b: string) => b.localeCompare(a));
      const lastEntryDate = sortedDates[0];
      
      // Calculate current streak
      let currentStreak = 0;
      
      // Check if the user has an entry for today
      const hasEntryToday = validDates.includes(todayStr);
      
      if (hasEntryToday) {
        // Start with today's entry
        currentStreak = 1;
        let checkDate = new Date(today);
        
        // Check backwards for consecutive days
        while (true) {
          // Move to previous day
          checkDate.setDate(checkDate.getDate() - 1);
          const previousDayStr = checkDate.toISOString().split('T')[0];
          
          // If there's an entry for the previous day, increment streak
          if (validDates.includes(previousDayStr)) {
            currentStreak++;
          } else {
            // Break the loop when we find a day without an entry
            break;
          }
        }
      } else {
        // Check if the most recent entry was yesterday
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        if (lastEntryDate === yesterdayStr) {
          // Start streak from yesterday
          currentStreak = 1;
          let checkDate = new Date(yesterday);
          
          // Check backwards for consecutive days
          while (true) {
            // Move to previous day
            checkDate.setDate(checkDate.getDate() - 1);
            const previousDayStr = checkDate.toISOString().split('T')[0];
            
            // If there's an entry for the previous day, increment streak
            if (validDates.includes(previousDayStr)) {
              currentStreak++;
            } else {
              // Break the loop when we find a day without an entry
              break;
            }
          }
        } else {
          // The streak is broken (no entry today or yesterday)
          currentStreak = 0;
        }
      }
      
      // Calculate longest streak
      let longestStreak = 0;
      
      // Convert valid date strings to Date objects for easier manipulation
      const dateObjects = validDates.map((dateStr: string) => new Date(dateStr));
      dateObjects.sort((a: Date, b: Date) => a.getTime() - b.getTime());
      
      // Only calculate longest streak if we have dates
      if (dateObjects.length > 0) {
        let currentLongestStreak = 1;
        
        for (let i = 1; i < dateObjects.length; i++) {
          const currentDate = dateObjects[i];
          const prevDate = dateObjects[i - 1];
          
          // Calculate days between dates
          const diffTime = Math.abs(currentDate.getTime() - prevDate.getTime());
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays === 1) {
            // Consecutive day, increment current streak
            currentLongestStreak++;
          } else {
            // Non-consecutive day, reset streak but save it if it's the longest
            if (currentLongestStreak > longestStreak) {
              longestStreak = currentLongestStreak;
            }
            currentLongestStreak = 1;
          }
        }
        
        // Check one last time after the loop ends
        if (currentLongestStreak > longestStreak) {
          longestStreak = currentLongestStreak;
        }
      }
      
      // The current streak should never be greater than the longest streak
      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
      }
      
      // Return the calculated streak data
      return { 
        currentStreak, 
        longestStreak, 
        lastEntryDate 
      };
      
    } catch (error) {
      console.error(`Error calculating streak for user ${userId}:`, error);
      return { currentStreak: 0, longestStreak: 0, lastEntryDate: null };
    }
  }
}

// Use PostgreSQL storage in production
export const storage = new PostgresStorage();
