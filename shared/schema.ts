import { pgTable, text, serial, integer, timestamp, varchar, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  name: text("name"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userLogins = pgTable("user_logins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  date: text("date").notNull(), // Format: YYYY-MM-DD for easy querying by date
  userId: integer("user_id").notNull(),
  analysis: text("analysis"),
});

export const periodAnalyses = pgTable("period_analyses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  startDate: varchar("start_date", { length: 10 }).notNull(), // YYYY-MM-DD
  endDate: varchar("end_date", { length: 10 }).notNull(),     // YYYY-MM-DD
  periodType: varchar("period_type", { length: 10 }).notNull(), // "week" or "month"
  analysis: text("analysis").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  name: true,
});

export const insertNoteSchema = createInsertSchema(notes).pick({
  content: true,
  date: true,
  userId: true,
});

export const noteContentSchema = z.object({
  content: z.string().min(1).max(280),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
});

export const userLoginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
});

export const userRegisterSchema = insertUserSchema.extend({
  password: z.string().min(6),
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(6),
});

export const insertUserLoginSchema = createInsertSchema(userLogins).pick({
  userId: true,
});

export const insertPeriodAnalysisSchema = createInsertSchema(periodAnalyses).pick({
  userId: true,
  startDate: true,
  endDate: true,
  periodType: true,
  analysis: true,
});

export const periodAnalysisRequestSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be in YYYY-MM-DD format"),
  periodType: z.enum(["week", "month"]),
});

export const adminLoginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notes.$inferSelect;
export type InsertUserLogin = z.infer<typeof insertUserLoginSchema>;
export type UserLogin = typeof userLogins.$inferSelect;
export type InsertPeriodAnalysis = z.infer<typeof insertPeriodAnalysisSchema>;
export type PeriodAnalysis = typeof periodAnalyses.$inferSelect;
