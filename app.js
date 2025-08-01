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
  cookie: { secure: false }, 
}));
app.use(csrf('your_super_secret_key_here_12345', ['POST', 'PUT', 'DELETE', 'PATCH']));

// Set EJS as the view engine
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// CSRF Token Route
app.get('/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

// Initialize Passport.js
app.use(passport.initialize());
app.use(passport.session());


passport.use(
  new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email, password, done) => {
      try {
        // Find the user by email
        const user = await db.People.findOne({ where: { email } }); // <-- changed

        if (!user) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        // Validate the password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        // Authentication successful
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Serialize user to store in session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await db.People.findByPk(id); // <-- changed
    done(null, user);
  } catch (error) {
    done(error);
  }
});

const { sequelize } = require('./models');

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

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
app.post('/api/:role/login', (req, res, next) => {
  const { role } = req.params;

  passport.authenticate('local', (err, user, info) => {
    if (err) {
      console.error('Error during login:', err);
      return res.status(500).send('Internal server error');
    }

    if (!user) {
      return res.redirect(`/${role}/login?error=${info.message}`);
    }

    // Log the user in
    req.logIn(user, (err) => {
      if (err) {
        console.error('Error during session creation:', err);
        return res.status(500).send('Internal server error');
      }

      // Set the session user object
      req.session.user = {
        id: user.id,
        name: user.name,
        role: user.role,
      };

      // Redirect to the respective dashboard
      if (role === 'student') {
        return res.redirect('/student/dashboard');
      } else if (role === 'educator') {
        return res.redirect('/educator/dashboard');
      } else {
        return res.status(400).send('Invalid role');
      }
    });
  })(req, res, next);
});

// Handle signup
app.post('/api/:role/signup', async (req, res, next) => {
  const { role } = req.params;
  const { name, email, password } = req.body;

  try {
    // Hash password before storing
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await db.People.create({ name, email, password: hashedPassword, role });

    // Log the user in using Passport
    req.logIn(newUser, (err) => {
      if (err) {
        console.error('Error during session creation:', err);
        return res.status(500).send('Internal server error');
      }

      // Set session user object
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
    });
  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).send('Internal server error');
  }
});

