import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;

// Configure CORS to allow requests from your frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id']
}));

app.use(express.json());

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

let db;

// Connect to MongoDB
async function connectDB() {
  try {
    await client.connect();
    db = client.db('fusion_ai');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

connectDB();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Graphify Backend API is running',
    timestamp: new Date().toISOString()
  });
});

// Expose Google client ID (public-safe)
app.get('/api/config/google-client-id', (_req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(503).json({ success: false, error: 'Google client ID not configured' });
  }
  res.json({ success: true, clientId: GOOGLE_CLIENT_ID });
});

// Proxy to Groq chat completions
app.post('/api/groq/chat', async (req, res) => {
  if (!GROQ_API_KEY) {
    return res.status(503).json({ success: false, error: 'Groq API key not configured on server' });
  }

  const { messages, responseFormat, maxTokens, temperature } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ success: false, error: 'messages array is required' });
  }

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages,
        temperature: temperature ?? 0.3,
        max_tokens: maxTokens ?? 512,
        ...(responseFormat ? { response_format: { type: responseFormat } } : {})
      })
    });

    if (!groqResponse.ok) {
      const err = await groqResponse.json().catch(() => ({}));
      console.error('Groq proxy error', groqResponse.status, err);
      return res
        .status(groqResponse.status)
        .json({ success: false, error: err.error?.message || `Groq proxy error (${groqResponse.status})` });
    }

    const data = await groqResponse.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(500).json({ success: false, error: 'No content returned from Groq' });
    }

    return res.json({ success: true, content });
  } catch (error) {
    console.error('Groq proxy exception', error);
    return res.status(500).json({ success: false, error: 'Failed to reach Groq service' });
  }
});

// Save conversation
app.post('/api/conversations', async (req, res) => {
  try {
    const { sessionId, messages } = req.body;
    
    if (!sessionId || !messages) {
      return res.status(400).json({ 
        success: false, 
        error: 'sessionId and messages are required' 
      });
    }
    
    const conversations = db.collection('conversations');
    
    await conversations.updateOne(
      { sessionId },
      {
        $set: {
          messages,
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
    
    res.json({ success: true, message: 'Conversation saved' });
  } catch (error) {
    console.error('Error saving conversation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Load conversation
app.get('/api/conversations/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ 
        success: false, 
        error: 'sessionId is required' 
      });
    }
    
    const conversations = db.collection('conversations');
    const conversation = await conversations.findOne({ sessionId });
    
    if (conversation) {
      res.json({ success: true, messages: conversation.messages });
    } else {
      res.json({ success: true, messages: null });
    }
  } catch (error) {
    console.error('Error loading conversation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete conversation
app.delete('/api/conversations/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ 
        success: false, 
        error: 'sessionId is required' 
      });
    }
    
    const conversations = db.collection('conversations');
    const result = await conversations.deleteOne({ sessionId });
    
    res.json({ 
      success: true, 
      message: 'Conversation deleted',
      deleted: result.deletedCount 
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save or update user profile
app.post('/api/users', async (req, res) => {
  try {
    const { user } = req.body || {};

    if (!validateUserPayload(user)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user payload'
      });
    }

    const users = db.collection('users');
    const key = user.sub || user.email;

    await users.updateOne(
      { key },
      {
        $set: {
          key,
          sub: user.sub,
          email: user.email,
          name: user.name,
          picture: user.picture,
          emailVerified: user.emailVerified,
          hd: user.hd,
          locale: user.locale,
          phone: user.phone,
          lastLoginAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving user profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

function validateUserPayload(user) {
  if (!user || typeof user !== 'object') return false;
  const { email, name, sub, picture, emailVerified, hd, locale, phone } = user;
  if (typeof email !== 'string' || email.trim().length === 0) return false;
  if (typeof name !== 'string' || name.trim().length === 0) return false;

  const optionalStrings = [sub, picture, hd, locale, phone].filter(Boolean);
  const optionalValid = optionalStrings.every((v) => typeof v === 'string');
  if (!optionalValid) return false;

  if (emailVerified !== undefined && typeof emailVerified !== 'boolean') return false;

  return true;
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Graphify Backend API running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing MongoDB connection...');
  await client.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing MongoDB connection...');
  await client.close();
  process.exit(0);
});
