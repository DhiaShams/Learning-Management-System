const express = require('express');
const app = express();
const db = require('./models');  // This will auto-load your Sequelize setup

app.use(express.json());

// Test DB connection
db.sequelize.authenticate()
  .then(() => {
    console.log('✅ Database connected...');
  })
  .catch(err => {
    console.error('❌ Error connecting to the database:', err);
  });

// Basic test route
app.get('/', (req, res) => {
  res.send('LMS API is running!');
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
