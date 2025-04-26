const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const csrf = require('tiny-csrf');
const session = require('express-session');
const db = require('./models'); // Sequelize models
const bcrypt = require('bcrypt'); // For password hashing

const app = express();

// Middleware setup
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser("ssh! some secret string"));
app.use(express.json());
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
}));
app.use(csrf('your_super_secret_key_here_12345', ['POST', 'PUT', 'DELETE', 'PATCH']));

// Set EJS as the view engine
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// CSRF Token Route
app.get('/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

app.get('/', (req, res) => {
  res.render('index', {
    role: null,
    csrfToken: req.csrfToken(),
  });
});

// Render login/signup form with CSRF token
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

// Handle login
app.post('/api/:role/login', async (req, res) => {
  const { role } = req.params;
  const { email, password } = req.body;

  try {
    const user = await db.User.findOne({ where: { email, role } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      // Validate password using bcrypt
      return res.redirect(`/${role}/login?error=Invalid credentials`);
    }

    // Set session
    req.session.user = {
      id: user.id,
      name: user.name,
      role: role,
    };

    // Redirect to the respective dashboard
    if (role === 'student') {
      return res.redirect('/student/dashboard');
    } else if (role === 'educator') {
      return res.redirect('/educator/dashboard');
    } else {
      return res.status(400).send('Invalid role');
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).send('Internal server error');
  }
});

// Handle signup
app.post('/api/:role/signup', async (req, res) => {
  const { role } = req.params;
  const { name, email, password } = req.body;

  try {
    // Hash password before storing
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await db.User.create({ name, email, password: hashedPassword, role });

    // Set session
    req.session.user = {
      id: newUser.id,
      name: newUser.name,
      role: role,
    };

    // Redirect to the respective dashboard
    if (role === 'student') {
      return res.redirect('/student/dashboard');
    } else if (role === 'educator') {
      return res.redirect('/educator/dashboard');
    } else {
      return res.status(400).send('Invalid role');
    }
  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).send('Internal server error');
  }
});

app.get("/student/dashboard", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'student') {
    return res.redirect("/student/login");
  }

  try {
    const student = await db.User.findByPk(req.session.user.id, {
      include: [
        { model: db.Course, as: 'enrolledCourses' },
        { model: db.Certificate, as: 'certificates' },
      ],
    });

    if (!student) {
      return res.status(404).send('Student not found');
    }

    const availableCourses = await db.Course.findAll({
      where: {
        id: { [db.Sequelize.Op.notIn]: student.enrolledCourses.map(course => course.id) },
      },
    });

    res.render("studentDashboard", {
      studentName: student.name,
      enrolledCourses: student.enrolledCourses,
      certificates: student.certificates,
      availableCourses: availableCourses, // Ensure this line is included
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error('Error occurred while rendering student dashboard:', error);
    res.status(500).send('Internal server error');
  }
});


// Educator Dashboard
app.get("/educator/dashboard", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'educator') {
    return res.redirect("/educator/login");
  }

  try {
    const educator = await db.User.findByPk(req.session.user.id, {
      include: [
        {
          model: db.Course,
          as: 'createdCourses',
          include: [
            {
              model: db.Review,
              as: 'reviews', // Include reviews for each course
            },
          ],
        },
      ],
    });

    if (!educator) {
      return res.status(404).send('Educator not found');
    }

    // Flatten reviews from all courses
    const reviews = educator.createdCourses.flatMap(course => course.reviews);

    res.render("educatorDashboard", {
      educatorName: educator.name,
      courses: educator.createdCourses,
      reviews: reviews, // Pass reviews to the view
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error('Error occurred while rendering educator dashboard:', error);
    res.status(500).send('Internal server error');
  }
});

app.get("/educator/course/new", (req, res) => {
  if (!req.session.user || req.session.user.role !== 'educator') {
    return res.redirect("/educator/login");
  }

  res.render("courseForm", {
    formTitle: "Create New Course",
    formAction: "/educator/course/new",
    buttonLabel: "Create Course",
    csrfToken: req.csrfToken(), // Include CSRF token for form submission
  });
});

app.post("/educator/course/new", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'educator') {
    return res.redirect("/educator/login");
  }

  const { title, description } = req.body;

  try {
    await db.Course.create({
      title,
      description,
      educatorId: req.session.user.id, // Ensure this matches the foreign key in the Course model
    });

    res.redirect("/educator/dashboard");
  } catch (error) {
    console.error("Error occurred while creating a new course:", error);
    res.status(500).send("Internal server error");
  }
});

