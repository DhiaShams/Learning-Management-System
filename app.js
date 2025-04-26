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

// Student Dashboard
app.get("/student/dashboard", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'student') {
    return res.redirect("/student/login");
  }

  try {
    const student = await db.User.findByPk(req.session.user.id, {
      include: [
        { model: db.Course, as: 'enrolledCourses' }, // Correct alias for enrolled courses
        { model: db.Certificate, as: 'certificates' }, // Correct alias for certificates
      ],
    });

    if (!student) {
      return res.status(404).send('Student not found');
    }

    res.render("studentDashboard", {
      studentName: student.name,
      enrolledCourses: student.enrolledCourses,
      certificates: student.certificates,
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
        { model: db.Course, as: 'createdCourses' }, // Correct alias for created courses
      ],
    });

    if (!educator) {
      return res.status(404).send('Educator not found');
    }

    res.render("educatorDashboard", {
      educatorName: educator.name,
      courses: educator.createdCourses,
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error('Error occurred while rendering educator dashboard:', error);
    res.status(500).send('Internal server error');
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