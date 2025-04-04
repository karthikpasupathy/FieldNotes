import { 
  notes, 
  type Note, 
  type InsertNote, 
  users, 
  type User, 
  type InsertUser,
  periodAnalyses,
  type PeriodAnalysis,
  type InsertPeriodAnalysis
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { Pool } from "pg";
import connectPg from "connect-pg-simple";
import { pool } from "./db"; // Import pool from db.ts to ensure we use the same pool instance

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);

// No need to recreate pool here, imported from db.ts

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
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
  // Moments related methods
  toggleMoment(noteId: number, userId: number): Promise<{ success: boolean; isNowMoment?: boolean }>;
  getMoments(userId: number): Promise<Note[]>;
  analyzeMoments(userId: number): Promise<string>;
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

  async analyzeMoments(userId: number): Promise<string> {
    // This method would normally call OpenAI, but for MemStorage, we'll return a placeholder
    const moments = await this.getMoments(userId);
    if (moments.length === 0) {
      return "No moments found to analyze.";
    }
    return `Analysis of ${moments.length} special moments. Add OpenAI integration for real analysis.`;
  }
}

export class PostgresStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    // Set up PostgreSQL session store with error handling
    try {
      this.sessionStore = new PostgresSessionStore({
        pool,
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
      return await pool.query(query, params);
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
      let query = 'SELECT * FROM notes WHERE date = $1';
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
      const { content, date, userId, isMoment } = note;
      const result = await this.executeQuery(
        'INSERT INTO notes (content, date, user_id, timestamp, analysis, is_moment) VALUES ($1, $2, $3, NOW(), NULL, $4) RETURNING *',
        [content, date, userId, isMoment || false]
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
        SELECT * FROM notes 
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
        'SELECT * FROM notes WHERE user_id = $1 AND is_moment = true ORDER BY timestamp DESC',
        [userId]
      );
      
      return result.rows;
    } catch (error) {
      console.error(`Error getting moments for user ${userId}:`, error);
      return [];
    }
  }

  async analyzeMoments(userId: number): Promise<string> {
    try {
      const moments = await this.getMoments(userId);
      
      if (moments.length === 0) {
        return "No moments found to analyze.";
      }
      
      // Here you would integrate with the OpenAI service to generate an analysis
      // For now we'll return a placeholder message
      return `Analysis of ${moments.length} special moments that you've marked as important.`;
      
      // TODO: Integrate with OpenAI for real analysis
      // const momentsText = moments.map(m => m.content).join('\n\n');
      // return analyzeNotes(moments);
    } catch (error) {
      console.error(`Error analyzing moments for user ${userId}:`, error);
      return "An error occurred while analyzing your moments.";
    }
  }
}

// Use PostgreSQL storage in production
export const storage = new PostgresStorage();
