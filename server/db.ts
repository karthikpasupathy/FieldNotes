import pkg from 'pg';
const { Pool } = pkg;
import * as schema from "@shared/schema";

// More resilient database connection logic
let connectionConfig: any = {};

// First try using DATABASE_URL if available
if (process.env.DATABASE_URL) {
  connectionConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for many Postgres providers
  };
  console.log("Using DATABASE_URL for connection");
} 
// Fallback to individual connection parameters
else if (process.env.PGHOST && process.env.PGUSER) {
  connectionConfig = {
    host: process.env.PGHOST,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432,
    ssl: { rejectUnauthorized: false } // Required for many Postgres providers
  };
  console.log("Using individual PG* parameters for connection");
} else {
  console.error("No database connection parameters found.");
  // Don't throw immediately to allow other parts of the app to load
  // The app will handle database connection failures gracefully
}

// Create connection pool with better error handling for production
export const pool = new Pool({ 
  ...connectionConfig,
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000 // Return an error after 10 seconds if connection not established
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
