import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Webhook parser
  app.use(express.json());

  // API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Zeffy Zapier Webhook Endpoint
  app.post('/api/webhooks/zeffy', async (req, res) => {
    try {
      const payload = req.body;
      console.log('Received Zeffy webhook payload:', payload);
      // In a real app, we would verify the webhook signature here
      // and use Firebase Admin SDK to write to Firestore securely.
      // For this demo, we'll just log it and return 200.
      
      res.status(200).json({ success: true, message: 'Webhook received' });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Store pending Zoom minutes in memory
  const pendingZoomMinutes: any[] = [];

  // Zoom Webhook Endpoint for Meeting Minutes
  app.post('/api/webhooks/zoom', async (req, res) => {
    try {
      const payload = req.body;
      console.log('Received Zoom webhook payload:', payload);
      
      // Store in memory for the frontend to fetch
      pendingZoomMinutes.push({
        ...payload,
        receivedAt: new Date().toISOString()
      });
      
      res.status(200).json({ success: true, message: 'Zoom Webhook received' });
    } catch (error) {
      console.error('Zoom Webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Endpoint to fetch pending Zoom minutes
  app.get('/api/webhooks/zoom/pending', (req, res) => {
    res.json({ minutes: pendingZoomMinutes });
  });

  // Endpoint to clear pending Zoom minutes
  app.delete('/api/webhooks/zoom/pending', (req, res) => {
    pendingZoomMinutes.length = 0;
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