app.get('/student/dashboard', ensureAuthenticated, async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'student') {
    return res.redirect('/student/login');
  }

  try {
    // Fetch the student and their enrolled courses
    const student = await db.People.findByPk(req.session.user.id, {
      include: [
        {
          model: db.Course,
          as: "enrolledCourses",
          include: [
            {
              model: db.People,
              as: "educator", // Include the educator who created the course
              attributes: ["name"], // Fetch only the educator's name
            },
            {
              model: db.Enrollment,
              as: "enrollments",
              attributes: ["id"],
            },
            {
              model: db.Lesson,
              as: "lessons",
              include: [
                {
                  model: db.LessonCompletion,
                  as: "completions",
                  where: { userId: req.session.user.id },
                  required: false, // Include even if no completion exists
                },
              ],
            },
          ],
        },
      ],
    });

    if (!student) {
      return res.status(404).send("Student not found");
    }

    // Calculate progress for each enrolled course
    student.enrolledCourses.forEach((course) => {
      const totalLessons = course.lessons.length;
      const completedLessons = course.lessons.filter(
        (lesson) => lesson.completions && lesson.completions.length > 0
      ).length;
      course.enrolledStudentsCount = course.enrollments ? course.enrollments.length : 0;
      course.progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
      course.isCompleted = totalLessons > 0 && completedLessons === totalLessons; // Mark as completed if all lessons are done
    });

    // Fetch available courses (not enrolled by the student)
    const availableCourses = await db.Course.findAll({
      where: {
        id: { [db.Sequelize.Op.notIn]: student.enrolledCourses.map((course) => course.id) },
      },
      include: [
        {
          model: db.People,
          as: "educator", // Include the educator who created the course
          attributes: ["name"], // Fetch only the educator's name
        },
        {
          model: db.Enrollment,
          as: "enrollments",
          attributes: ["id"], // Fetch enrollments to count students
        },
      ],
    });

    // Add enrolled students count to each available course
    availableCourses.forEach((course) => {
      course.enrolledStudentsCount = course.enrollments.length;
    });

    res.render("studentDashboard", {
      studentName: student.name,
      enrolledCourses: student.enrolledCourses,
      certificates: student.certificates,
      availableCourses: availableCourses,
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error("Error occurred while rendering student dashboard:", error);
    res.status(500).send("Internal server error");
  }
});
// { model: db.Certificate, as: 'certificates' },
// certificates: student.certificates,
app.get("/courses/:id", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'student') {
    return res.redirect("/student/login");
  }

  const courseId = req.params.id;

  try {
    // Check if the student is enrolled in the course
    const enrollment = await db.Enrollment.findOne({
      where: {
        userId: req.session.user.id,
        courseId: courseId,
      },
    });

    if (!enrollment) {
      return res.status(403).send("You are not enrolled in this course.");
    }

    // Fetch the course details, including lessons and their completion status
    const course = await db.Course.findOne({
      where: { id: courseId },
      include: [
        {
          model: db.Review,
          as: "reviews",
          include: [{ model: db.People, as: "student", attributes: ["name"] }],
        },
        {
          model: db.Lesson,
          as: "lessons",
          include: [
            {
              model: db.LessonCompletion,
              as: "completions",
              where: { userId: req.session.user.id },
              required: false, // Include even if no completion exists
            },
          ],
          order: [["id", "ASC"]], // Ensure lessons are ordered by ID
        },
      ],
    });

    if (!course) {
      return res.status(404).send("Course not found");
    }

    // Check if all lessons in the course are completed
    const isCourseCompleted = course.lessons.every(
      (lesson) => lesson.completions && lesson.completions.length > 0
    );

    res.render("courseDetails", {
      course,
      isCourseCompleted,
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error("Error occurred while fetching course details:", error);
    res.status(500).send("Internal server error");
  }
});

app.get("/courses/:courseId/lessons/:lessonId", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'student') {
    return res.redirect("/student/login");
  }

  const { courseId, lessonId } = req.params;

  try {
    // Check if the student is enrolled in the course
    const enrollment = await db.Enrollment.findOne({
      where: {
        userId: req.session.user.id,
        courseId: courseId,
      },
    });

    if (!enrollment) {
      return res.status(403).send("You are not enrolled in this course.");
    }

    // Fetch the lesson details, including its pages and their completion status
    const lesson = await db.Lesson.findOne({
      where: { id: lessonId, courseId: courseId },
      include: [
        {
          model: db.Page,
          as: "pages",
          include: [
            {
              model: db.PageCompletion,
              as: "completions",
              where: { userId: req.session.user.id },
              required: false, // Include even if no completion exists
            },
          ],
        },
      ],
    });

    if (!lesson) {
      return res.status(404).send("Lesson not found");
    }

    // Check if the lesson is completed
    const completedPages = lesson.pages.filter(page => page.completions.length > 0);
    const isLessonCompleted = completedPages.length === lesson.pages.length;

    res.render("lessonDetails", {
      lesson,
      isLessonCompleted,
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error("Error occurred while fetching lesson details:", error); // Log the error
    res.status(500).send("Internal server error");
  }
});

app.get("/lessons/:lessonId/pages/:pageId", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'student') {
    return res.redirect("/student/login");
  }

  const { lessonId, pageId } = req.params;

  try {
    // Fetch the page details
    const page = await db.Page.findOne({
      where: { id: pageId, lessonId: lessonId },
      include: [{ model: db.Lesson, as: "lesson" }],
    });

    if (!page) {
      return res.status(404).send("Page not found");
    }

    res.render("pageDetails", {
      page,
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error("Error occurred while fetching page details:", error);
    res.status(500).send("Internal server error");
  }
});

