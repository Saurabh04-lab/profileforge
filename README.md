
# ProfileForge

### Build Your Identity. Share Your Story.

ProfileForge is a full-stack web application that allows users to create, customize, save and manage professional profile cards.

It combines interactive frontend previews with server-side HTML generation and persistent PostgreSQL storage.

## Features

- Professional profile card builder.
- Live profile preview.
- Custom avatar upload.
- Dynamic skill management.
- GitHub, LinkedIn and portfolio links.
- Multiple profile themes: Midnight, Ocean and Sunset.
- Server-side validation and HTML generation.
- PostgreSQL profile storage.
- Create, read, update and delete profile records.
- User registration and login.
- Password hashing with bcrypt.
- PostgreSQL-backed login sessions.
- CSRF protection.
- Account-specific profile ownership.
- Responsive dashboard.
- HTML profile card export.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js, Express |
| Database | PostgreSQL (Neon) |
| Database Driver | node-postgres |
| Authentication | Express Session, bcryptjs |
| Session Storage | PostgreSQL |
| Security | Helmet, CSRF protection, rate limiting |
| Hosting | Render |
| Repository | GitHub |

## Project Structure

```text
profileforge/
├── config/
│   └── database.js
├── routes/
│   ├── auth.js
│   └── profiles.js
├── public/
│   ├── css/
│   │   ├── style.css
│   │   └── auth.css
│   ├── js/
│   │   ├── app.js
│   │   ├── auth.js
│   │   └── auth-client.js
│   ├── assets/
│   ├── index.html
│   ├── login.html
│   └── register.html
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── server.js
```

## Requirements

- Node.js 24.x
- npm
- PostgreSQL database
- Neon account or another PostgreSQL provider

## Local Installation

### 1. Clone the repository

```bash
git clone YOUR_REPOSITORY_URL
cd profileforge
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env`.

```dotenv
PORT=3000
NODE_ENV=development
DATABASE_URL=YOUR_POSTGRESQL_CONNECTION_STRING
SESSION_SECRET=YOUR_RANDOM_SECRET
```

Generate a session secret using:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Never commit your actual `.env` file.

### 4. Start the development server

```bash
npm run dev
```

### 5. Open the application

```text
http://localhost:3000
```

## API Endpoints

### Health

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Server and database status |

### Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/auth/me` | Current session |
| POST | `/api/auth/register` | Register account |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Sign out |

### Profiles

All profile endpoints require authentication.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/profiles/preview` | Generate profile preview |
| POST | `/api/profiles` | Save profile |
| GET | `/api/profiles` | Get account profiles |
| GET | `/api/profiles/:id` | Get individual profile |
| PUT | `/api/profiles/:id` | Update profile |
| DELETE | `/api/profiles/:id` | Delete profile |

Mutating API requests require a valid CSRF token.

## Database

ProfileForge uses PostgreSQL to persist:

- User accounts
- Profile information
- Skills and social links
- Profile themes
- Avatar image data
- Creation and modification timestamps
- Authentication sessions

Database tables and migrations are initialized automatically when the server starts.

## Security

- Passwords are hashed with bcrypt.
- Login sessions are stored in PostgreSQL.
- Session cookies are HTTP-only.
- CSRF tokens protect state-changing requests.
- Profile ownership is enforced at the API level.
- User input is validated and HTML-escaped.
- Security headers are configured using Helmet.
- Authentication endpoints use rate limiting.

## Deployment

The application can be deployed as a Node.js web service on Render.

Required production environment variables:

- `NODE_ENV=production`
- `DATABASE_URL`
- `SESSION_SECRET`

The application uses the platform-provided `PORT` variable.

## Current Scope

The application supports account-based profile creation and management. Public shareable profile pages and account recovery are not included in the current implementation.

## Author

Developed as a full-stack web application project.

## License

MIT
```

Don't add a license file yet unless you want to publish under MIT.

## Step 7 – Prepare GitHub

First, check Git:

```powershell
git --version
```

Then initialize the repository if you haven't already:

```powershell
git init
```

Verify secret files are ignored:

```powershell
git check-ignore -v .env node_modules
```

Both `.env` and `node_modules` should be listed.

Now stage and commit the project:

```powershell
git add .
git status
```

**Before committing:** Check that `.env` and `node_modules` are not among the staged files.

If the staged list is safe, run:

```powershell
git commit -m "Build ProfileForge full-stack profile card application"
```

## Step 8 – Create your GitHub repository

<AsyncImage query="GitHub create new repository page GitHub website repository name visibility public interface" aspectRatio="16:9" width="100%"/>

1. Open [GitHub](https://github.com/).
2. Sign in.
3. Click the `+` icon → New repository.
4. Enter:

| Setting | Value |
|---|---|
| Repository name | `profileforge` |
| Description | Full-stack dynamic professional profile card generator |
| Visibility | Public |
| Add README | Leave unchecked |
| Add `.gitignore` | Leave unchecked |
| License | None |

5. Click **Create repository**.

Then return to PowerShell and replace `YOUR_GITHUB_USERNAME` below with your GitHub username:

```powershell
git branch -M main

git remote add origin https://github.com/YOUR_GITHUB_USERNAME/profileforge.git

git push -u origin main
```

Your repository should then be available at:

`https://github.com/YOUR_GITHUB_USERNAME/profileforge`

There is also an optional GitHub connection available in ChatGPT for repository-related work; the terminal workflow above works independently.

---

## What happens after GitHub?

<box border radius="lg" padding={3} gap={3}>
  <badge color="info">Next – Milestone 7</badge>
  **Deploy ProfileForge on Render**

  <AsyncImage query="Render cloud dashboard web service deploy application service logs deployment interface" aspectRatio="16:9" width="100%"/>
  We'll configure:

  | Setting | Value |
  |---|---|
  | Service type | Web Service |
  | Runtime | Node |
  | Build command | `npm install` |
  | Start command | `npm start` |
  | Health check | `/api/health` |
  | Database | Existing Neon PostgreSQL |

  Add these environment variables through Render's dashboard:

  ```text
  NODE_ENV=production
  DATABASE_URL=your_neon_connection
  SESSION_SECRET=your_generated_secret
  ```

  Never upload your `.env` file.
</box>

Render currently offers free web services for demos, but they spin down after 15 minutes without traffic and can take about a minute to restart. Its free services are intended for testing and hobby projects, not production workloads. <Cite refs={["turn715819search5","turn715819search0"]}/>

**Your immediate task:** Complete Steps 1–8 and send me the GitHub push output. Then we'll deploy the application and obtain your live demo URL.