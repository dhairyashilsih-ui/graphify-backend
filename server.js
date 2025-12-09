import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configure CORS to allow requests from your frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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
