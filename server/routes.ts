import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { noteContentSchema, resetPasswordSchema, periodAnalysisRequestSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { setupAuth, generateResetToken, hashPassword } from "./auth";
import { randomBytes } from "crypto";
import { z } from "zod";
import { analyzeNotes, analyzePeriodNotes } from "./openai";

// Middleware to check if user is authenticated
function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
  setupAuth(app);
  
  // No longer resetting storage at startup so user data persists
  
  // Password reset request endpoint
  app.post("/api/reset-password-request", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        // Don't reveal that the email doesn't exist for security reasons
        return res.status(200).json({ message: "If the email exists, a reset token has been sent" });
      }
      
      // Generate and store reset token
      const token = await generateResetToken();
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 1); // Token expires in 1 hour
      
      await storage.updateUserResetToken(user.id, token, expiry);
      
      // In a real app, we would send an email with the token
      // For demo purposes, we'll just log it
      console.log(`Reset token for ${email}: ${token}`);
      
      res.status(200).json({ message: "If the email exists, a reset token has been sent" });
    } catch (error) {
      console.error("Error requesting password reset:", error);
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  });
  
  // Password reset endpoint
  app.post("/api/reset-password", async (req, res) => {
    try {
      const validation = resetPasswordSchema.safeParse(req.body);
      
      if (!validation.success) {
        const errorMessage = fromZodError(validation.error).message;
        return res.status(400).json({ message: errorMessage });
      }
      
      const { token, password } = validation.data;
      
      // Find user by reset token
      const user = await storage.getUserByResetToken(token);
      
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }
      
      // Check if token is expired (for the demo, token should not be used after 1 hour)
      const now = new Date();
      if (user.resetTokenExpiry && new Date(user.resetTokenExpiry) < now) {
        return res.status(400).json({ message: "Token has expired" });
      }
      
      // Hash the new password and update user
      const hashedPassword = await hashPassword(password);
      await storage.updateUserPassword(user.id, hashedPassword);
      
      // Clear reset token
      await storage.updateUserResetToken(user.id, "", new Date());
      
      res.status(200).json({ message: "Password has been reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Notes API routes
  app.get("/api/notes/:date", isAuthenticated, async (req, res) => {
    try {
      const { date } = req.params;
      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
      }
      
      const userId = req.user?.id;
      const notes = await storage.getNotesByDate(date, userId);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching notes:", error);
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  app.post("/api/notes", isAuthenticated, async (req, res) => {
    try {
      const validation = noteContentSchema.safeParse(req.body);
      
      if (!validation.success) {
        const errorMessage = fromZodError(validation.error).message;
        return res.status(400).json({ message: errorMessage });
      }
      
      const { content, date } = validation.data;
      const userId = req.user!.id;
      
      const note = await storage.createNote({
        content,
        date,
        userId
      });
      
      res.status(201).json(note);
    } catch (error) {
      console.error("Error creating note:", error);
      res.status(500).json({ message: "Failed to create note" });
    }
  });

  app.get("/api/dates", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      const dates = await storage.getAllDates(userId);
      res.json(dates);
    } catch (error) {
      console.error("Error fetching dates:", error);
      res.status(500).json({ message: "Failed to fetch dates" });
    }
  });

  app.get("/api/recent-days", isAuthenticated, async (req, res) => {
    try {
      const limit = Number(req.query.limit) || 5;
      const userId = req.user?.id;
      const recentDays = await storage.getRecentDays(limit, userId);
      res.json(recentDays);
    } catch (error) {
      console.error("Error fetching recent days:", error);
      res.status(500).json({ message: "Failed to fetch recent days" });
    }
  });

  // Endpoint to get dates with notes for calendar highlighting
  app.get("/api/dates-with-notes", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      const dates = await storage.getDatesWithNotes(userId);
      res.json(dates);
    } catch (error) {
      console.error("Error fetching dates with notes:", error);
      res.status(500).json({ message: "Failed to fetch dates with notes" });
    }
  });

  // Endpoint to export notes for a specific day
  app.get("/api/export/:date", isAuthenticated, async (req, res) => {
    try {
      const { date } = req.params;
      
      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
      }
      
      const userId = req.user?.id;
      const notes = await storage.getNotesByDate(date, userId);
      
      if (notes.length === 0) {
        return res.status(404).json({ message: "No notes found for this date" });
      }
      
      // Format the date for the filename and header
      const dateObj = new Date(date);
      const formattedDate = dateObj.toLocaleDateString('en-US', { 
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      // Create markdown content
      let markdown = `# Field Notes: ${formattedDate}\n\n`;
      
      notes.forEach(note => {
        const timestamp = new Date(note.timestamp).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });
        markdown += `## ${timestamp}\n${note.content}\n\n`;
      });
      
      // Set response headers for downloading as a file
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="field-notes-${date}.md"`);
      
      res.send(markdown);
    } catch (error) {
      console.error("Error exporting notes:", error);
      res.status(500).json({ message: "Failed to export notes" });
    }
  });

  // Endpoint to analyze notes for a specific day
  app.get("/api/analyze/:date", isAuthenticated, async (req, res) => {
    try {
      const { date } = req.params;
      const forceRegenerate = req.query.regenerate === 'true';
      
      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
      }
      
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      // Check if we already have an analysis for this date (unless regeneration is forced)
      if (!forceRegenerate) {
        const existingAnalysis = await storage.getAnalysis(date, userId);
        
        if (existingAnalysis) {
          // Return the existing analysis if it exists
          return res.json({ analysis: existingAnalysis });
        }
      }
      
      // Get the notes and generate a new analysis
      const notes = await storage.getNotesByDate(date, userId);
      
      if (notes.length === 0) {
        return res.status(404).json({ message: "No notes found for this date" });
      }
      
      // Use OpenAI to analyze the notes
      const analysis = await analyzeNotes(notes);
      
      // Save the analysis to the database for future retrieval
      await storage.saveAnalysis(date, analysis, userId);
      
      res.json({ analysis });
    } catch (error) {
      console.error("Error analyzing notes:", error);
      res.status(500).json({ message: "Failed to analyze notes" });
    }
  });
  
  // Delete a note
  app.delete("/api/notes/:id", isAuthenticated, async (req, res) => {
    try {
      const noteId = parseInt(req.params.id, 10);
      
      if (isNaN(noteId)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }
      
      const userId = req.user!.id;
      const success = await storage.deleteNote(noteId, userId);
      
      if (!success) {
        return res.status(404).json({ message: "Note not found or you don't have permission to delete it" });
      }
      
      res.status(200).json({ message: "Note deleted successfully" });
    } catch (error) {
      console.error("Error deleting note:", error);
      res.status(500).json({ message: "Failed to delete note" });
    }
  });

  // Endpoint to analyze notes for a period (week or month)
  app.post("/api/analyze-period", isAuthenticated, async (req, res) => {
    try {
      // Validate request body
      const validation = periodAnalysisRequestSchema.safeParse(req.body);
      
      if (!validation.success) {
        const errorMessage = fromZodError(validation.error).message;
        return res.status(400).json({ message: errorMessage });
      }
      
      const { startDate, endDate, periodType } = validation.data;
      const userId = req.user!.id;
      const forceRegenerate = req.query.regenerate === 'true';
      
      // Check if we already have an analysis for this period (unless regeneration is forced)
      if (!forceRegenerate) {
        const existingAnalysis = await storage.getPeriodAnalysis(startDate, endDate, periodType, userId);
        
        if (existingAnalysis) {
          // Return the existing analysis if it exists
          return res.json({ analysis: existingAnalysis.analysis });
        }
      }
      
      // Get notes within the date range
      const notes = await storage.getNotesByDateRange(startDate, endDate, userId);
      
      if (notes.length === 0) {
        return res.status(404).json({ message: `No notes found for this ${periodType}` });
      }
      
      // Use OpenAI to analyze the notes
      const analysis = await analyzePeriodNotes(notes, startDate, endDate, periodType);
      
      // Save the analysis for future use
      const savedAnalysis = await storage.savePeriodAnalysis({
        userId,
        startDate,
        endDate,
        periodType,
        analysis
      });
      
      res.json({ analysis: savedAnalysis.analysis });
    } catch (error) {
      console.error(`Error analyzing period notes:`, error);
      res.status(500).json({ message: `Failed to analyze ${req.body?.periodType || 'period'} notes` });
    }
  });
  
  // Endpoint to retrieve a saved period analysis
  app.get("/api/period-analysis", isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate, periodType } = req.query;
      
      // Validate query parameters
      if (!startDate || !endDate || !periodType) {
        return res.status(400).json({ message: "Missing required parameters: startDate, endDate, and periodType" });
      }
      
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate as string) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate as string)) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
      }
      
      if (periodType !== 'week' && periodType !== 'month') {
        return res.status(400).json({ message: "periodType must be 'week' or 'month'" });
      }
      
      const userId = req.user!.id;
      
      // Get the saved analysis
      const analysis = await storage.getPeriodAnalysis(
        startDate as string, 
        endDate as string, 
        periodType as string, 
        userId
      );
      
      if (!analysis) {
        return res.status(404).json({ message: `No ${periodType} analysis found for the specified date range` });
      }
      
      res.json({ analysis: analysis.analysis });
    } catch (error) {
      console.error("Error fetching period analysis:", error);
      res.status(500).json({ message: "Failed to fetch period analysis" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
