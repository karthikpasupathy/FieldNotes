import pkg from 'pg';
const { Pool } = pkg;
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create connection pool with better error handling for production
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection not established
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Add event listeners for better debugging
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('PostgreSQL connection error:', err.message);
});

// We'll use direct pool queries instead of Drizzle ORM
export const db = { 
  client: pool, 
  schema
};
