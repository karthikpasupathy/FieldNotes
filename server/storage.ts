import { notes, type Note, type InsertNote, users, type User, type InsertUser } from "@shared/schema";
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
  getAllDates(userId?: number): Promise<string[]>;
  createNote(note: InsertNote): Promise<Note>;
  deleteNote(noteId: number, userId: number): Promise<boolean>;
  getRecentDays(limit: number, userId?: number): Promise<{ date: string; count: number }[]>;
  getDatesWithNotes(userId?: number): Promise<string[]>;
  saveAnalysis(date: string, analysis: string, userId: number): Promise<void>;
  getAnalysis(date: string, userId: number): Promise<string | null>;
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private notes: Map<number, Note>;
  private userCurrentId: number;
  private noteCurrentId: number;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.notes = new Map();
    this.userCurrentId = 1;
    this.noteCurrentId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
  }
  
  // Function to reset all data for deployment/testing
  reset() {
    this.users.clear();
    this.notes.clear();
    this.userCurrentId = 1;
    this.noteCurrentId = 1;
    console.log("Storage reset: All users and notes have been removed");
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
}

// Use PostgreSQL storage in production
export const storage = new PostgresStorage();
