import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3001;

// Allow both production frontend and local dev
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const allowedOrigins = [FRONTEND_URL, 'http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const normalizedOrigin = origin.replace(/\/?$/, '');
    const isAllowed = allowedOrigins.some(o => normalizedOrigin === o.replace(/\/?$/, ''));
    callback(isAllowed ? null : new Error('CORS not allowed'), isAllowed);
  },
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const uri = process.env.VITE_MONGODB_URI;
const client = new MongoClient(uri);

let db;

// Connect to MongoDB
async function connectDB() {
  try {
    await client.connect();
    db = client.db('fusion_ai');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}

connectDB();

// Save conversation
app.post('/api/conversations', async (req, res) => {
  try {
    const { sessionId, messages } = req.body;
    
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
    
    const conversations = db.collection('conversations');
    await conversations.deleteOne({ sessionId });
    
    res.json({ success: true, message: 'Conversation deleted' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
