const express = require('express');
const app = express();
const authRoutes = require('./routes/authRoutes');//importing the login route
const db = require('./models');  // This will auto-load your Sequelize setup

const cookieParser = require('cookie-parser');
const csrf = require('tiny-csrf');

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser("ssh! some secret string"));
app.use(express.json());
app.use(csrf('your_super_secret_key_here_12345', ['POST', 'PUT', 'DELETE', 'PATCH']));

// Example route: Sending CSRF token to client
app.get('/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

// Example route: Protected POST
app.post('/example', (req, res) => {
    res.json({ message: 'CSRF token matched, POST request accepted!' });
});

app.use('/api',authRoutes);

const studentRoutes=require('./routes/student');
app.use('/api/student',studentRoutes);

const educatorRoutes=require('./routes/educator');
app.use('/api/educator',educatorRoutes);

const courseRoutes = require('./routes/course');
app.use('/api/courses', courseRoutes);

const lessonRoutes = require('./routes/lesson');
app.use('/api/lessons', lessonRoutes);

const pageRoutes = require('./routes/page');
app.use('/api/pages', pageRoutes);

const enrollmentRoutes = require('./routes/enrollment');
app.use('/api/enroll', enrollmentRoutes);

const progressRoutes= require('./routes/progress');
app.use('/api/progress',progressRoutes);

const doubtRoutes = require('./routes/doubt');
app.use('/api/doubts', doubtRoutes);

const certificateRoutes = require('./routes/certificate');
app.use('/api/certificates', certificateRoutes);

const reviewRoutes = require('./routes/review');
app.use('/api/reviews', reviewRoutes);

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

module.exports= app;
