import { notes, type Note, type InsertNote, users, type User, type InsertUser } from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getNotesByDate(date: string): Promise<Note[]>;
  getAllDates(): Promise<string[]>;
  createNote(note: InsertNote): Promise<Note>;
  getRecentDays(limit: number): Promise<{ date: string; count: number }[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private notes: Map<number, Note>;
  private userCurrentId: number;
  private noteCurrentId: number;

  constructor() {
    this.users = new Map();
    this.notes = new Map();
    this.userCurrentId = 1;
    this.noteCurrentId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getNotesByDate(date: string): Promise<Note[]> {
    return Array.from(this.notes.values())
      .filter(note => note.date === date)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async getAllDates(): Promise<string[]> {
    const dates = new Set<string>();
    Array.from(this.notes.values()).forEach(note => {
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

  async getRecentDays(limit: number): Promise<{ date: string; count: number }[]> {
    const dateMap = new Map<string, number>();
    
    // Count notes per date
    Array.from(this.notes.values()).forEach(note => {
      const count = dateMap.get(note.date) || 0;
      dateMap.set(note.date, count + 1);
    });
    
    // Convert to array and sort
    return Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }
}

export const storage = new MemStorage();
