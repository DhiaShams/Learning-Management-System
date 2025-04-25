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

app.get("/", (req, res) => {
  const role = req.query.role;
  res.render("index", {
    role: role || null,
  });
});

app.get('/:role', (req, res) => {
  const { role } = req.params;
  if (!['student', 'educator'].includes(role)) {
    return res.status(404).send('Not found');
  }
  res.render('auth', {
    role,
    csrfToken: req.csrfToken(),
  });
});

app.get("/student/signup", (req, res) => {
  res.render("auth", {
    role: "student",
    csrfToken: req.csrfToken(),
  });
});

app.get("/student/login", (req, res) => {
  res.render("auth", {
    role: "student",
    csrfToken: req.csrfToken(),
  });
});

app.get("/educator/signup", (req, res) => {
  res.render("auth", {
    role: "educator",
    csrfToken: req.csrfToken(),
  });
});

app.get("/educator/login", (req, res) => {
  res.render("auth", {
    role: "educator",
    csrfToken: req.csrfToken(),
  });
});

app.get("/student/dashboard", async (req, res) => {
  const student = await Student.findByPk(req.session.studentId, {
    include: [Course, Certificate]
  });
  res.render("studentDashboard", {
    studentName: student.name,
    enrolledCourses: student.Courses,
    certificates: student.Certificates,
  });
});

app.get("/educator/dashboard", async (req, res) => {
  const educator = await Educator.findByPk(req.session.educatorId, {
    include: [Course]
  });
  res.render("educatorDashboard", {
    educatorName: educator.name,
    courses: educator.Courses,
  });
});

// Route to render the course creation form
// app.get("/educator/courses/new", (req, res) => {
//   res.render("courseForm", {
//     formTitle: "Create New Course",
//     formAction: "/api/courses/create", // POST
//     csrfToken: req.csrfToken(),
//     course: null,
//     buttonLabel: "Create Course",
//   });
// });

// Route to render the course editing form
// app.get("/educator/courses/:id/edit", async (req, res) => {
//   const courseId = req.params.id;
//   const course = await db.Course.findByPk(courseId); // Fetch course from the database
//   if (!course) {
//     return res.status(404).send("Course not found");
//   }
//   res.render("courseForm", {
//     formTitle: "Edit Course",
//     formAction: `/api/educator/courses/${course.id}?_method=PUT`, // if using method-override
//     csrfToken: req.csrfToken(),
//     course,
//     buttonLabel: "Update Course",
//   });
// });

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