app.get("/educator/courses/:id/edit", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'educator') {
    return res.redirect("/educator/login");
  }

  const courseId = req.params.id;

  try {
    const course = await db.Course.findOne({
      where: { id: courseId, educatorId: req.session.user.id }, // Ensure the course belongs to the logged-in educator
    });

    if (!course) {
      return res.status(404).send("Course not found");
    }

    res.render("editCourseForm", {
      course,
      csrfToken: req.csrfToken(), // Include CSRF token for form submission
    });
  } catch (error) {
    console.error("Error occurred while fetching course details:", error);
    res.status(500).send("Internal server error");
  }
});

app.post("/educator/courses/:id/edit", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'educator') {
    return res.redirect("/educator/login");
  }

  const courseId = req.params.id;
  const { title, description } = req.body;

  try {
    const course = await db.Course.findOne({
      where: { id: courseId, educatorId: req.session.user.id }, // Ensure the course belongs to the logged-in educator
    });

    if (!course) {
      return res.status(404).send("Course not found");
    }

    // Update the course details
    await course.update({ title, description });

    // Redirect back to the educator dashboard
    res.redirect("/educator/dashboard");
  } catch (error) {
    console.error("Error occurred while updating course:", error);
    res.status(500).send("Internal server error");
  }
});

app.get("/educator/courses/:id/lessons", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'educator') {
    return res.redirect("/educator/login");
  }

  const courseId = req.params.id;

  try {
    const course = await db.Course.findOne({
      where: { id: courseId, educatorId: req.session.user.id },
      include: [{ model: db.Lesson, as: 'lessons', include: [{ model: db.Page, as: 'pages' }] }],
    });

    if (!course) {
      return res.status(404).send("Course not found");
    }

    res.render("lessons", {
      course,
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error("Error occurred while fetching lessons:", error);
    res.status(500).send("Internal server error");
  }
});

app.post("/educator/courses/:id/lessons", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'educator') {
    return res.redirect("/educator/login");
  }

  const courseId = req.params.id;
  const { title } = req.body;

  try {
    await db.Lesson.create({
      title,
      courseId,
    });

    res.redirect(`/educator/courses/${courseId}/lessons`);
  } catch (error) {
    console.error("Error occurred while creating a lesson:", error);
    res.status(500).send("Internal server error");
  }
});

app.get("/educator/lessons/:id/pages", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'educator') {
    return res.redirect("/educator/login");
  }

  const lessonId = req.params.id;

  try {
    const lesson = await db.Lesson.findOne({
      where: { id: lessonId },
      include: [{ model: db.Page, as: 'pages' }],
    });

    if (!lesson) {
      return res.status(404).send("Lesson not found");
    }

    res.render("pages", {
      lesson,
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error("Error occurred while fetching pages:", error);
    res.status(500).send("Internal server error");
  }
});

app.post("/educator/lessons/:id/pages", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'educator') {
    return res.redirect("/educator/login");
  }

  const lessonId = req.params.id;
  const { title, content } = req.body;

  try {
    // Create a new page associated with the lesson
    await db.Page.create({
      title,
      content,
      lessonId,
    });

    // Redirect back to the lessons page for the course
    const lesson = await db.Lesson.findByPk(lessonId);
    res.redirect(`/educator/courses/${lesson.courseId}/lessons`);
  } catch (error) {
    console.error("Error occurred while creating a page:", error);
    res.status(500).send("Internal server error");
  }
});

app.get("/educator/pages/:id/edit", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'educator') {
    return res.redirect("/educator/login");
  }

  const pageId = req.params.id;

  try {
    const page = await db.Page.findByPk(pageId, {
      include: [{ model: db.Lesson, as: 'lesson', include: [{ model: db.Course, as: 'course' }] }],
    });

    if (!page) {
      return res.status(404).send("Page not found");
    }

    res.render("editPage", {
      page,
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error("Error occurred while fetching the page:", error);
    res.status(500).send("Internal server error");
  }
});app.post("/educator/pages/:id/edit", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'educator') {
    return res.redirect("/educator/login");
  }

  const pageId = req.params.id;
  const { title, content } = req.body;

  try {
    const page = await db.Page.findByPk(pageId);

    if (!page) {
      return res.status(404).send("Page not found");
    }

    // Update the page details
    await page.update({ title, content });

    // Redirect back to the lessons page for the course
    const lesson = await db.Lesson.findByPk(page.lessonId);
    res.redirect(`/educator/courses/${lesson.courseId}/lessons`);
  } catch (error) {
    console.error("Error occurred while updating the page:", error);
    res.status(500).send("Internal server error");
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