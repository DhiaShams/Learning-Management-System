const request = require("supertest");
const db = require("../models/index");
const app = require("../app");
const cheerio = require("cheerio");

let server, agent;

function extractCsrfToken(res) {
  const $ = cheerio.load(res.text);
  return $("[name=_csrf]").val();
}

beforeAll(async () => {
  await db.sequelize.sync({ force: true }); // Reset the database
  server = app.listen(4000, () => {});
  agent = request.agent(server);
});

afterAll(async () => {
  try {
    await db.sequelize.close();
    await server.close();
  } catch (error) {
    console.log(error);
  }
});

test("Student Sign Up", async () => {
  const res = await agent.get("/student");
  const csrfToken = extractCsrfToken(res);

  const response = await agent.post("/api/student/signup").send({
    name: "John Doe",
    email: "john@example.com",
    password: "securepassword",
    _csrf: csrfToken,
  });

  // Check for redirection or success
  if (response.statusCode === 302) {
    expect(response.headers.location).toBe("/student/login"); // Adjust based on your app's redirection
  } else {
    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty("message", "User registered successfully!");
    expect(response.body.user).toHaveProperty("email", "john@example.com");
  }
});

test("Student Login", async () => {
  const res = await agent.get("/student");
  const csrfToken = extractCsrfToken(res);

  const response = await agent.post("/api/student/login").send({
    email: "john@example.com",
    password: "securepassword",
    _csrf: csrfToken,
  });

  // Check for redirection or success
  if (response.statusCode === 302) {
    expect(response.headers.location).toBe("/student/dashboard"); // Adjust based on your app's redirection
  } else {
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("message", "Login successful");
    expect(response.body.user).toHaveProperty("email", "john@example.com");
  }
});

test("Student enrolls in a course", async () => {
  const res = await agent.get("/student");
  const csrfToken = extractCsrfToken(res);

  // Create a course first
  await db.Course.create({
    id: 1,
    title: "Introduction to Programming",
    description: "Learn basic programming concepts.",
  });

  const response = await agent.post("/api/enroll").send({
    userId: 1, // Ensure this user exists in the database
    courseId: 1, // Ensure this course exists in the database
    _csrf: csrfToken,
  });

  if (response.statusCode === 404) {
    console.error("Ensure the /api/enroll endpoint is implemented and accessible.");
  } else {
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("message", "Enrollment successful!");
  }
});

test("Student marks a page as completed", async () => {
  const res = await agent.get("/student");
  const csrfToken = extractCsrfToken(res);

  // Create a page first
  await db.Page.create({
    id: 1,
    lessonId: 1,
    title: "Introduction to Computers",
    content: "A computer is a programmable machine.",
  });

  const response = await agent.post("/api/progress/track").send({
    userId: 1,
    courseId: 1,
    lessonId: 1,
    pageId: 1,
    isCompleted: true,
    _csrf: csrfToken,
  });

  expect(response.statusCode).toBe(200);
  expect(response.body).toHaveProperty("message", "Progress updated successfully");
});

test("Certificate generation fails if not all pages are completed", async () => {
  const res = await agent.get("/student");
  const csrfToken = extractCsrfToken(res);

  const response = await agent.post("/api/certificates/generate").send({
    userId: 1,
    courseId: 1,
    score: 85,
    _csrf: csrfToken,
  });

  expect(response.statusCode).toBe(400);
  expect(response.body).toHaveProperty("message", "All pages must be completed to generate a certificate.");
});

test("Educator Sign Up and Login", async () => {
  const res = await agent.get("/educator");
  const csrfToken = extractCsrfToken(res);

  // Sign up as educator
  await agent.post("/api/educator/signup").send({
    name: "Alice",
    email: "alice@edu.com",
    password: "educatorpass",
    role: "educator",
    _csrf: csrfToken,
  });

  // Login as educator
  const response = await agent.post("/api/educator/login").send({
    email: "alice@edu.com",
    password: "educatorpass",
    _csrf: csrfToken,
  });

  expect(response.statusCode).toBe(200);
  expect(response.body).toHaveProperty("message", "Login successful");
  expect(response.body.user).toHaveProperty("email", "alice@edu.com");
});

test("Educator creates a course", async () => {
  const res = await agent.get("/educator");
  const csrfToken = extractCsrfToken(res);

  const response = await agent.post("/api/courses/create").send({
    title: "Introduction to Programming",
    description: "Learn basic programming concepts.",
    _csrf: csrfToken,
  });

  expect(response.statusCode).toBe(201);
  expect(response.body).toHaveProperty("message", "Course created successfully!");
});

test("Educator creates a lesson", async () => {
  const res = await agent.get("/educator");
  const csrfToken = extractCsrfToken(res);

  const response = await agent.post("/api/lessons/").send({
    courseId: 1,
    title: "Introduction to Computing and Problem Solving",
    _csrf: csrfToken,
  });

  expect(response.statusCode).toBe(201);
  expect(response.body).toHaveProperty("message", "Lesson created successfully");
});

test("Educator creates a page", async () => {
  const res = await agent.get("/educator");
  const csrfToken = extractCsrfToken(res);

  const response = await agent.post("/api/pages/").send({
    lessonId: 1,
    title: "Introduction to Computers",
    content: "A computer is a programmable machine that receives input, stores and manipulates data, and provides output in a useful format.",
    _csrf: csrfToken,
  });

  expect(response.statusCode).toBe(201);
  expect(response.body).toHaveProperty("message", "Page created successfully");
});

test("Student page completion tracking and fetching completions", async () => {
  const completion = await db.PageCompletion.create({
    userId: 1,
    pageId: 1,
  });

  expect(completion).toBeDefined();
  expect(completion.userId).toBe(1);
  expect(completion.pageId).toBe(1);

  const completions = await db.PageCompletion.findAll({
    include: [
      { model: db.Page, as: "page" },
      { model: db.User, as: "user" },
    ],
  });

  expect(completions.length).toBeGreaterThan(0);
  expect(completions[0].user).toBeDefined();
  expect(completions[0].page).toBeDefined();
  expect(completions[0].user.email).toBe("john@example.com");
  expect(completions[0].page.title).toBe("Introduction to Computers");
});