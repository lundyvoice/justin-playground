const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const publicDir = path.join(__dirname, 'public');

app.disable('x-powered-by');

// Serve static assets
app.use(express.static(publicDir, { extensions: ['html'] }));

// HTML route (single-page app)
const sendHtml = (res, file) => res.sendFile(path.join(publicDir, file));
app.get('/', (req, res) => sendHtml(res, 'index.html'));
app.get('*', (req, res) => sendHtml(res, 'index.html'));

// Start server
app.listen(PORT, () => {
  console.log(`Ally MLS app running at http://localhost:${PORT}`);
});


