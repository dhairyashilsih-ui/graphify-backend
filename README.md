# Graphify Backend API

Backend API server for the Graphify AI application, handling MongoDB conversation storage and retrieval.

## 🚀 Features

- **Conversation Management**: Save, load, and delete user conversations
- **MongoDB Integration**: Persistent storage for AI conversation history
- **CORS Enabled**: Secure cross-origin requests
- **Health Check**: Monitor API status
- **Error Handling**: Comprehensive error responses

## 📋 Prerequisites

- Node.js 18+ 
- MongoDB Atlas account (or local MongoDB)
- Environment variables configured

## 🛠️ Installation

```bash
# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your MongoDB URI
```

## ⚙️ Configuration

Create a `.env` file with:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
PORT=3001
FRONTEND_URL=http://localhost:5173
```

## 🏃 Running Locally

```bash
# Development mode
npm run dev

# Production mode
npm start
```

Server will start on `http://localhost:3001`

## 📡 API Endpoints

### Health Check
```
GET /health
```
Returns server status and timestamp.

### Save Conversation
```
POST /api/conversations
Body: { sessionId: string, messages: array }
```
Saves or updates a conversation for the given session ID.

### Load Conversation
```
GET /api/conversations/:sessionId
```
Retrieves conversation history for the session ID.

### Delete Conversation
```
DELETE /api/conversations/:sessionId
```
Deletes conversation history for the session ID.

## 🌐 Deploying to Render

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Add backend server"
git push origin main
```

### Step 2: Create Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `graphify-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

### Step 3: Add Environment Variables

In Render dashboard, add:
- `MONGODB_URI` - Your MongoDB connection string
- `FRONTEND_URL` - Your frontend URL (e.g., `https://your-app.vercel.app`)

### Step 4: Deploy

Click **"Create Web Service"** and wait for deployment.

Your API will be available at: `https://graphify-backend.onrender.com`

## 🔗 Connecting Frontend

Update your frontend `mongodb.ts` service to use the deployed backend:

```typescript
const API_BASE_URL = import.meta.env.PROD 
  ? 'https://graphify-backend.onrender.com'
  : 'http://localhost:3001';
```

## 📊 Database Structure

**Collection**: `conversations`

```javascript
{
  sessionId: string,      // Unique session identifier
  messages: array,        // Array of conversation messages
  createdAt: Date,        // First save timestamp
  updatedAt: Date         // Last update timestamp
}
```

## 🐛 Troubleshooting

**MongoDB Connection Failed**
- Verify `MONGODB_URI` is correct
- Check MongoDB Atlas whitelist (allow all IPs: `0.0.0.0/0` for production)
- Ensure database user has read/write permissions

**CORS Errors**
- Update `FRONTEND_URL` in `.env` to match your frontend domain
- Check browser console for specific CORS errors

**Port Already in Use**
- Change `PORT` in `.env`
- Kill existing process: `lsof -ti:3001 | xargs kill`

## 📝 License

Part of the Graphify AI project.
