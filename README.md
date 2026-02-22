# Chatting App Frontend

This frontend includes:

- Login and Signup pages
- Chat dashboard
- Contacts search by phone number
- Text + image chat

## Frontend Setup

1. Copy `.env.example` to `.env`
2. Set `VITE_API_URL`
	- Local: `http://localhost:5000/api`
	- Deployed: `https://your-backend-domain.com/api`
3. Install dependencies:

```bash
npm install
```

4. Run frontend:

```bash
npm run dev
```

## Backend Setup (from `../Backend`)

1. Copy `.env.example` to `.env`
2. Fill MongoDB and Cloudinary credentials
3. Set `CLIENT_URL` to allowed frontend URLs (comma separated), for example:
	- `http://localhost:5173,https://your-frontend-domain.com`
4. Install dependencies:

```bash
npm install
```

5. Run backend:

```bash
npm run dev
```