app.post("/courses/:id/enroll", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'student') {
    return res.redirect("/student/login");
  }

  const courseId = req.params.id;
  const userId = req.session.user.id;

  try {
    // Prevent duplicate enrollments
    const existing = await db.Enrollment.findOne({ where: { userId, courseId } });
    if (!existing) {
      await db.Enrollment.create({
        userId,
        courseId
      });
    }
    res.redirect(`/courses/${courseId}/preview`);
  } catch (error) {
    console.error("Error enrolling in course:", error);
    res.status(500).send("Internal server error");
  }
});

app.get("/courses/:id/preview", async (req, res) => {
  const courseId = req.params.id;

  try {
    // Fetch the course details, including lessons
    const course = await db.Course.findOne({
      where: { id: courseId },
      include: [
        {
          model: db.Lesson,
          as: "lessons",
          attributes: ["id", "title"], // Fetch only necessary fields
        },
        {
          model: db.People,
          as: "educator",
          attributes: ["name"], // Fetch educator's name
        },
      ],
    });

    if (!course) {
      return res.status(404).send("Course not found");
    }

    // Check if the student is enrolled in the course
    const isEnrolled = req.session.user
      ? await db.Enrollment.findOne({
          where: {
            userId: req.session.user.id,
            courseId: courseId,
          },
        })
      : false;

    res.render("coursePreview", {
      course,
      isEnrolled: !!isEnrolled, // Pass enrollment status to the view
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error("Error occurred while fetching course preview:", error);
    res.status(500).send("Internal server error");
  }
});

app.post("/pages/:pageId/complete", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'student') {
    return res.redirect("/student/login");
  }

  const { pageId } = req.params;

  try {
    // Mark the page as completed for the student
    await db.PageCompletion.findOrCreate({
      where: {
        userId: req.session.user.id,
        pageId: pageId,
      },
    });

    // Fetch the page, its lesson, and the lesson's pages
    const page = await db.Page.findByPk(pageId, {
      include: [{
        model: db.Lesson,
        as: "lesson",
        include: [{
          model: db.Page,
          as: "pages"
        }]
      }]
    });

    if (!page) {
      return res.status(404).send("Page not found");
    }

    const lesson = page.lesson;

    // Check if all pages in the lesson are completed
    const completedPageIds = await db.PageCompletion.findAll({
      where: {
        userId: req.session.user.id,
        pageId: lesson.pages.map(p => p.id),
      },
      attributes: ['pageId']
    });

    if (completedPageIds.length === lesson.pages.length) {
      // Mark the lesson as completed
      await db.LessonCompletion.findOrCreate({
        where: {
          userId: req.session.user.id,
          lessonId: lesson.id,
        },
      });

      // Fetch the course and its lessons
      const course = await db.Course.findByPk(lesson.courseId, {
        include: [{
          model: db.Lesson,
          as: "lessons"
        }]
      });

      const completedLessonIds = await db.LessonCompletion.findAll({
        where: {
          userId: req.session.user.id,
          lessonId: course.lessons.map(l => l.id),
        },
        attributes: ['lessonId']
      });

      if (completedLessonIds.length === course.lessons.length) {
        // Mark the course as completed
        await db.CourseCompletion.findOrCreate({
          where: {
            userId: req.session.user.id,
            courseId: course.id,
          },
        });
      }
    }

    // Redirect back to lesson page listing (good UX)
    res.redirect(`/courses/${lesson.courseId}/lessons/${lesson.id}`);
  } catch (error) {
    console.error("Error occurred while marking page as completed:", error);
    res.status(500).send("Internal server error");
  }
});

