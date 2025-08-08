const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Route for the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route for Navigator product page
app.get('/navigator', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'navigator.html'));
});

// Route for Add/Edit product page
app.get('/add-edit', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'add-edit.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
}); 