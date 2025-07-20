import { Request, Response, NextFunction } from "express";
import { createRequire } from 'module';

// MojoAuth configuration
const config = {
  apiKey: process.env.MOJOAUTH_API_KEY || "",
};

let ma: any;

// Initialize MojoAuth SDK
function initializeMojoAuth() {
  if (config.apiKey) {
    try {
      console.log("Attempting to initialize MojoAuth SDK with API key:", config.apiKey.substring(0, 10) + "...");
      // Use createRequire for CommonJS modules in ES module context
      const require = createRequire(import.meta.url);
      const MojoAuthSDK = require("mojoauth-sdk");
      console.log("MojoAuth SDK loaded:", typeof MojoAuthSDK);
      ma = MojoAuthSDK(config);
      console.log("MojoAuth SDK initialized successfully");
    } catch (error) {
      console.error("Failed to initialize MojoAuth SDK:", error);
      console.error("Error details:", error.message);
    }
  } else {
    console.warn("MOJOAUTH_API_KEY not found. MojoAuth authentication will not be available.");
  }
}

// Initialize on module load
initializeMojoAuth();

// Interface for MojoAuth user
export interface MojoAuthUser {
  user_id: string;
  identifier: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

// Interface for authentication response
export interface AuthResponse {
  oauth: {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  user: MojoAuthUser;
}

// Send magic link for email authentication
export async function sendMagicLink(email: string, redirectUrl?: string): Promise<any> {
  if (!ma) {
    throw new Error("MojoAuth SDK not initialized");
  }

  const query: any = {
    language: "en"
  };

  if (redirectUrl) {
    query.redirect_url = redirectUrl;
  }

  try {
    const response = await ma.mojoAPI.signinWithMagicLink(email, query);
    return response;
  } catch (error) {
    console.error("Magic link error:", error);
    throw error;
  }
}

// Check magic link status
export async function checkMagicLinkStatus(stateId: string): Promise<any> {
  if (!ma) {
    throw new Error("MojoAuth SDK not initialized");
  }

  try {
    const response = await ma.mojoAPI.pingStatus(stateId);
    console.log("MojoAuth pingStatus response:", JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error("Magic link status error:", error);
    throw error;
  }
}

// Resend magic link
export async function resendMagicLink(stateId: string, redirectUrl?: string): Promise<any> {
  if (!ma) {
    throw new Error("MojoAuth SDK not initialized");
  }

  const query: any = {
    language: "en"
  };

  if (redirectUrl) {
    query.redirect_url = redirectUrl;
  }

  try {
    const response = await ma.mojoAPI.resendMagicLink(stateId, query);
    return response;
  } catch (error) {
    console.error("Resend magic link error:", error);
    throw error;
  }
}

// Send email OTP
export async function sendEmailOTP(email: string): Promise<any> {
  if (!ma) {
    throw new Error("MojoAuth SDK not initialized");
  }

  const query = {
    language: "en"
  };

  try {
    const response = await ma.mojoAPI.signinWithEmailOTP(email, query);
    return response;
  } catch (error) {
    console.error("Email OTP error:", error);
    throw error;
  }
}

// Verify email OTP
export async function verifyEmailOTP(otp: string, stateId: string): Promise<AuthResponse> {
  if (!ma) {
    throw new Error("MojoAuth SDK not initialized");
  }

  try {
    // Try verifyEmailOTP first (standard method)
    const response = await ma.mojoAPI.verifyEmailOTP(otp, stateId);
    console.log("MojoAuth verifyEmailOTP response:", JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error("Email OTP verification error:", error);
    console.log("Trying alternative method verifyOTPWithStateId...");
    try {
      // Fallback to verifyOTPWithStateId if available
      const response = await ma.mojoAPI.verifyOTPWithStateId({ otp, stateId });
      console.log("MojoAuth verifyOTPWithStateId response:", JSON.stringify(response, null, 2));
      return response;
    } catch (fallbackError) {
      console.error("Fallback method also failed:", fallbackError);
      throw error; // throw the original error
    }
  }
}

// Resend email OTP
export async function resendEmailOTP(stateId: string): Promise<any> {
  if (!ma) {
    throw new Error("MojoAuth SDK not initialized");
  }

  const query = {
    language: "en"
  };

  try {
    const response = await ma.mojoAPI.resendEmailOTP(stateId, query);
    return response;
  } catch (error) {
    console.error("Resend email OTP error:", error);
    throw error;
  }
}

// Send phone OTP
export async function sendPhoneOTP(phone: string): Promise<any> {
  if (!ma) {
    throw new Error("MojoAuth SDK not initialized");
  }

  const query = {
    language: "en"
  };

  try {
    const response = await ma.mojoAPI.signinWithPhoneOTP(phone, query);
    return response;
  } catch (error) {
    console.error("Phone OTP error:", error);
    throw error;
  }
}

// Verify phone OTP
export async function verifyPhoneOTP(otp: string, stateId: string): Promise<AuthResponse> {
  if (!ma) {
    throw new Error("MojoAuth SDK not initialized");
  }

  try {
    const response = await ma.mojoAPI.verifyPhoneOTP(otp, stateId);
    return response;
  } catch (error) {
    console.error("Phone OTP verification error:", error);
    throw error;
  }
}

// Resend phone OTP
export async function resendPhoneOTP(stateId: string): Promise<any> {
  if (!ma) {
    throw new Error("MojoAuth SDK not initialized");
  }

  const query = {
    language: "en"
  };

  try {
    const response = await ma.mojoAPI.resendPhoneOTP(stateId, query);
    return response;
  } catch (error) {
    console.error("Resend phone OTP error:", error);
    throw error;
  }
}

// Verify JWT token
export async function verifyToken(token: string): Promise<{ user: MojoAuthUser }> {
  if (!ma) {
    throw new Error("MojoAuth SDK not initialized");
  }

  try {
    const response = await ma.mojoAPI.verifyToken(token);
    return response;
  } catch (error) {
    console.error("Token verification error:", error);
    throw error;
  }
}

// Middleware to authenticate requests using MojoAuth JWT
export function authenticateMojoAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  verifyToken(token)
    .then(response => {
      req.user = {
        id: response.user.id,
        email: response.user.email,
        isAdmin: false // MojoAuth users are not admin by default
      };
      next();
    })
    .catch(error => {
      console.error("Authentication failed:", error);
      res.status(403).json({ message: "Invalid or expired token" });
    });
}

// Check if MojoAuth is properly configured
export function isMojoAuthConfigured(): boolean {
  return !!ma && !!config.apiKey;
}