
# Field Notes

A daily notes application with timestamps built with React, Express, and PostgreSQL.

## Quick Start with Replit

1. Click this button to create a new Repl with this code:
   [![Run on Repl.it](https://replit.com/badge/github/your-username/field-notes)](https://replit.com/github/your-username/field-notes)

   Or manually:
   - Open [Replit](https://replit.com)
   - Click "Create Repl"
   - Choose "Import from GitHub"
   - Paste the repository URL

2. Once imported, Replit will automatically install dependencies

3. Set up your environment variables in Replit Secrets:
   - Click on "Tools" in the left sidebar
   - Select "Secrets"
   - Add the following secrets:
     - `DATABASE_URL` (Replit will auto-provision a database)
     - `SESSION_SECRET` (any random string)
     - `OPENAI_API_KEY` (optional, for AI features)

4. Click the "Run" button to start the app

## Features

- Daily note taking with timestamps
- User authentication
- Profile management
- Calendar view
- Period analysis

## Development

To run the development server locally in Replit:
```bash
npm run dev
```

## Tech Stack

- Frontend: React, TypeScript, Tailwind CSS
- Backend: Express.js, PostgreSQL
- Authentication: Passport.js
- Database ORM: Drizzle

## Contributing

1. Fork the project
2. Create your feature branch
3. Commit your changes
4. Push to your fork
5. Open a Pull Request

## Security

- User data is stored securely in PostgreSQL
- Passwords are properly encrypted
- Environment variables are managed through Replit Secrets
- Session handling is secure

## License

MIT License - see LICENSE file for details
