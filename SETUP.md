# Setup & Installation Guide

This guide covers everything you need to get the SevaJyothi platform running locally and connected to your own Supabase infrastructure.

## System Requirements

Before you begin, ensure you have the following installed on your machine:
* **Node.js** (v18 or higher recommended)
* **npm** (comes with Node.js) or **bun**
* **Git** (for version control)
* A **Supabase** account and project (for the backend)

---

## 1. Local Project Setup

First, clone the repository and install the required dependencies.

```bash
# Clone the repository
git clone git@github.com:rizwan-k-a/SevaJyothi.git

# Navigate into the project directory
cd SevaJyothi

# Install dependencies using npm (or bun install)
npm install
```

---

## 2. Environment Variables

The project requires connection details to communicate with your Supabase backend. 

1. Create a `.env` file in the root directory.
2. Add the following variables (you can find these in your Supabase dashboard under **Project Settings > API**):

```env
# Your Supabase Project Reference ID
SUPABASE_PROJECT_ID="your-project-id"

# Backend SDK keys
SUPABASE_URL="https://your-project-id.supabase.co"
SUPABASE_PUBLISHABLE_KEY="your-anon-publishable-key"
SUPABASE_SECRET_KEY="your-service-role-secret-key"
SUPABASE_JWKS_URL="https://your-project-id.supabase.co/auth/v1/.well-known/jwks.json"

# Frontend Vite keys (Must match the above)
VITE_SUPABASE_PROJECT_ID="your-project-id"
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-publishable-key"
```

> **Warning:** Never commit your `.env` file or expose your `SUPABASE_SECRET_KEY` publicly!

---

## 3. Database Migration & Setup

To set up the required tables, roles, and Row Level Security (RLS) policies on your Supabase instance, you need to apply the provided database migrations.

You can do this easily using the Supabase CLI:

```bash
# 1. Login to your Supabase account via CLI
npx supabase login

# 2. Link your local project to your remote Supabase instance
npx supabase link --project-ref your-project-id

# 3. Push the SQL migrations to create all tables and policies
npx supabase db push
```

Alternatively, you can manually copy the contents of `supabase/migrations/schema.sql` and `00_roles.sql` into the SQL Editor of your Supabase dashboard and run them.

---

## 4. Running the Development Server

Once the dependencies are installed, environment variables are set, and the database is migrated, you are ready to start the platform.

```bash
npm run dev
```

The application will start, and you can view the Progressive Web App locally at:
👉 **http://localhost:8080** (or whichever port Vite automatically assigns).

---

## 5. Deployment Readiness

When preparing to build for production:

```bash
npm run build
```

This command leverages TanStack Start and Nitro to compile a highly optimized Server-Side Rendered (SSR) bundle for your production environment.
