# Housing Society Management ERP — Backend

Production-grade Node.js + Express.js REST API for the Housing Society
Management ERP system.

## Tech Stack

- **Runtime** — Node.js ≥ 18
- **Framework** — Express.js
- **Database** — MongoDB (via Mongoose)
- **Auth** — JWT (access + refresh tokens), bcryptjs
- **Validation** — Zod
- **Security** — helmet, cors, express-rate-limit

## Folder Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── db.js            # MongoDB connection
│   │   └── env.js           # Centralised env-var access
│   ├── middlewares/
│   │   ├── auth.js          # JWT bearer-token guard
│   │   ├── errorHandler.js  # Global error-response formatter
│   │   ├── notFound.js      # 404 catch-all
│   │   └── validate.js      # Zod validation middleware factory
│   ├── modules/             # Feature modules (routes + controller + service + model)
│   ├── utils/
│   │   ├── ApiError.js      # Custom error class with status code
│   │   ├── apiResponse.js   # Standard { success, message, data/errors } helpers
│   │   └── asyncHandler.js  # Async route wrapper (belt-and-suspenders)
│   ├── app.js               # Express app configuration
│   └── server.js            # Entry point — connects DB, starts server
├── .env.example             # Required env vars (copy to .env)
├── .gitignore
├── package.json
└── README.md
```

## Getting Started

1. **Install dependencies**

   ```bash
   cd backend
   npm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB URI and secrets
   ```

3. **Start MongoDB** — make sure a local (or Atlas) MongoDB instance is
   reachable at the `MONGO_URI` in your `.env`.

4. **Run the dev server**

   ```bash
   npm run dev
   ```

5. **Verify**

   ```bash
   curl http://localhost:5000/api/health
   # → { "success": true, "message": "OK" }
   ```

## NPM Scripts

| Script         | Description                       |
| -------------- | --------------------------------- |
| `npm run dev`  | Start with nodemon (auto-reload)  |
| `npm start`    | Start without nodemon             |
| `npm run lint` | Run ESLint                        |
| `npm run format` | Run Prettier                    |

## API Response Format

All endpoints follow a consistent envelope:

```jsonc
// Success
{ "success": true,  "message": "…", "data": { … } }

// Error
{ "success": false, "message": "…", "errors": [] }
```
