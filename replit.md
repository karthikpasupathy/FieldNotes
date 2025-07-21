# Field Notes

## Overview
Field Notes is a daily notes application with timestamps built with React, Express, and PostgreSQL. It's designed as a Progressive Web App (PWA) with features like daily note taking, user authentication, period analysis using AI, and admin dashboard functionality.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Framework**: Radix UI components with Tailwind CSS for styling
- **Form Handling**: React Hook Form with Zod validation
- **PWA Features**: Service worker for offline functionality and app installation prompts

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Session Management**: Express sessions with PostgreSQL store
- **Authentication**: Passport.js with local strategy using scrypt for password hashing
- **API Design**: RESTful endpoints with JSON responses
- **File Structure**: Organized into routes, storage, authentication, and database modules

## Key Components

### Database Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Defined in shared/schema.ts with tables for users, notes, and period analyses
- **Connection**: Pool-based connections with primary/secondary configuration for scalability
- **Migrations**: Drizzle Kit for schema migrations

### Authentication System
- **Strategy**: Local username/password authentication
- **Password Security**: Scrypt hashing with random salt
- **Session Management**: Server-side sessions stored in PostgreSQL
- **Authorization**: Route-level protection with middleware

### AI Integration
- **Provider**: OpenAI GPT-4.1-mini
- **Features**: 
  - Daily note analysis for insights and mood tracking
  - Period analysis (weekly/monthly) for pattern recognition
  - "Moments" analysis for special note highlights
- **Implementation**: Centralized in server/openai.ts with error handling

### Admin System
- **Separate App**: Dedicated admin interface with its own routing and authentication
- **Features**: User statistics, user management, system overview
- **Security**: Admin-only routes with session-based authentication

## Data Flow

### Note Creation Flow
1. User inputs note content via NoteInput component
2. Frontend validates input (280 character limit)
3. API request to POST /api/notes with content and date
4. Backend validates, stores in database with timestamp
5. Query client invalidates related caches
6. UI updates with new note and refreshed lists

### Analysis Flow
1. User requests analysis (daily/period/moments)
2. Backend fetches relevant notes from database
3. OpenAI API call with structured prompt
4. Analysis result cached in database
5. Frontend displays formatted analysis with markdown support

### Authentication Flow
1. User submits login credentials
2. Passport.js validates against stored hash
3. Session created and stored in PostgreSQL
4. Frontend updates auth state via React Query
5. Protected routes become accessible

## External Dependencies

### Core Dependencies
- **Database**: PostgreSQL via @neondatabase/serverless
- **AI**: OpenAI API for note analysis
- **UI Components**: Radix UI primitives for accessible components
- **Styling**: Tailwind CSS with custom theme configuration
- **Date Handling**: date-fns for date manipulation and formatting

### Development Tools
- **Build Tool**: Vite for fast development and building
- **Database Tools**: Drizzle Kit for migrations and schema management
- **Code Quality**: TypeScript for type safety across full stack

## Deployment Strategy

### Environment Configuration
- **Development**: Local development with hot reload via Vite
- **Production**: Built with Vite and served by Express
- **Environment Variables**: 
  - DATABASE_URL for PostgreSQL connection
  - SESSION_SECRET for session security
  - OPENAI_API_KEY for AI features

### Replit Integration
- **Auto-provisioning**: Database automatically provisioned via Replit
- **Secrets Management**: Environment variables stored in Replit Secrets
- **One-click Deploy**: Configured for immediate deployment on Replit platform

### PWA Features
- **Offline Support**: Service worker for caching and offline functionality
- **Installation**: Web app manifest for mobile installation
- **Updates**: Automatic update notification system with user prompts

The application is architected for scalability with clear separation of concerns, comprehensive error handling, and a focus on user experience through responsive design and PWA capabilities.

## MojoAuth Removal - July 21, 2025
- Completely removed MojoAuth passwordless authentication system
- Reverted to traditional username/password authentication only
- Removed MojoAuth-specific database columns (mojoauth_id, phone, auth_provider, created_at, updated_at)
- Deleted MojoAuth API endpoints and associated server-side logic
- Removed MojoAuth authentication page and UI components
- Cleaned up storage interface by removing MojoAuth-related methods
- Uninstalled mojoauth-sdk dependency from package.json
- Updated authentication page to show only traditional login/register forms

## Bug Fixes - July 20, 2025
- Fixed database schema mismatch in sync functions (removed non-existent columns like is_admin, created_at from users)
- Added missing is_idea column to notes table synchronization
- Fixed authentication middleware to properly check for req.user existence
- Replaced unsafe `req.user?.id` patterns with `req.user!.id` after authentication check
- Added ErrorBoundary component to React app for better error handling
- Improved async error handling in API analysis functions with proper credentials
- Added graceful shutdown handling for database connections and intervals
- Fixed potential memory leaks with proper cleanup functions
- Enhanced database health check error logging
- Added proper error boundaries around main React application

