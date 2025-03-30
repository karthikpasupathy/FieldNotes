import { 
  notes, 
  type Note, 
  type InsertNote, 
  users, 
  type User, 
  type InsertUser,
  periodAnalyses,
  type PeriodAnalysis,
  type InsertPeriodAnalysis,
  userLogins,
  type UserLogin,
  type InsertUserLogin
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { Pool } from "pg";
import connectPg from "connect-pg-simple";
import { pool } from "./db"; // Import pool from db.ts to ensure we use the same pool instance
import { and, count, eq, gte, sql } from "drizzle-orm";

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
  recordUserLogin(userId: number): Promise<void>;
  // Admin Analytics
  getTotalUsers(): Promise<number>;
  getActiveUsers(days: number): Promise<number>;
  getTotalNotes(): Promise<number>;
  getTotalAnalyses(): Promise<{dailyCount: number, weeklyCount: number, monthlyCount: number}>;
  getSignupsByDate(days: number): Promise<{date: string, count: number}[]>;
  getUserActivity(days: number): Promise<{username: string, noteCount: number, lastActive: Date}[]>;
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private notes: Map<number, Note>;
  private periodAnalyses: Map<number, PeriodAnalysis>;
  private userLogins: Map<number, UserLogin[]>;
  private userCurrentId: number;
  private noteCurrentId: number;
  private periodAnalysisCurrentId: number;
  private userLoginCurrentId: number;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.notes = new Map();
    this.periodAnalyses = new Map();
    this.userLogins = new Map();
    this.userCurrentId = 1;
    this.noteCurrentId = 1;
    this.periodAnalysisCurrentId = 1;
    this.userLoginCurrentId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
  }
  
  // Function to reset all data for deployment/testing
  reset() {
    this.users.clear();
    this.notes.clear();
    this.periodAnalyses.clear();
    this.userLogins.clear();
    this.userCurrentId = 1;
    this.noteCurrentId = 1;
    this.periodAnalysisCurrentId = 1;
    this.userLoginCurrentId = 1;
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
      resetTokenExpiry: null,
      isAdmin: false,
      createdAt: new Date()
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
      analysis: null
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

  async recordUserLogin(userId: number): Promise<void> {
    // Get or create user login array for this user
    let userLogins = this.userLogins.get(userId) || [];
    
    // Add new login
    userLogins.push({
      id: this.userLoginCurrentId++,
      userId,
      timestamp: new Date()
    });
    
    // Update the map
    this.userLogins.set(userId, userLogins);
  }

  // Admin Analytics Methods
  async getTotalUsers(): Promise<number> {
    return this.users.size;
  }

  async getActiveUsers(days: number): Promise<number> {
    const activeUserIds = new Set<number>();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    // Check user logins within the period
    Array.from(this.userLogins.keys()).forEach(userId => {
      const logins = this.userLogins.get(userId) || [];
      for (const login of logins) {
        if (login.timestamp >= cutoffDate) {
          activeUserIds.add(userId);
          break;
        }
      }
    });
    
    return activeUserIds.size;
  }

  async getTotalNotes(): Promise<number> {
    return this.notes.size;
  }

  async getTotalAnalyses(): Promise<{dailyCount: number, weeklyCount: number, monthlyCount: number}> {
    // Count daily analyses (notes with non-null analysis field)
    const dailyCount = Array.from(this.notes.values())
      .filter(note => note.analysis !== null).length;
    
    // Count weekly analyses
    const weeklyCount = Array.from(this.periodAnalyses.values())
      .filter(analysis => analysis.periodType === 'week').length;
    
    // Count monthly analyses
    const monthlyCount = Array.from(this.periodAnalyses.values())
      .filter(analysis => analysis.periodType === 'month').length;
    
    return { dailyCount, weeklyCount, monthlyCount };
  }

  async getSignupsByDate(days: number): Promise<{date: string, count: number}[]> {
    const dateMap = new Map<string, number>();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    // Filter users created within the period
    Array.from(this.users.values())
      .filter(user => user.createdAt >= cutoffDate)
      .forEach(user => {
        const dateStr = user.createdAt.toISOString().split('T')[0]; // YYYY-MM-DD
        const count = dateMap.get(dateStr) || 0;
        dateMap.set(dateStr, count + 1);
      });
    
    // Convert to array and sort
    return Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  async getUserActivity(days: number): Promise<{username: string, noteCount: number, lastActive: Date}[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const userActivity = Array.from(this.users.values()).map(user => {
      // Count recent notes for this user
      const noteCount = Array.from(this.notes.values())
        .filter(note => note.userId === user.id && note.timestamp >= cutoffDate)
        .length;
      
      // Find latest login for this user
      const userLogins = this.userLogins.get(user.id) || [];
      let lastActive = null;
      
      for (const login of userLogins) {
        if (!lastActive || login.timestamp > lastActive) {
          lastActive = login.timestamp;
        }
      }
      
      return {
        username: user.username,
        noteCount,
        lastActive: lastActive || user.createdAt
      };
    });
    
    // Sort by last active timestamp, most recent first
    return userActivity.sort((a, b) => {
      if (a.lastActive && b.lastActive) {
        return b.lastActive.getTime() - a.lastActive.getTime();
      }
      return a.lastActive ? -1 : 1;
    }).slice(0, 50); // Limit to 50 users like the PostgreSQL implementation
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
        'INSERT INTO users (username, password, email, name, reset_token, reset_token_expiry, is_admin, created_at) VALUES ($1, $2, $3, $4, NULL, NULL, FALSE, NOW()) RETURNING *',
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
      const { content, date, userId } = note;
      const result = await this.executeQuery(
        'INSERT INTO notes (content, date, user_id, timestamp, analysis) VALUES ($1, $2, $3, NOW(), NULL) RETURNING *',
        [content, date, userId]
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

  async recordUserLogin(userId: number): Promise<void> {
    try {
      await this.executeQuery(
        'INSERT INTO user_logins (user_id, timestamp) VALUES ($1, NOW())',
        [userId]
      );
    } catch (error) {
      console.error(`Error recording user login for user ${userId}:`, error);
      // Don't throw error here, just log it - we don't want to break login flow
    }
  }

  // Admin Analytics Methods
  async getTotalUsers(): Promise<number> {
    try {
      const result = await this.executeQuery('SELECT COUNT(*) as count FROM users');
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      console.error('Error getting total users count:', error);
      return 0;
    }
  }

  async getActiveUsers(days: number): Promise<number> {
    try {
      const result = await this.executeQuery(
        `SELECT COUNT(DISTINCT user_id) as count 
         FROM user_logins 
         WHERE timestamp > NOW() - INTERVAL '${days} days'`
      );
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      console.error(`Error getting active users count for past ${days} days:`, error);
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

  async getTotalAnalyses(): Promise<{dailyCount: number, weeklyCount: number, monthlyCount: number}> {
    try {
      // Count daily analyses (notes with non-null analysis field)
      const dailyResult = await this.executeQuery(
        'SELECT COUNT(*) as count FROM notes WHERE analysis IS NOT NULL'
      );
      
      // Count weekly analyses
      const weeklyResult = await this.executeQuery(
        "SELECT COUNT(*) as count FROM period_analyses WHERE period_type = 'week'"
      );
      
      // Count monthly analyses
      const monthlyResult = await this.executeQuery(
        "SELECT COUNT(*) as count FROM period_analyses WHERE period_type = 'month'"
      );
      
      return {
        dailyCount: parseInt(dailyResult.rows[0].count, 10),
        weeklyCount: parseInt(weeklyResult.rows[0].count, 10),
        monthlyCount: parseInt(monthlyResult.rows[0].count, 10)
      };
    } catch (error) {
      console.error('Error getting total analyses counts:', error);
      return { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 };
    }
  }

  async getSignupsByDate(days: number): Promise<{date: string, count: number}[]> {
    try {
      const result = await this.executeQuery(
        `SELECT 
          TO_CHAR(created_at, 'YYYY-MM-DD') as date,
          COUNT(*) as count 
         FROM users 
         WHERE created_at > NOW() - INTERVAL '${days} days'
         GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
         ORDER BY date DESC`
      );
      
      return result.rows.map((row: any) => ({
        date: row.date,
        count: parseInt(row.count, 10)
      }));
    } catch (error) {
      console.error(`Error getting signups by date for past ${days} days:`, error);
      return [];
    }
  }

  async getUserActivity(days: number): Promise<{username: string, noteCount: number, lastActive: Date}[]> {
    try {
      const result = await this.executeQuery(
        `SELECT 
          u.username,
          COUNT(n.id) as note_count,
          MAX(l.timestamp) as last_active
         FROM users u
         LEFT JOIN notes n ON u.id = n.user_id AND n.timestamp > NOW() - INTERVAL '${days} days'
         LEFT JOIN user_logins l ON u.id = l.user_id
         GROUP BY u.username
         ORDER BY last_active DESC NULLS LAST
         LIMIT 50`
      );
      
      return result.rows.map((row: any) => ({
        username: row.username,
        noteCount: parseInt(row.note_count, 10),
        lastActive: row.last_active ? new Date(row.last_active) : null
      }));
    } catch (error) {
      console.error(`Error getting user activity for past ${days} days:`, error);
      return [];
    }
  }
}

// Use PostgreSQL storage in production
export const storage = new PostgresStorage();
