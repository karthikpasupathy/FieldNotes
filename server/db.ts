import pkg from 'pg';
const { Pool } = pkg;
import * as schema from "@shared/schema";
import { EventEmitter } from 'events';

// Extend Error for better error handling
interface DatabaseError extends Error {
  message: string;
  stack?: string;
}

// Constants for database state
const DB_STATE = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  FAILED: 'failed',
  SYNCING: 'syncing'
};

// Database connection event emitter
class DatabaseEventEmitter extends EventEmitter {}
const dbEvents = new DatabaseEventEmitter();

// Primary/secondary connection configuration
interface DatabaseConfig {
  connectionString?: string;
  host?: string;
  user?: string;
  password?: string;
  database?: string;
  port?: number;
  ssl?: { rejectUnauthorized: boolean };
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

// Configure primary database connection
let primaryConfig: DatabaseConfig = {
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000 // Return an error after 10 seconds if connection not established
};

// Configure secondary/replica database connection
let secondaryConfig: DatabaseConfig = {
  max: 10, // Fewer connections for the replica
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
};

// First try using DATABASE_URL if available for primary
if (process.env.DATABASE_URL) {
  primaryConfig.connectionString = process.env.DATABASE_URL;
  primaryConfig.ssl = { rejectUnauthorized: false };
  console.log("Primary DB: Using DATABASE_URL for connection");
} 
// Fallback to individual connection parameters
else if (process.env.PGHOST && process.env.PGUSER) {
  primaryConfig.host = process.env.PGHOST;
  primaryConfig.user = process.env.PGUSER;
  primaryConfig.password = process.env.PGPASSWORD;
  primaryConfig.database = process.env.PGDATABASE;
  primaryConfig.port = process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432;
  primaryConfig.ssl = { rejectUnauthorized: false };
  console.log("Primary DB: Using individual PG* parameters for connection");
} else {
  console.error("No primary database connection parameters found.");
}

// Configure the secondary database
// We'll check for SECONDARY_DATABASE_URL or individual parameters
if (process.env.SECONDARY_DATABASE_URL) {
  secondaryConfig.connectionString = process.env.SECONDARY_DATABASE_URL;
  secondaryConfig.ssl = { rejectUnauthorized: false };
  console.log("Secondary DB: Using SECONDARY_DATABASE_URL for connection");
} 
// Fallback to individual secondary connection parameters if specified
else if (process.env.SECONDARY_PGHOST && process.env.SECONDARY_PGUSER) {
  secondaryConfig.host = process.env.SECONDARY_PGHOST;
  secondaryConfig.user = process.env.SECONDARY_PGUSER;
  secondaryConfig.password = process.env.SECONDARY_PGPASSWORD;
  secondaryConfig.database = process.env.SECONDARY_PGDATABASE;
  secondaryConfig.port = process.env.SECONDARY_PGPORT ? parseInt(process.env.SECONDARY_PGPORT) : 5432;
  secondaryConfig.ssl = { rejectUnauthorized: false };
  console.log("Secondary DB: Using individual SECONDARY_PG* parameters for connection");
} else {
  // If no secondary config is provided, we'll create a replica of the primary on the same server
  // This is not ideal for true failover but provides redundancy
  console.log("No secondary database parameters found. Will attempt to use primary with different pool.");
  secondaryConfig = { ...primaryConfig, max: 5 }; // Use fewer connections for secondary
}

// Create primary and secondary connection pools
export const primaryPool = new Pool(primaryConfig);
export const secondaryPool = new Pool(secondaryConfig);

// Track database states
let primaryDbState = DB_STATE.DISCONNECTED;
let secondaryDbState = DB_STATE.DISCONNECTED;
let activePool = primaryPool; // Start with primary as the active connection

// Add event listeners for better debugging and failover
primaryPool.on('connect', () => {
  console.log('Connected to primary PostgreSQL database');
  primaryDbState = DB_STATE.CONNECTED;
  
  // If we reconnected to primary and it was failed before, attempt to sync from secondary
  if (activePool === secondaryPool) {
    console.log('Primary database reconnected. Starting sync from secondary...');
    syncDatabases(secondaryPool, primaryPool).then(() => {
      console.log('Successfully synced data from secondary to primary database');
      // Switch back to primary
      activePool = primaryPool;
      dbEvents.emit('failback', { from: 'secondary', to: 'primary' });
    }).catch(err => {
      console.error('Failed to sync from secondary to primary:', err);
    });
  }
});

primaryPool.on('error', (err) => {
  console.error('Primary PostgreSQL connection error:', err.message);
  primaryDbState = DB_STATE.FAILED;
  
  // If we were using the primary, fail over to secondary
  if (activePool === primaryPool && secondaryDbState === DB_STATE.CONNECTED) {
    console.log('Failing over to secondary database');
    activePool = secondaryPool;
    dbEvents.emit('failover', { from: 'primary', to: 'secondary', reason: err.message });
  }
});

secondaryPool.on('connect', () => {
  console.log('Connected to secondary PostgreSQL database');
  secondaryDbState = DB_STATE.CONNECTED;
  
  // If primary is failed and we just connected to secondary, make secondary active
  if (primaryDbState === DB_STATE.FAILED && activePool === primaryPool) {
    console.log('Primary is down, using secondary database');
    activePool = secondaryPool;
    dbEvents.emit('failover', { from: 'primary', to: 'secondary', reason: 'primary_unavailable' });
  }
});

secondaryPool.on('error', (err) => {
  console.error('Secondary PostgreSQL connection error:', err.message);
  secondaryDbState = DB_STATE.FAILED;
  
  // If both are failed, we have a bigger problem!
  if (primaryDbState === DB_STATE.FAILED && secondaryDbState === DB_STATE.FAILED) {
    console.error('CRITICAL: Both primary and secondary databases are unavailable!');
    dbEvents.emit('critical_failure', { reason: 'all_databases_down' });
  }
});

// Attempt to initialize both database connections
try {
  // Test primary connection
  primaryPool.query('SELECT NOW()').then(() => {
    primaryDbState = DB_STATE.CONNECTED;
    console.log('Primary database connection verified');
    
    // If primary is good, ensure we're using it
    activePool = primaryPool;
    
    // Test secondary connection
    return secondaryPool.query('SELECT NOW()');
  }).then(() => {
    secondaryDbState = DB_STATE.CONNECTED;
    console.log('Secondary database connection verified');
    
    // Once both are connected, set up initial sync
    return syncDatabases(primaryPool, secondaryPool);
  }).then(() => {
    console.log('Initial database synchronization complete');
    
    // Set up periodic sync from primary to secondary
    setInterval(() => {
      if (primaryDbState === DB_STATE.CONNECTED && secondaryDbState === DB_STATE.CONNECTED) {
        syncDatabases(primaryPool, secondaryPool).then(() => {
          console.log('Periodic sync completed successfully');
        }).catch(err => {
          console.error('Periodic sync failed:', err);
        });
      }
    }, 30 * 60 * 1000); // Sync every 30 minutes by default
  }).catch(err => {
    console.error('Database initialization error:', err);
  });
} catch (err) {
  console.error('Failed to initialize database connections:', err);
}

// Function to sync data between databases (source -> target)
async function syncDatabases(sourcePool: any, targetPool: any): Promise<void> {
  console.log('Starting database synchronization...');
  
  // This could be much more sophisticated with detailed logging and error handling
  // but we'll keep it simple for this implementation
  try {
    // Start a transaction on the target database
    await targetPool.query('BEGIN');
    
    // Sync users table
    const users = await sourcePool.query('SELECT * FROM users');
    for (const user of users.rows) {
      // Skip the user ID when inserting to avoid primary key conflicts
      const { id, ...userData } = user;
      
      // Use upsert (insert or update) pattern with ON CONFLICT
      await targetPool.query(
        `INSERT INTO users (id, username, email, password, reset_token, reset_token_expiry, is_admin, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET 
           username = $2, 
           email = $3, 
           password = $4, 
           reset_token = $5, 
           reset_token_expiry = $6, 
           is_admin = $7, 
           created_at = $8`,
        [id, userData.username, userData.email, userData.password, userData.reset_token, 
         userData.reset_token_expiry, userData.is_admin, userData.created_at]
      );
    }
    
    // Sync notes table
    const notes = await sourcePool.query('SELECT * FROM notes');
    for (const note of notes.rows) {
      const { id, ...noteData } = note;
      
      await targetPool.query(
        `INSERT INTO notes (id, content, timestamp, date, user_id, is_moment, analysis)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           content = $2,
           timestamp = $3,
           date = $4,
           user_id = $5,
           is_moment = $6,
           analysis = $7`,
        [id, noteData.content, noteData.timestamp, noteData.date, 
         noteData.user_id, noteData.is_moment, noteData.analysis]
      );
    }
    
    // Sync period_analyses table
    const periodAnalyses = await sourcePool.query('SELECT * FROM period_analyses');
    for (const analysis of periodAnalyses.rows) {
      const { id, ...analysisData } = analysis;
      
      await targetPool.query(
        `INSERT INTO period_analyses (id, start_date, end_date, period_type, analysis, user_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           start_date = $2,
           end_date = $3,
           period_type = $4,
           analysis = $5,
           user_id = $6,
           created_at = $7`,
        [id, analysisData.start_date, analysisData.end_date, analysisData.period_type,
         analysisData.analysis, analysisData.user_id, analysisData.created_at]
      );
    }
    
    // Commit the transaction
    await targetPool.query('COMMIT');
    console.log('Database synchronization completed successfully');
    return;
    
  } catch (err) {
    // If anything fails, roll back the transaction
    await targetPool.query('ROLLBACK');
    console.error('Database synchronization failed:', err);
    throw err;
  }
}

// Health check function to periodically verify database connections
function checkDatabaseHealth() {
  Promise.all([
    primaryPool.query('SELECT 1').then(() => {
      if (primaryDbState !== DB_STATE.CONNECTED) {
        console.log('Primary database connection restored');
        primaryDbState = DB_STATE.CONNECTED;
      }
      return true;
    }).catch(() => {
      if (primaryDbState !== DB_STATE.FAILED) {
        console.error('Primary database connection lost');
        primaryDbState = DB_STATE.FAILED;
      }
      return false;
    }),
    
    secondaryPool.query('SELECT 1').then(() => {
      if (secondaryDbState !== DB_STATE.CONNECTED) {
        console.log('Secondary database connection restored');
        secondaryDbState = DB_STATE.CONNECTED;
      }
      return true;
    }).catch(() => {
      if (secondaryDbState !== DB_STATE.FAILED) {
        console.error('Secondary database connection lost');
        secondaryDbState = DB_STATE.FAILED;
      }
      return false;
    })
  ]).then(([primaryOk, secondaryOk]) => {
    // Handle database status changes
    if (primaryOk && !secondaryOk && activePool === secondaryPool) {
      console.log('Failing back to primary database');
      activePool = primaryPool;
      dbEvents.emit('failback', { from: 'secondary', to: 'primary' });
    } else if (!primaryOk && secondaryOk && activePool === primaryPool) {
      console.log('Failing over to secondary database');
      activePool = secondaryPool;
      dbEvents.emit('failover', { from: 'primary', to: 'secondary', reason: 'health_check_failed' });
    }
  });
}

// Set up periodic health checks
setInterval(checkDatabaseHealth, 60 * 1000); // Check every minute

// Interface for database with failover support
export const db = {
  client: {
    query: async (text: string, params?: any[]) => {
      try {
        // First try the active pool
        return await activePool.query(text, params);
      } catch (error) {
        const err = error as DatabaseError;
        console.error(`Database query failed on ${activePool === primaryPool ? 'primary' : 'secondary'} database:`, err.message);
        
        // If query failed on primary, try secondary
        if (activePool === primaryPool && secondaryDbState === DB_STATE.CONNECTED) {
          console.log('Failing over to secondary database for this query');
          try {
            return await secondaryPool.query(text, params);
          } catch (secError) {
            const secondaryErr = secError as DatabaseError;
            console.error('Secondary database also failed:', secondaryErr.message);
            throw secondaryErr; // Both databases failed
          }
        } else if (activePool === secondaryPool && primaryDbState === DB_STATE.CONNECTED) {
          // If on secondary but primary is back, try primary
          console.log('Trying primary database for this query');
          try {
            const result = await primaryPool.query(text, params);
            console.log('Primary database query succeeded, failing back');
            activePool = primaryPool; // Switch back to primary
            return result;
          } catch (primError) {
            const primaryErr = primError as DatabaseError;
            console.error('Primary database still has issues:', primaryErr.message);
            throw primaryErr;
          }
        } else {
          // No failover options available
          throw err;
        }
      }
    }
  },
  schema,
  // Expose pool status for monitoring
  getStatus: () => {
    return {
      primary: primaryDbState,
      secondary: secondaryDbState,
      active: activePool === primaryPool ? 'primary' : 'secondary'
    };
  },
  // Force failover for testing
  forceFailover: (target: 'primary' | 'secondary') => {
    if (target === 'secondary' && secondaryDbState === DB_STATE.CONNECTED) {
      console.log('Manually failing over to secondary database');
      activePool = secondaryPool;
      dbEvents.emit('failover', { from: 'primary', to: 'secondary', reason: 'manual' });
    } else if (target === 'primary' && primaryDbState === DB_STATE.CONNECTED) {
      console.log('Manually failing back to primary database');
      activePool = primaryPool;
      dbEvents.emit('failback', { from: 'secondary', to: 'primary', reason: 'manual' });
    }
  },
  // Force manual sync
  syncNow: async () => {
    if (primaryDbState === DB_STATE.CONNECTED && secondaryDbState === DB_STATE.CONNECTED) {
      try {
        await syncDatabases(primaryPool, secondaryPool);
        return { success: true, message: 'Manual synchronization completed' };
      } catch (error) {
        const err = error as DatabaseError;
        return { success: false, message: `Synchronization failed: ${err.message}` };
      }
    } else {
      return { 
        success: false, 
        message: 'Cannot sync: ' +
          (primaryDbState !== DB_STATE.CONNECTED ? 'Primary database not connected. ' : '') +
          (secondaryDbState !== DB_STATE.CONNECTED ? 'Secondary database not connected.' : '')
      };
    }
  },
  events: dbEvents
};
