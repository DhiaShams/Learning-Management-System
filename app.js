const express = require('express');
const path = require('path'); // Ensure 'path' is imported
const cookieParser = require('cookie-parser');
const csrf = require('tiny-csrf');
const db = require('./models'); // Auto-load Sequelize setup

const app = express();

// Middleware setup
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser("ssh! some secret string"));
app.use(express.json());
app.use(csrf('your_super_secret_key_here_12345', ['POST', 'PUT', 'DELETE', 'PATCH']));

// Set EJS as the view engine
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// Routes
const authRoutes = require('./routes/authRoutes');
app.use('/api', authRoutes);

const studentRoutes = require('./routes/student');
app.use('/api/student', studentRoutes);

const educatorRoutes = require('./routes/educator');
app.use('/api/educator', educatorRoutes);

const courseRoutes = require('./routes/course');
app.use('/api/courses', courseRoutes);

const lessonRoutes = require('./routes/lesson');
app.use('/api/lessons', lessonRoutes);

const pageRoutes = require('./routes/page');
app.use('/api/pages', pageRoutes);

const enrollmentRoutes = require('./routes/enrollment');
app.use('/api/enroll', enrollmentRoutes);

const progressRoutes = require('./routes/progress');
app.use('/api/progress', progressRoutes);

const doubtRoutes = require('./routes/doubt');
app.use('/api/doubts', doubtRoutes);

const certificateRoutes = require('./routes/certificate');
app.use('/api/certificates', certificateRoutes);

const reviewRoutes = require('./routes/review');
app.use('/api/reviews', reviewRoutes);

// CSRF Token Route
app.get('/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

// Example Protected POST Route
app.post('/example', (req, res) => {
    res.json({ message: 'CSRF token matched, POST request accepted!' });
});

// Dashboard Route
app.get("/", async (req, res) => {
  // Temporary mock data for student
  const isStudent = true; // Replace with actual logic to determine user role
  const studentName = "Amal"; // Replace with actual name once auth is complete
  const educatorName = "Educator"; // Replace with actual name once auth is complete
  const enrolledCourses = []; // Replace with actual enrolled courses
  const certificates = []; // Replace with actual certificates
  const courses = []; // Replace with actual courses for educators
  const reviews = []; // Replace with actual reviews for educators

  if (isStudent) {
    res.render("studentDashboard", { 
      title: "Learning Management System",
      csrfToken: req.csrfToken(),
      studentName,
      enrolledCourses,
      certificates,
    });
  } else {
    res.render("educatorDashboard", {
      title: "Educator Dashboard",
      csrfToken: req.csrfToken(),
      educatorName,
      courses,
      reviews,
    });
  }
});

// Test Database Connection
db.sequelize.authenticate()
  .then(() => {
    console.log('✅ Database connected...');
  })
  .catch(err => {
    console.error('❌ Error connecting to the database:', err);
  });

// Export the app
module.exports = app;