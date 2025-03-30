import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { noteContentSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  // Notes API routes
  app.get("/api/notes/:date", async (req, res) => {
    try {
      const { date } = req.params;
      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
      }
      
      const notes = await storage.getNotesByDate(date);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching notes:", error);
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  app.post("/api/notes", async (req, res) => {
    try {
      const validation = noteContentSchema.safeParse(req.body);
      
      if (!validation.success) {
        const errorMessage = fromZodError(validation.error).message;
        return res.status(400).json({ message: errorMessage });
      }
      
      const { content, date } = validation.data;
      
      const note = await storage.createNote({
        content,
        date
      });
      
      res.status(201).json(note);
    } catch (error) {
      console.error("Error creating note:", error);
      res.status(500).json({ message: "Failed to create note" });
    }
  });

  app.get("/api/dates", async (req, res) => {
    try {
      const dates = await storage.getAllDates();
      res.json(dates);
    } catch (error) {
      console.error("Error fetching dates:", error);
      res.status(500).json({ message: "Failed to fetch dates" });
    }
  });

  app.get("/api/recent-days", async (req, res) => {
    try {
      const limit = Number(req.query.limit) || 5;
      const recentDays = await storage.getRecentDays(limit);
      res.json(recentDays);
    } catch (error) {
      console.error("Error fetching recent days:", error);
      res.status(500).json({ message: "Failed to fetch recent days" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
