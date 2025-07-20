import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { noteContentSchema, resetPasswordSchema, periodAnalysisRequestSchema, type Note, mojoAuthEmailSchema, mojoAuthPhoneSchema, mojoAuthOTPSchema, mojoAuthStatusSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { setupAuth, generateResetToken, hashPassword } from "./auth";
import { randomBytes } from "crypto";
import { z } from "zod";
import { analyzeNotes, analyzePeriodNotes } from "./openai";
import JSZip from "jszip";
import session from "express-session";
import { db, primaryPool } from "./db";
import { 
  sendMagicLink, 
  checkMagicLinkStatus, 
  resendMagicLink, 
  sendEmailOTP, 
  verifyEmailOTP, 
  resendEmailOTP, 
  sendPhoneOTP, 
  verifyPhoneOTP, 
  resendPhoneOTP, 
  verifyToken, 
  authenticateMojoAuth, 
  isMojoAuthConfigured 
} from "./mojoauth";

// Extend the Express session type
declare module "express-session" {
  interface SessionData {
    isAdmin: boolean;
  }
}

// Middleware to check if user is authenticated
function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && req.user) {
    return next();
  }
  res.status(401).json({ message: "Not authenticated" });
}

// Middleware to check if user is admin
function isAdmin(req: Request, res: Response, next: NextFunction) {
  // Check if user is authenticated and is admin
  if (req.session?.isAdmin) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized: Admin access required" });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
  setupAuth(app);
  
  // No longer resetting storage at startup so user data persists
  
  // Attempt to alter the notes table to add is_moment and is_idea columns if they don't exist
  try {
    await primaryPool.query(`
      ALTER TABLE notes 
      ADD COLUMN IF NOT EXISTS is_moment BOOLEAN DEFAULT FALSE
    `);
    await primaryPool.query(`
      ALTER TABLE notes 
      ADD COLUMN IF NOT EXISTS is_idea BOOLEAN DEFAULT FALSE
    `);
    console.log("Database schema updated to support Moments and Ideas features");
  } catch (error) {
    console.error("Error updating database schema for Moments and Ideas:", error);
  }
  
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

  // Check MojoAuth configuration status
  app.get("/api/auth/mojoauth/status", (req, res) => {
    res.json({ 
      configured: isMojoAuthConfigured(),
      available: !!process.env.MOJOAUTH_API_KEY 
    });
  });

  // MojoAuth Magic Link routes
  app.post("/api/auth/mojoauth/magic-link/send", async (req, res) => {
    try {
      const { email, redirectUrl } = mojoAuthEmailSchema.parse(req.body);
      
      const response = await sendMagicLink(email, redirectUrl);
      res.json({ 
        success: true, 
        stateId: response.state_id,
        message: "Magic link sent to your email" 
      });
    } catch (error: any) {
      console.error("Magic link send error:", error);
      res.status(400).json({ 
        error: error.message || "Failed to send magic link" 
      });
    }
  });

  app.post("/api/auth/mojoauth/magic-link/status", async (req, res) => {
    try {
      const { stateId } = mojoAuthStatusSchema.parse(req.body);
      
      const response = await checkMagicLinkStatus(stateId);
      console.log("MojoAuth magic link full response:", JSON.stringify(response, null, 2));
      
      // Check for MojoAuth error response
      if (response.code) {
        return res.status(400).json({ 
          error: response.message || "Authentication failed",
          description: response.description 
        });
      }
      
      if (response.authenticated) {
        // User successfully authenticated, handle user creation/login
        if (!response.user) {
          return res.status(400).json({ error: "Authentication failed - no user data" });
        }
        
        const mojoAuthUser = response.user;
        console.log("MojoAuth user response:", JSON.stringify(mojoAuthUser, null, 2));
        
        // Check if user already exists by MojoAuth ID first
        let user = await storage.getUserByMojoAuthId(mojoAuthUser.user_id);
        
        if (!user) {
          // Check if user exists by email (traditional user)
          user = await storage.getUserByEmail(mojoAuthUser.identifier);
          
          if (user) {
            // Link existing traditional user with MojoAuth
            console.log("Linking existing user:", user.id, "with MojoAuth ID:", mojoAuthUser.user_id);
            await storage.linkUserWithMojoAuth(user.id, mojoAuthUser.user_id, mojoAuthUser.phone);
            // Refetch user to get updated data - try multiple methods to ensure we get the user
            let linkedUser = await storage.getUserByMojoAuthId(mojoAuthUser.user_id);
            if (!linkedUser) {
              linkedUser = await storage.getUser(user.id);
            }
            user = linkedUser;
            console.log("User after linking:", user ? { id: user.id, email: user.email, mojoAuthId: user.mojoauthId } : 'null');
          } else {
            // Create new MojoAuth user
            user = await storage.createMojoAuthUser(
              mojoAuthUser.identifier,
              mojoAuthUser.user_id,
              mojoAuthUser.identifier.split('@')[0],
              mojoAuthUser.phone
            );
          }
        }
        
        if (!user) {
          console.error("User object is null after creation/linking");
          return res.status(500).json({ error: "Failed to create or retrieve user" });
        }
        
        console.log("About to create session for user:", { id: user.id, email: user.email });
        
        // Set up session for traditional auth compatibility
        req.login(user, (err) => {
          if (err) {
            console.error("Session login error:", err);
            return res.status(500).json({ error: "Failed to create session" });
          }
          
          console.log("Session created successfully for user:", user.id);
          
          res.json({
            authenticated: true,
            user: {
              id: user.id,
              email: user.email,
              name: user.name
            },
            token: response.oauth?.access_token
          });
        });
      } else {
        res.json({ authenticated: false });
      }
    } catch (error: any) {
      console.error("Magic link status error:", error);
      res.status(400).json({ 
        error: error.message || "Failed to check magic link status" 
      });
    }
  });

  app.post("/api/auth/mojoauth/email-otp/send", async (req, res) => {
    try {
      const { email } = mojoAuthEmailSchema.parse(req.body);
      
      const response = await sendEmailOTP(email);
      res.json({ 
        success: true, 
        stateId: response.state_id,
        message: "OTP sent to your email" 
      });
    } catch (error: any) {
      console.error("Email OTP send error:", error);
      res.status(400).json({ 
        error: error.message || "Failed to send email OTP" 
      });
    }
  });

  app.post("/api/auth/mojoauth/email-otp/verify", async (req, res) => {
    try {
      const { otp, stateId } = mojoAuthOTPSchema.parse(req.body);
      
      const response = await verifyEmailOTP(otp, stateId);
      console.log("MojoAuth verifyEmailOTP full response:", JSON.stringify(response, null, 2));
      
      // Check for MojoAuth error response
      if (response.code) {
        return res.status(400).json({ 
          error: response.message || "Authentication failed",
          description: response.description 
        });
      }
      
      // Check for successful authentication
      if (!response.authenticated || !response.user) {
        return res.status(400).json({ error: "Authentication failed" });
      }
      
      const mojoAuthUser = response.user;
      console.log("MojoAuth user response:", JSON.stringify(mojoAuthUser, null, 2));
      
      // Check if user already exists by MojoAuth ID first
      let user = await storage.getUserByMojoAuthId(mojoAuthUser.user_id);
      
      if (!user) {
        // Check if user exists by email (traditional user)
        user = await storage.getUserByEmail(mojoAuthUser.identifier);
        
        if (user) {
          // Link existing traditional user with MojoAuth
          console.log("✅ Found existing user by email:", { id: user.id, email: user.email, username: user.username });
          console.log("🔗 Linking existing user:", user.id, "with MojoAuth ID:", mojoAuthUser.user_id);
          await storage.linkUserWithMojoAuth(user.id, mojoAuthUser.user_id, mojoAuthUser.phone);
          
          // Refetch user to get updated data - try multiple methods to ensure we get the user
          let linkedUser = await storage.getUserByMojoAuthId(mojoAuthUser.user_id);
          if (!linkedUser) {
            console.log("⚠️ getUserByMojoAuthId failed, trying getUser by ID");
            linkedUser = await storage.getUser(user.id);
          }
          
          user = linkedUser;
          console.log("✅ User after linking:", user ? { 
            id: user.id, 
            email: user.email, 
            username: user.username,
            mojoAuthId: user.mojoauthId,
            authProvider: user.authProvider 
          } : 'null');
        } else {
          // Create new MojoAuth user
          user = await storage.createMojoAuthUser(
            mojoAuthUser.identifier,
            mojoAuthUser.user_id,
            mojoAuthUser.identifier.split('@')[0],
            mojoAuthUser.phone
          );
        }
      }
      
      if (!user) {
        console.error("User object is null after creation/linking");
        return res.status(500).json({ error: "Failed to create or retrieve user" });
      }
      
      console.log("About to create session for user:", { id: user.id, email: user.email });
      
      // Use Passport's req.login() for proper session integration
      req.login(user, (err) => {
        if (err) {
          console.error("Passport login error:", err);
          return res.status(500).json({ error: "Failed to create session" });
        }
        
        console.log("✅ Passport session created successfully for user:", user.id);
        console.log("Session data:", { 
          sessionId: req.sessionID, 
          isAuthenticated: req.isAuthenticated(),
          userId: req.user?.id,
          userEmail: req.user?.email
        });
        
        res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            username: user.username
          }
        });
      });
    } catch (error: any) {
      console.error("Email OTP verification error:", error);
      res.status(400).json({ 
        error: error.message || "Invalid OTP or expired" 
      });
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
      
      const userId = req.user!.id;
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
      const userId = req.user!.id;
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
      const userId = req.user!.id;
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
      const userId = req.user!.id;
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
      
      const userId = req.user!.id;
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
      let markdown = `# Daynotes: ${formattedDate}\n\n`;
      
      notes.forEach(note => {
        const timestamp = new Date(note.timestamp).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });
        markdown += `## ${timestamp}\n${note.content}\n\n`;
      });
      
      // Set response headers for downloading as a file
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="daynotes-${date}.md"`);
      
      res.send(markdown);
    } catch (error) {
      console.error("Error exporting notes:", error);
      res.status(500).json({ message: "Failed to export notes" });
    }
  });
  
  // Endpoint to export all notes for a user
  app.get("/api/export-all", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Get all dates with notes for the user
      const dates = await storage.getDatesWithNotes(userId);
      
      if (dates.length === 0) {
        return res.status(404).json({ message: "No notes found for this user" });
      }
      
      // Create a zip file
      const zip = new JSZip();
      
      // Group by year and month for better organization
      const dateGroups = new Map<string, Array<{date: string, dateObj: Date, notes: Note[]}>>();
      
      // Process each date
      for (const date of dates) {
        const notes = await storage.getNotesByDate(date, userId);
        
        if (notes.length === 0) continue;
        
        const dateObj = new Date(date);
        const year = dateObj.getFullYear();
        const month = dateObj.toLocaleString('en-US', { month: 'long' });
        
        const key = `${year}/${month}`;
        if (!dateGroups.has(key)) {
          dateGroups.set(key, []);
        }
        
        const groupData = dateGroups.get(key);
        if (groupData) {
          groupData.push({
            date,
            dateObj,
            notes
          });
        }
      }
      
      // Create folders and files inside the zip
      for (const [folder, dateData] of Array.from(dateGroups.entries())) {
        // Create a folder for each year/month
        const folderRef = zip.folder(folder);
        
        if (folderRef) {
          // Add files for each date
          for (const { date, dateObj, notes } of dateData) {
            const formattedDate = dateObj.toLocaleDateString('en-US', { 
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
            
            // Create markdown content
            let markdown = `# Daynotes: ${formattedDate}\n\n`;
            
            notes.forEach((note: Note) => {
              const timestamp = new Date(note.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              });
              markdown += `## ${timestamp}\n${note.content}\n\n`;
            });
            
            // Add file to the folder
            folderRef.file(`${date}.md`, markdown);
          }
        }
      }
      
      // Generate the zip file
      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: {
          level: 9
        }
      });
      
      // Set response headers for downloading the zip file
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="daynotes-export.zip"`);
      
      // Send the zip file
      res.send(zipBuffer);
    } catch (error) {
      console.error("Error exporting all notes:", error);
      res.status(500).json({ message: "Failed to export all notes" });
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
      
      const userId = req.user!.id;
      
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

  // Admin API Routes
  
  // Admin login endpoint
  app.post("/api/admin-login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      // Check against hardcoded admin credentials
      if (username === "admin" && password === "admin@123") {
        // Set admin session flag
        req.session.isAdmin = true;
        return res.status(200).json({ success: true });
      }
      
      res.status(401).json({ message: "Invalid admin credentials" });
    } catch (error) {
      console.error("Error during admin login:", error);
      res.status(500).json({ message: "Admin login failed" });
    }
  });
  
  // Admin logout endpoint
  app.post("/api/admin-logout", (req, res) => {
    req.session.isAdmin = false;
    res.status(200).json({ success: true });
  });
  
  // Admin auth check endpoint
  app.get("/api/admin-auth-check", (req, res) => {
    if (req.session?.isAdmin) {
      res.status(200).json({ isAdmin: true });
    } else {
      res.status(401).json({ isAdmin: false });
    }
  });
  
  // Admin statistics endpoint
  app.get("/api/admin-stats", isAdmin, async (req, res) => {
    try {
      // Get total number of registered users
      const totalUsers = await storage.getTotalUsers();
      
      // Get number of active users (logged in at least once in the last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const activeUsers = await storage.getActiveUsersSince(thirtyDaysAgo);
      
      // Get total number of notes
      const totalNotes = await storage.getTotalNotes();
      
      // Get database status from the db interface
      const dbStatus = (db as any).getStatus ? (db as any).getStatus() : { status: 'unknown' };
      
      res.json({
        totalUsers,
        activeUsers,
        totalNotes,
        database: dbStatus
      });
    } catch (error) {
      console.error("Error fetching admin statistics:", error);
      res.status(500).json({ message: "Failed to fetch admin statistics" });
    }
  });
  
  // Database health and status endpoint (admin only)
  app.get("/api/admin-db-status", isAdmin, async (req, res) => {
    try {
      // Get database status from the db interface
      const dbStatus = (db as any).getStatus ? (db as any).getStatus() : { status: 'unknown' };
      
      res.json({
        status: dbStatus,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching database status:", error);
      res.status(500).json({ message: "Failed to retrieve database status" });
    }
  });
  
  // Force database sync (admin only)
  app.post("/api/admin-sync-db", isAdmin, async (req, res) => {
    try {
      if (!(db as any).syncNow) {
        return res.status(400).json({ message: "Database sync not supported" });
      }
      
      const result = await (db as any).syncNow();
      res.json(result);
    } catch (err) {
      const error = err as Error;
      console.error("Error syncing databases:", error);
      res.status(500).json({ message: "Failed to sync databases", error: error.message });
    }
  });
  
  // Force database failover for testing (admin only)
  app.post("/api/admin-force-failover", isAdmin, async (req, res) => {
    try {
      const { target } = req.body;
      
      if (!target || (target !== 'primary' && target !== 'secondary')) {
        return res.status(400).json({ message: "Invalid target. Must be 'primary' or 'secondary'" });
      }
      
      if (!(db as any).forceFailover) {
        return res.status(400).json({ message: "Failover functionality not supported" });
      }
      
      (db as any).forceFailover(target);
      
      res.json({ 
        message: `Manual failover to ${target} database initiated`,
        newStatus: (db as any).getStatus()
      });
    } catch (err) {
      const error = err as Error;
      console.error("Error forcing failover:", error);
      res.status(500).json({ message: "Failed to force failover", error: error.message });
    }
  });
  
  // Admin users list endpoint
  app.get("/api/admin-users", isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      
      // Return only the necessary fields for security
      const usersSanitized = users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name
      }));
      
      res.json(usersSanitized);
    } catch (error) {
      console.error("Error fetching admin user list:", error);
      res.status(500).json({ message: "Failed to fetch user list" });
    }
  });
  
  // Admin active users endpoint
  app.get("/api/admin-active-users", isAdmin, async (req, res) => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const activeUsers = await storage.getActiveUsersWithDetails(thirtyDaysAgo);
      
      // Return only the necessary fields for security
      const activeUsersSanitized = activeUsers.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        lastActive: user.lastActive
      }));
      
      res.json(activeUsersSanitized);
    } catch (error) {
      console.error("Error fetching admin active user list:", error);
      res.status(500).json({ message: "Failed to fetch active user list" });
    }
  });

  // Moments feature API endpoints
  app.post("/api/moments/:noteId", isAuthenticated, async (req, res) => {
    try {
      const noteId = parseInt(req.params.noteId, 10);
      
      if (isNaN(noteId)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }
      
      const userId = req.user!.id;
      const result = await storage.toggleMoment(noteId, userId);
      
      if (!result.success) {
        return res.status(404).json({ message: "Note not found or you don't have permission to update it" });
      }
      
      // Send a specific message based on whether the moment was added or removed
      if (result.isNowMoment) {
        res.status(200).json({ message: "Entry marked as a moment", isNowMoment: true, noteId });
      } else {
        res.status(200).json({ message: "Moment removed", isNowMoment: false, noteId });
      }
    } catch (error) {
      console.error("Error toggling moment status:", error);
      res.status(500).json({ message: "Failed to toggle moment status" });
    }
  });
  
  app.get("/api/moments", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const moments = await storage.getMoments(userId);
      res.json(moments);
    } catch (error) {
      console.error("Error fetching moments:", error);
      res.status(500).json({ message: "Failed to fetch moments" });
    }
  });

  // Ideas feature API endpoints
  app.post("/api/ideas/:noteId", isAuthenticated, async (req, res) => {
    try {
      const noteId = parseInt(req.params.noteId, 10);
      
      if (isNaN(noteId)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }
      
      const userId = req.user!.id;
      const result = await storage.toggleIdea(noteId, userId);
      
      if (!result.success) {
        return res.status(404).json({ message: "Note not found or you don't have permission to update it" });
      }
      
      // Send a specific message based on whether the idea was added or removed
      if (result.isNowIdea) {
        res.status(200).json({ message: "Entry marked as an idea", isNowIdea: true, noteId });
      } else {
        res.status(200).json({ message: "Idea removed", isNowIdea: false, noteId });
      }
    } catch (error) {
      console.error("Error toggling idea status:", error);
      res.status(500).json({ message: "Failed to toggle idea status" });
    }
  });
  
  app.get("/api/ideas", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const ideas = await storage.getIdeas(userId);
      res.json(ideas);
    } catch (error) {
      console.error("Error fetching ideas:", error);
      res.status(500).json({ message: "Failed to fetch ideas" });
    }
  });
  
  // Endpoint to get user's streak data
  app.get("/api/streak", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const streakData = await storage.getUserStreak(userId);
      res.json(streakData);
    } catch (error) {
      console.error("Error fetching user streak:", error);
      res.status(500).json({ message: "Failed to fetch streak data" });
    }
  });
  
  // Search notes endpoint
  app.get("/api/search", isAuthenticated, async (req, res) => {
    try {
      const { query } = req.query;
      const userId = req.user!.id;
      
      // Validate the search query
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({ message: "Search query is required" });
      }
      
      // Perform the search
      const results = await storage.searchNotes(query, userId);
      
      res.json(results);
    } catch (error) {
      console.error("Error searching notes:", error);
      res.status(500).json({ message: "Failed to search notes" });
    }
  });
  
  // On This Day endpoint - fetch notes from previous time periods
  app.get("/api/on-this-day", isAuthenticated, async (req, res) => {
    try {
      const currentDateStr = req.query.date as string || new Date().toISOString().split('T')[0];
      const userId = req.user!.id;
      
      // Parse the current date
      const today = new Date(currentDateStr);
      
      // Calculate dates for 1 week ago, 1 month ago, and 1 year ago
      const oneWeekAgo = new Date(today);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const oneMonthAgo = new Date(today);
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      const oneYearAgo = new Date(today);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      // Format dates as YYYY-MM-DD strings for the API
      const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];
      const oneMonthAgoStr = oneMonthAgo.toISOString().split('T')[0];
      const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];
      
      // Get notes for each date
      const [weekNotes, monthNotes, yearNotes] = await Promise.all([
        storage.getNotesByDate(oneWeekAgoStr, userId),
        storage.getNotesByDate(oneMonthAgoStr, userId),
        storage.getNotesByDate(oneYearAgoStr, userId)
      ]);
      
      // Format dates for display (e.g., "Monday, April 7, 2025")
      const formatDateForDisplay = (date: Date): string => {
        return date.toLocaleDateString('en-US', { 
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      };
      
      // Return all the notes organized by time period
      res.json({
        weekAgo: {
          date: oneWeekAgoStr,
          notes: weekNotes,
          formattedDate: formatDateForDisplay(oneWeekAgo)
        },
        monthAgo: {
          date: oneMonthAgoStr,
          notes: monthNotes,
          formattedDate: formatDateForDisplay(oneMonthAgo)
        },
        yearAgo: {
          date: oneYearAgoStr,
          notes: yearNotes,
          formattedDate: formatDateForDisplay(oneYearAgo)
        }
      });
    } catch (error) {
      console.error("Error fetching On This Day notes:", error);
      res.status(500).json({ message: "Failed to fetch On This Day notes" });
    }
  });
  
  app.get("/api/analyze-moments", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const moments = await storage.getMoments(userId);
      
      if (moments.length === 0) {
        return res.status(404).json({ message: "No moments found to analyze" });
      }
      
      const analysis = await storage.analyzeMoments(userId);
      res.json({ analysis });
    } catch (error) {
      console.error("Error analyzing moments:", error);
      res.status(500).json({ message: "Failed to analyze moments" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
