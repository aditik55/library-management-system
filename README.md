# Library Management System

Three-tier cloud app for creating, searching, updating, and deleting books in a college library.

```
              +---------------------------+
              |      CLIENT BROWSER       |
              +---------------------------+
                            | HTTPS
                            v
              +---------------------------+
              |          NETLIFY          |  Tier 1: Presentation Layer
              |    React.js + Vite SPA    |  (Static Hosting & CDN)
              +---------------------------+
                            | REST API (HTTPS)
                            | CORS Enabled
                            v
              +---------------------------+
              |          RENDER           |  Tier 2: Application Layer
              |    Node.js + Express      |  (Web Service / API)
              +---------------------------+
                            | Mongoose TLS Connection
                            | MONGODB_URI
                            v
              +---------------------------+
              |       MONGODB ATLAS       |  Tier 3: Database Layer
              |  Managed Cloud Database   |  (libraryDB -> books)
              +---------------------------+
```

## Features

- Add, edit, and delete books
- Search by book ID, title, author, or ISBN
- Filter by category: Computer Science, Engineering, Mathematics, Science, Literature, History, Management
- Dashboard counts for titles, total copies, available copies, and unavailable copies
- Live backend health indicator

Each book stores `bookId`, `title`, `author`, `isbn`, `category`, `publisher`, `publicationYear`, `totalCopies`, and `availableCopies`.

`availableCopies` cannot be negative and cannot be greater than `totalCopies`. Unavailable copies are `totalCopies - availableCopies` added across every book.

## Project structure

```
Library Management System/
├── backend/                      # Tier 2: Application / API Layer
│   ├── config/
│   │   └── database.js           # Mongoose Atlas connection
│   ├── controllers/
│   │   └── bookController.js     # CRUD and statistics
│   ├── models/
│   │   └── Book.js               # Book schema
│   ├── routes/
│   │   └── bookRoutes.js         # /api/books routes
│   ├── tests/
│   │   └── library.test.js       # Local API tests (no Atlas)
│   ├── .env.example
│   ├── package.json
│   └── server.js
│
├── frontend/                     # Tier 1: Presentation Layer
│   ├── public/
│   │   └── _redirects            # Netlify SPA fallback
│   ├── src/
│   │   ├── components/
│   │   │   ├── ArchitectureBanner.jsx
│   │   │   ├── BookModal.jsx
│   │   │   ├── BookStats.jsx
│   │   │   ├── BookTable.jsx
│   │   │   ├── DeleteModal.jsx
│   │   │   ├── Header.jsx
│   │   │   └── Toast.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── categories.js
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── .gitignore
├── package.json
└── README.md
```

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | Service info |
| `GET` | `/health` | Health check. `database` is `connected` only when MongoDB is connected |
| `GET` | `/api/books` | List books. Optional query: `search`, `category` |
| `GET` | `/api/books/stats/summary` | Title and copy counts |
| `GET` | `/api/books/:id` | One book by book ID or MongoDB id |
| `POST` | `/api/books` | Create a book |
| `PUT` | `/api/books/:id` | Update a book |
| `DELETE` | `/api/books/:id` | Delete a book |

Book IDs are stored in uppercase. `bk101` and `BK101` are the same book.

## Run locally

1. Copy the env templates and fill in your Atlas connection string. Do not commit the `.env` files.

   ```powershell
   copy backend\.env.example backend\.env
   copy frontend\.env.example frontend\.env
   ```

   `backend/.env`:

   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/libraryDB?retryWrites=true&w=majority
   DB_NAME=libraryDB
   FRONTEND_URL=http://localhost:5173
   ```

   `frontend/.env`:

   ```env
   VITE_API_URL=http://localhost:5000
   ```

   The UI already falls back to `http://localhost:5000` when `VITE_API_URL` is unset.

   Use a new database named `libraryDB`. `DB_NAME` overrides the database name inside `MONGODB_URI`, so book records stay in `libraryDB`.

2. Install dependencies, run the local tests, and start the API:

   ```powershell
   npm run install:all
   npm test
   npm run start:backend
   ```

   `npm test` checks validation, search, filtering, statistics, and CRUD without connecting to Atlas.

3. In a second terminal, start the UI:

   ```powershell
   npm run start:frontend
   ```

4. Open `http://localhost:5173`.

## Deploy

Do this yourself after the code is ready. These steps do not run automatically.

### 1. MongoDB Atlas

1. Create a new free M0 cluster, or a new database on a cluster you control, at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Add a database user with read and write access.
3. Under Network Access, allow `0.0.0.0/0` so Render can connect.
4. Copy the driver connection string and use the database name `libraryDB`:

   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/libraryDB?retryWrites=true&w=majority
   ```

Mongoose creates the `books` collection the first time you add a book. You do not need to create the collection by hand.

### 2. GitHub

1. Create a new repository for this library app, or keep using your existing repository.
2. Push this project yourself when you are ready. Nothing in this setup pushes code for you.

### 3. Render (API)

1. New Web Service from the GitHub repository.
2. Settings:
   - Root directory: `backend`
   - Build command: `npm install`
   - Start command: `node server.js`
3. Environment variables:

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | Your Atlas connection string |
   | `DB_NAME` | `libraryDB` |
   | `FRONTEND_URL` | Your Netlify URL, for example `https://your-site.netlify.app` |

   Render sets `PORT` for you. The server uses `process.env.PORT` when it is present. You can also set `PORT` to `5000` if your course worksheet asks for it.

4. Confirm `https://<your-service>.onrender.com/health` returns `"database": "connected"` after Atlas is reachable:

   ```json
   { "status": "UP", "database": "connected" }
   ```

   If Atlas is not reachable yet, the same URL returns `"status": "DEGRADED"` and `"database": "disconnected"`.

### 4. Netlify (UI)

1. Import the repository.
2. Build settings:
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `frontend/dist`
3. Environment variable:

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | Your Render URL, for example `https://your-service.onrender.com` |

   Do not put a slash at the end. Set this before the production build. Netlify reads `VITE_API_URL` while it builds the site.

4. After the site is live, set Render `FRONTEND_URL` to that Netlify origin (scheme + host, no path). Requests from `*.netlify.app` and `localhost` are already allowed.

## Verification

| Case | Action | Expected result |
|---|---|---|
| Add book | Click **Add Book**. Use id `BK101`, a title, an author, category `Computer Science`, total copies `5`, and available copies `3`. | Success toast, and the row appears in the table. |
| List books | Load or refresh the home page. | `GET /api/books` fills the table from Atlas. |
| Search and filter | Type a title, author, book ID, or ISBN, then choose a category. | The table shows only matching books. |
| Update book | Edit `BK101` and change the available copies. | Atlas and the table both show the new number. Stats update. |
| Reject bad copies | Set available copies higher than total copies. | The form and the API both reject the save. |
| Delete book | Delete `BK101` and confirm. | The book is removed from Atlas and the table. |
| Database | Open the `books` collection in `libraryDB`. | Documents match the changes made in the UI. |
| Stats | Compare the four dashboard cards. | Unavailable copies equal total copies minus available copies. |
