# Field Notes

A daily notes application with timestamps built with React, Express, and PostgreSQL.

## Features

- Daily note taking with timestamps
- User authentication
- Profile management
- Calendar view
- Period analysis

## Getting Started

1. Click "Fork" to create your own copy of this Repl
2. Create a PostgreSQL database in your Repl
3. Add required environment variables in Replit Secrets:
   - DATABASE_URL (from your Repl database)
   - OPENAI_API_KEY (optional, for AI features)
   - SESSION_SECRET (for secure sessions)

## Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

## Contributing

1. Fork the project
2. Create your feature branch
3. Commit your changes
4. Push to your fork
5. Open a Pull Request

## Tech Stack

- Frontend: React, TypeScript, Tailwind CSS
- Backend: Express.js, PostgreSQL
- Authentication: Passport.js
- Database ORM: Drizzle

## Security

- User data is stored securely in PostgreSQL
- Passwords are properly encrypted
- Environment variables are managed through Replit Secrets
- Session handling is secure

## License

MIT License - see LICENSE file for details