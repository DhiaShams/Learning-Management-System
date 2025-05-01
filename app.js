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

const { sequelize } = require('./models');

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
    // Fetch the student and their enrolled courses
    const student = await db.User.findByPk(req.session.user.id, {
      include: [
        {
          model: db.Course,
          as: "enrolledCourses",
          include: [
            {
              model: db.User,
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
        }, {
          model: db.Certificate,
          as: "certificates",
          include: [
            {
              model: db.Course,
              as: "course",
              attributes: ["title"], // Fetch the course title for the certificate
            },
          ],
        },
      ],
    });

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
          model: db.User,
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

    // Add enrolled students count to each enrolled course
    student.enrolledCourses.forEach((course) => {
      course.enrolledStudentsCount = course.enrollments ? course.enrollments.length : 0;
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

  try {
    // Enroll the student in the course
    await db.Enrollment.findOrCreate({
      where: {
        userId: req.session.user.id,
        courseId: courseId,
      },
    });

    // Redirect back to the dashboard
    res.redirect("/student/dashboard");
  } catch (error) {
    console.error("Error occurred while enrolling in the course:", error);
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
          model: db.User,
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

app.get("/certificates/generate/:courseId", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'student') {
    return res.redirect("/student/login");
  }

  const { courseId } = req.params;

  try {
    // Fetch the course and check if it's completed
    const course = await db.Course.findOne({
      where: { id: courseId },
      include: [
        {
          model: db.User,
          as: "educator",
          attributes: ["name"], // Fetch the educator's name
        },
        {
          model: db.Lesson,
          as: "lessons",
          include: [
            {
              model: db.LessonCompletion,
              as: "completions",
              where: { userId: req.session.user.id },
              required: false,
            },
          ],
        },
      ],
    });

    if (!course) {
      return res.status(404).send("Course not found");
    }

    const totalLessons = course.lessons.length;
    const completedLessons = course.lessons.filter(
      (lesson) => lesson.completions && lesson.completions.length > 0
    ).length;

    if (totalLessons === 0 || completedLessons !== totalLessons) {
      return res.status(403).send("You must complete the course to generate a certificate");
    }

    // Ensure the certificates directory exists
    const certificatesDir = path.join(__dirname, "certificates");
    if (!fs.existsSync(certificatesDir)) {
      fs.mkdirSync(certificatesDir);
    }

    // Generate the certificate as a PDF
    const filePath = path.join(certificatesDir, `certificate-${req.session.user.id}-${courseId}.pdf`);

    // Generate the certificate as a PDF
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'portrait',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });

    // Create the PDF content
    doc.pipe(fs.createWriteStream(filePath));

    // Add a background color
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f4f4f4');

    // Add a border
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke('#000');

    // Add the title
    doc.fontSize(30).font('Helvetica-Bold').fillColor('#333').text("Certificate of Completion", {
      align: "center",
    });

    doc.moveDown(2);

    // Add the student's name
    doc.fontSize(20).font('Helvetica').fillColor('#555').text(`This is to certify that`, {
      align: "center",
    });
    doc.moveDown();
    doc.fontSize(25).font('Helvetica-Bold').fillColor('#000').text(`${req.session.user.name}`, {
      align: "center",
    });

    doc.moveDown();
    doc.fontSize(18).font('Helvetica').fillColor('#555').text(
      `has successfully completed the course "${course.title}"`,
      { align: "center" }
    );

    doc.moveDown();
    doc.fontSize(16).font('Helvetica').fillColor('#555').text(`Educator: ${course.educator.name}`, {
      align: "center",
    });

    doc.moveDown();
    doc.fontSize(16).font('Helvetica').fillColor('#555').text(
      `Score: ${Math.round((completedLessons / totalLessons) * 100)}%`,
      { align: "center" }
    );

    doc.moveDown(2);
    doc.fontSize(14).font('Helvetica').fillColor('#555').text(
      `Date: ${new Date().toLocaleDateString()}`,
      { align: "center" }
    );

    // Add a footer
    doc.moveDown(4);
    doc.fontSize(12).font('Helvetica-Oblique').fillColor('#999').text(
      "This certificate is generated by the LMS system.",
      { align: "center" }
    );

    doc.end();

    // Save the certificate record in the database
    await db.Certificate.create({
      userId: req.session.user.id,
      courseId: courseId,
      filePath: filePath,
    });

    // Redirect to the dashboard with a success message
    res.redirect("/student/dashboard?success=Certificate generated successfully");
  } catch (error) {
    console.error("Error occurred while generating certificate:", error);
    res.status(500).send("Internal server error");
  }
});

app.get("/certificates/view/:courseId", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'student') {
    return res.redirect("/student/login");
  }

  const { courseId } = req.params;

  try {
    // Fetch the certificate record
    const certificate = await db.Certificate.findOne({
      where: {
        userId: req.session.user.id,
        courseId: courseId,
      },
    });

    if (!certificate) {
      return res.status(404).send("Certificate not found");
    }

    // Serve the certificate file
    res.sendFile(certificate.filePath, { root: "." });
  } catch (error) {
    console.error("Error occurred while fetching certificate:", error);
    res.status(500).send("Internal server error");
  }
});

app.get("/certificates/view/:certificateId", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'student') {
    return res.redirect("/student/login");
  }

  const { certificateId } = req.params;

  try {
    // Fetch the certificate record
    const certificate = await db.Certificate.findOne({
      where: {
        id: certificateId,
        userId: req.session.user.id,
      },
    });

    if (!certificate) {
      return res.status(404).send("Certificate not found");
    }

    // Serve the certificate file
    res.sendFile(path.resolve(certificate.filePath));
  } catch (error) {
    console.error("Error occurred while fetching certificate:", error);
    res.status(500).send("Internal server error");
  }
});

//doubts
app.post("/pages/:pageId/doubt", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'student') {
    return res.redirect("/student/login");
  }

  const { pageId } = req.params;
  const { doubt } = req.body;

  try {
    // Fetch the page and its associated lesson and course
    const page = await db.Page.findByPk(pageId, {
      include: [
        {
          model: db.Lesson,
          as: "lesson",
          include: [{ model: db.Course, as: "course" }],
        },
      ],
    });

    if (!page) {
      return res.status(404).send("Page not found");
    }

    // Save the doubt in the database
    await db.Doubt.create({
      userId: req.session.user.id,
      pageId: pageId,
      courseId: page.lesson.course.id, // Get the courseId from the associated course
      questionText: doubt, // Save the doubt text
    });

    res.redirect(`/pages/${pageId}`);
  } catch (error) {
    console.error("Error occurred while submitting doubt:", error);
    res.status(500).send("Internal server error");
  }
});

app.get("/pages/:pageId", async (req, res) => {
  try {
    const page = await db.Page.findByPk(req.params.pageId, {
      include: [
        {
          model: db.Lesson,
          as: "lesson",
          include: [{ model: db.Course, as: "course" }],
        },
        {
          model: db.Doubt,
          as: "doubts",
          include: [
            { model: db.User, as: "student", attributes: ["name"] },
          ],
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
          model: db.Enrollment,
          as: "enrollments",
          include: [
            {
              model: db.User,
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
              model: db.User,
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
        { model: db.User, as: "student", attributes: ["name"] }, // Include student details
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

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error during logout:", err);
      return res.status(500).send("Internal server error");
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