app.post("/lessons/:lessonId/complete", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'student') {
    return res.redirect("/student/login");
  }

  const { lessonId } = req.params;

  try {
    // Mark the lesson as completed for the student
    await db.LessonCompletion.findOrCreate({
      where: {
        userId: req.session.user.id,
        lessonId: lessonId,
      },
    });

    // Fetch the lesson and its associated course
    const lesson = await db.Lesson.findByPk(lessonId, {
      include: [
        {
          model: db.Course,
          as: "course",
          include: [
            {
              model: db.Lesson,
              as: "lessons",
            },
          ],
        },
      ],
    });

    if (!lesson) {
      return res.status(404).send("Lesson not found");
    }

    const course = lesson.course;

    // Check if all lessons in the course are completed
    const completedLessonIds = await db.LessonCompletion.findAll({
      where: {
        userId: req.session.user.id,
        lessonId: course.lessons.map((l) => l.id),
      },
      attributes: ["lessonId"],
    });

    if (completedLessonIds.length === course.lessons.length) {
      // Mark the course as completed
      await db.CourseCompletion.findOrCreate({
        where: {
          userId: req.session.user.id,
          courseId: course.id,
        },
      });
    }

    // Redirect back to the course details page
    res.redirect(`/courses/${course.id}`);
  } catch (error) {
    console.error("Error occurred while marking lesson as completed:", error);
    res.status(500).send("Internal server error");
  }
});

const PDFDocument = require('pdfkit');
const fs = require('fs');

app.get("/pages/:pageId", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'student') {
    return res.redirect("/student/login");
  }

  const { pageId } = req.params;

  try {
    // Fetch the page details, including doubts
    const page = await db.Page.findByPk(pageId, {
      include: [
        {
          model: db.Lesson,
          as: "lesson",
          include: [{ model: db.Course, as: "course" }],
        },
        {
          model: db.Doubt,
          as: "doubts",
          include: [{ model: db.People, as: "student", attributes: ["name"] }],
        },
      ],
    });

    if (!page) {
      return res.status(404).send("Page not found");
    }

    res.render("pageDetails", {
      page,
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error("Error occurred while fetching page details:", error);
    res.status(500).send("Internal server error");
  }
});

app.post("/pages/:pageId/doubt", async (req, res) => {
  try {
    const { pageId } = req.params;
    const { doubt } = req.body;

    // Ensure the user is logged in and is a student
    if (!req.session.user || req.session.user.role !== 'student') {
      return res.redirect("/student/login");
    }

    // Validate the doubt field
    if (!doubt || doubt.trim() === "") {
      return res.status(400).send("Doubt cannot be empty");
    }

    // Fetch the courseId using the pageId
    const page = await db.Page.findByPk(pageId, {
      include: [{ model: db.Lesson, as: "lesson", attributes: ["courseId"] }],
    });

    if (!page) {
      return res.status(404).send("Page not found");
    }

    const courseId = page.lesson.courseId;

    // Save the doubt in the database
    await db.Doubt.create({
      userId: req.session.user.id, // Assuming the user is logged in
      pageId,
      courseId, // Use the fetched courseId
      questionText: doubt.trim(),
    });

    // Redirect back to the same page
    res.redirect(`/pages/${pageId}`);
  } catch (error) {
    console.error("Error occurred while submitting doubt:", error);
    res.status(500).send("Internal server error");
  }
});

