import { notes, type Note, type InsertNote, users, type User, type InsertUser } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import pkg from "pg";
const { Pool } = pkg;
import connectPg from "connect-pg-simple";
import { neon, neonConfig } from '@neondatabase/serverless';

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);

// Configure Neon serverless driver (required for edge environments)
neonConfig.fetchConnectionCache = true;

// Create PostgreSQL connection pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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
      timestamp: new Date() 
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
}

export class PostgresStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0] || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || undefined;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const result = await pool.query('SELECT * FROM users WHERE reset_token = $1 AND reset_token_expiry > NOW()', [token]);
    return result.rows[0] || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const { username, password, email, name } = user;
    const result = await pool.query(
      'INSERT INTO users (username, password, email, name, reset_token, reset_token_expiry) VALUES ($1, $2, $3, $4, NULL, NULL) RETURNING *',
      [username, password, email, name || null]
    );
    return result.rows[0];
  }

  async updateUserResetToken(userId: number, token: string, expiry: Date): Promise<void> {
    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3',
      [token, expiry, userId]
    );
  }

  async updateUserPassword(userId: number, password: string): Promise<void> {
    await pool.query(
      'UPDATE users SET password = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2',
      [password, userId]
    );
  }

  async getNotesByDate(date: string, userId?: number): Promise<Note[]> {
    let query = 'SELECT * FROM notes WHERE date = $1';
    const params: any[] = [date];

    if (userId !== undefined) {
      query += ' AND user_id = $2';
      params.push(userId);
    }

    query += ' ORDER BY timestamp DESC';
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  async getAllDates(userId?: number): Promise<string[]> {
    let query = 'SELECT DISTINCT date FROM notes';
    const params: any[] = [];

    if (userId !== undefined) {
      query += ' WHERE user_id = $1';
      params.push(userId);
    }

    query += ' ORDER BY date DESC';
    
    const result = await pool.query(query, params);
    return result.rows.map(row => row.date);
  }

  async createNote(note: InsertNote): Promise<Note> {
    const { content, date, userId } = note;
    const result = await pool.query(
      'INSERT INTO notes (content, date, user_id, timestamp) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [content, date, userId]
    );
    return result.rows[0];
  }

  async deleteNote(noteId: number, userId: number): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id',
      [noteId, userId]
    );
    
    return (result.rowCount as number) > 0;
  }

  async getRecentDays(limit: number, userId?: number): Promise<{ date: string; count: number }[]> {
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
    
    const result = await pool.query(query, params);
    return result.rows.map(row => ({
      date: row.date,
      count: parseInt(row.count, 10)
    }));
  }

  async getDatesWithNotes(userId?: number): Promise<string[]> {
    let query = 'SELECT DISTINCT date FROM notes';
    const params: any[] = [];

    if (userId !== undefined) {
      query += ' WHERE user_id = $1';
      params.push(userId);
    }
    
    const result = await pool.query(query, params);
    return result.rows.map(row => row.date);
  }
}

// Use PostgreSQL storage in production
export const storage = new PostgresStorage();
