import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { sendMarketingEmail } from './email';

/**
 * Admin controller for sending marketing emails to users
 */
export async function sendMarketingEmailToUsers(req: Request, res: Response, next: NextFunction) {
  try {
    // Check if the required data is provided
    if (!req.body.features || !Array.isArray(req.body.features) || req.body.features.length === 0) {
      return res.status(400).json({ message: "features array is required" });
    }

    // Validate features format
    const features = req.body.features as string[];
    if (features.some(f => typeof f !== 'string' || f.trim() === '')) {
      return res.status(400).json({ message: "All features must be non-empty strings" });
    }
    
    // Get all users from the database
    const users = await storage.getAllUsers();
    
    // Extract email addresses
    const emails = users.map(user => user.email);
    
    if (emails.length === 0) {
      return res.status(404).json({ message: "No users found to send emails to" });
    }
    
    // Send marketing email (non-blocking)
    console.log(`Sending marketing email to ${emails.length} users`);
    
    // Send the marketing email and wait for the result
    const result = await sendMarketingEmail(emails, features);
    
    // Return the result
    res.status(200).json({
      message: `Marketing email sent to ${result.success} users (${result.failure} failed)`,
      success: result.success,
      failure: result.failure,
      totalUsers: emails.length
    });
  } catch (error) {
    console.error('Error sending marketing email:', error);
    next(error);
  }
}