app.get("/pages/:pageId/doubts", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'student') {
    return res.redirect("/student/login");
  }
  const { pageId } = req.params;

  try {
    const doubts = await db.Doubt.findAll({
      where: { pageId },
      include: [
        { model: db.People, as: "student", attributes: ["id", "name"] }, // Include student details
      ],
    });

    if (!doubts || doubts.length === 0) {
      return res.status(404).json({ message: "No doubts found for this page." });
    }

    res.json(doubts); // Return doubts as JSON
  } catch (error) {
    console.error("Error occurred while fetching doubts:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/doubts/:doubtId/respond", async (req, res) => {
  const { doubtId } = req.params;
  const { response } = req.body;

  try {
    const doubt = await db.Doubt.findByPk(doubtId);

    if (!doubt) {
      return res.status(404).json({ message: "Doubt not found" });
    }

    // Update the doubt with the educator's response
    doubt.answerText = response;
    doubt.isResolved = true;
    await doubt.save();

    res.json({ message: "Response saved successfully" });
  } catch (error) {
    console.error("Error occurred while responding to doubt:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/courses/:courseId/review", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'student') {
    return res.redirect("/student/login");
  }

  const { courseId } = req.params;
  const { rating, comment } = req.body;

  try {
    // Validate the rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).send("Rating must be between 1 and 5.");
    }

    // Check if the student is enrolled in the course
    const enrollment = await db.Enrollment.findOne({
      where: {
        userId: req.session.user.id,
        courseId: courseId,
      },
    });

    if (!enrollment) {
      return res.status(403).send("You are not enrolled in this course.");
    }

    // Save the review in the database
    await db.Review.create({
      userId: req.session.user.id,
      courseId,
      rating,
      comment: comment ? comment.trim() : null,
    });

    res.redirect(`/courses/${courseId}`);
  } catch (error) {
    console.error("Error occurred while submitting review:", error);
    res.status(500).send("Internal server error");
  }
});

// Educator Dashboard
app.get("/educator/dashboard", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'educator') {
    return res.redirect("/educator/login");
  }

  try {
    // Fetch educator's courses
    const courses = await db.Course.findAll({
      where: { educatorId: req.session.user.id },
      include: [
        {
          model: db.Enrollment,
          as: "enrollments",
          attributes: ["id"], // Fetch enrollments to count students
        },
      ],
    });

    // Add enrolled students count to each course
    courses.forEach(course => {
      course.enrolledStudentsCount = course.enrollments.length;
    });

    // Fetch all available courses
    const availableCourses = await db.Course.findAll({
      include: [
        {
          model: db.Enrollment,
          as: "enrollments",
          attributes: ["id"], // Fetch enrollments to count students
        },
      ],
    });

    // Add enrolled students count to each available course
    availableCourses.forEach(course => {
      course.enrolledStudentsCount = course.enrollments.length;
    });

    res.render("educatorDashboard", {
      educatorName: req.session.user.name,
      courses,
      availableCourses,
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error("Error occurred while rendering educator dashboard:", error);
    res.status(500).send("Internal server error");
  }
});

app.get("/educator/courses", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'educator') {
    return res.redirect("/educator/login");
  }

  try {
    // Fetch courses created by the educator
    const courses = await db.Course.findAll({
      where: { educatorId: req.session.user.id },
      include: [
        {
          model: db.Enrollment,
          as: "enrollments",
          attributes: ["id"], // Fetch enrollments to count students
        },
      ],
    });

    // Add enrolled students count to each course
    courses.forEach(course => {
      course.enrolledStudentsCount = course.enrollments.length;
    });

    res.render("educatorCourses", {
      educatorName: req.session.user.name,
      courses,
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error("Error occurred while fetching educator courses:", error);
    res.status(500).send("Internal server error");
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
});

app.post("/educator/pages/:id/edit", async (req, res) => {
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

app.get("/educator/reports", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'educator') {
    return res.redirect("/educator/login");
  }

  try {
    // Fetch all courses created by the educator
    const courses = await db.Course.findAll({
      where: { educatorId: req.session.user.id },
      include: [
        {
          model: db.Enrollment,
          as: "enrollments",
          attributes: ["id"], // Fetch enrollments to count students
        },
      ],
    });

    // Add enrolled students count to each course
    courses.forEach(course => {
      course.enrolledStudentsCount = course.enrollments.length;
    });

    res.render("educatorReportsOverview", {
      educatorName: req.session.user.name,
      courses,
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error("Error occurred while fetching educator reports:", error);
    res.status(500).send("Internal server error");
  }
});

app.get("/educator/reports/:courseId", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'educator') {
    return res.redirect("/educator/login");
  }

  const { courseId } = req.params;

  try {
    // Fetch the course details
    const course = await db.Course.findByPk(courseId, {
      where: { educatorId: req.session.user.id },
      include: [
        {
          model: db.Review,
          as: "reviews",
          include: [{ model: db.People, as: "student", attributes: ["name"] }],
        },
        {
          model: db.Enrollment,
          as: "enrollments",
          include: [
            {
              model: db.People,
              as: "student",
              attributes: ["id", "name", "email"], // Fetch student details
            },
          ],
        },
        {
          model: db.Doubt,
          as: "doubts",
          include: [
            {
              model: db.People,
              as: "student",
              attributes: ["name"], // Fetch student name for doubts
            },
          ],
        },
        {
          model: db.Lesson,
          as: "lessons",
          include: [
            {
              model: db.LessonCompletion,
              as: "completions",
              attributes: ["userId"], // Fetch lesson completions
            },
          ],
        },
      ],
    });

    if (!course) {
      return res.status(404).send("Course not found");
    }

    // Calculate progress for each enrolled student
    const students = course.enrollments.map(enrollment => {
      const studentId = enrollment.student.id;
      const totalLessons = course.lessons.length;
      const completedLessons = course.lessons.filter(lesson =>
        lesson.completions.some(completion => completion.userId === studentId)
      ).length;

      return {
        name: enrollment.student.name,
        email: enrollment.student.email,
        progress: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
      };
    });

    res.render("educatorReports", {
      course,
      students,
      doubts: course.doubts,
      reviews: course.reviews,
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error("Error occurred while fetching course reports:", error);
    res.status(500).send("Internal server error");
  }
});

app.get("/doubts/:doubtId", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'educator') {
    return res.redirect("/educator/login");
  }

  const { doubtId } = req.params;

  try {
    const doubt = await db.Doubt.findByPk(doubtId, {
      include: [
        { model: db.People, as: "student", attributes: ["name"] }, // Include student details
        { model: db.Page, as: "page", attributes: ["title"] },   // Include page details
      ],
    });

    if (!doubt) {
      return res.status(404).send("Doubt not found");
    }

    res.render("doubtDetails", {
      doubt,
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error("Error occurred while fetching doubt details:", error);
    res.status(500).send("Internal server error");
  }
});

// When responding to a doubt
app.post("/doubts/:doubtId/respond", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'educator') {
    return res.redirect("/educator/login");
  }

  const { doubtId } = req.params;
  const { response } = req.body;

  try {
    const doubt = await db.Doubt.findByPk(doubtId);

    if (!doubt) {
      return res.status(404).send("Doubt not found");
    }

    // Update the doubt with the educator's response
    doubt.answerText = response;
    doubt.isResolved = true;
    await doubt.save();

    // Redirect back to the doubt details page
    res.redirect(`/doubts/${doubtId}`);
  } catch (error) {
    console.error("Error occurred while responding to doubt:", error);
    res.status(500).send("Internal server error");
  }
});

app.get("/change-password", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  res.render("changePassword", {
    csrfToken: req.csrfToken(),
    userName: req.session.user.name,
  });
});

app.post("/change-password", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const { currentPassword, newPassword, confirmPassword } = req.body;

  try {
    // Validate the request body
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).send("All fields are required");
    }

    // Fetch the user from the database
    const user = await db.People.findByPk(req.session.user.id);

    if (!user) {
      return res.status(404).send("User not found");
    }

    // Validate the current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).send("Current password is incorrect");
    }

    // Validate the new password and confirmation
    if (newPassword !== confirmPassword) {
      return res.status(400).send("New password and confirmation do not match");
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password
    user.password = hashedPassword;
    await user.save();

    // Redirect to the appropriate dashboard based on the user's role
    if (req.session.user.role === "student") {
      return res.redirect("/student/dashboard?success=Password changed successfully");
    } else if (req.session.user.role === "educator") {
      return res.redirect("/educator/dashboard?success=Password changed successfully");
    } else {
      return res.redirect("/login");
    }
  } catch (error) {
    console.error("Error occurred while changing password:", error);
    res.status(500).send("Internal server error");
  }
});

app.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Error during logout:', err);
      return res.status(500).send('Internal server error');
    }
    res.redirect('/');
  });
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