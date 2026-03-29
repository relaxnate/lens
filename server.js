// Lens backend — proxies Anthropic API, keeps key server-side
const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Health check
app.get('/api/ping', (req, res) => res.json({ ok: true }));

// Catch-all SPA route
app.get('*', (req, res) => {
  res.sendFile(require('path').join(__dirname, '../frontend/index.html'));
});

// Proxy endpoint — keeps the API key server-side
app.post('/api/ask', async (req, res) => {
  const { messages, model, max_tokens, system } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Server API key not configured.' });
  }

  try {
    const body = {
      model: model || 'claude-haiku-4-5',
      max_tokens: max_tokens || 1024,
      messages,
    };
    if (system) body.system = system;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'API error' });
    }

    res.json({ text: data.content[0].text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Lens running on port ${PORT}`));
