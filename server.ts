import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

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

  // Email Sending Endpoint
  app.post('/api/emails/send', async (req, res) => {
    try {
      const { to, subject, text } = req.body;
      
      if (!to || !subject || !text) {
        return res.status(400).json({ error: 'Missing required fields: to, subject, text' });
      }
      
      // Generate test SMTP service account from ethereal.email
      // Only needed if you don't have a real mail account for testing
      let testAccount = await nodemailer.createTestAccount();

      // create reusable transporter object using the default SMTP transport
      let transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: testAccount.user, // generated ethereal user
          pass: testAccount.pass, // generated ethereal password
        },
      });

      // send mail with defined transport object
      let info = await transporter.sendMail({
        from: '"Donor Relations" <donors@example.com>', // sender address
        to: to, // list of receivers
        subject: subject, // Subject line
        text: text, // plain text body
      });

      console.log("Message sent: %s", info.messageId);
      console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));

      res.status(200).json({ 
        success: true, 
        messageId: info.messageId,
        previewUrl: nodemailer.getTestMessageUrl(info)
      });
    } catch (error) {
      console.error('Email sending error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
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
      
      // Zoom Endpoint Validation
      if (payload.event === 'endpoint.url_validation') {
        const plainToken = payload.payload.plainToken;
        const zoomSecretToken = process.env.ZOOM_SECRET_TOKEN || 'BoXvWUY7R9uA1QbJrxjASA'; // Fallback to token from screenshot for ease of setup
        
        const hashForValidate = crypto.createHmac('sha256', zoomSecretToken).update(plainToken).digest('hex');
        
        return res.status(200).json({
          plainToken: plainToken,
          encryptedToken: hashForValidate
        });
      }
      
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
