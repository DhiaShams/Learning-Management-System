const request = require("supertest");
const db = require("../models/index");
const app = require("../app");

let server, agent;

describe("LMS Application Flow", function () {
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
    const res = await agent.get("/csrf-token");
    const csrfToken = res.body.csrfToken;

    const response = await agent.post("/api/student/signup").send({
      name: "John Doe",
      email: "john@example.com",
      password: "securepassword",
      _csrf: csrfToken,
    });

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty("message", "User registered successfully!");
    expect(response.body.user).toHaveProperty("email", "john@example.com");
  });

  test("Student Login", async () => {
    const res = await agent.get("/csrf-token");
    const csrfToken = res.body.csrfToken;

    const response = await agent.post("/api/student/login").send({
      email: "john@example.com",
      password: "securepassword",
      _csrf: csrfToken,
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("message", "Login successful");
    expect(response.body.user).toHaveProperty("email", "john@example.com");
  });

  test("Educator creates a course", async () => {
    // Sign up and login as educator
    let res = await agent.get("/csrf-token");
    let csrfToken = res.body.csrfToken;

    await agent.post("/api/educator/signup").send({
      name: "Alice",
      email: "alice@edu.com",
      password: "educatorpass",
      role: "educator",
      _csrf: csrfToken,
    });

    res = await agent.get("/csrf-token");
    csrfToken = res.body.csrfToken;

    await agent.post("/api/educator/login").send({
      email: "alice@edu.com",
      password: "educatorpass",
      _csrf: csrfToken,
    });

    res = await agent.get("/csrf-token");
    csrfToken = res.body.csrfToken;

    const response = await agent.post("/api/courses/create").send({
      title: "Introduction to Programming",
      description: "Learn basic programming concepts.",
      _csrf: csrfToken,
    });

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty("message", "Course created successfully!");
  });

  test("Educator creates a lesson", async () => {
    const res = await agent.get("/csrf-token");
    const csrfToken = res.body.csrfToken;

    const response = await agent.post("/api/lessons/").send({
      courseId: 1,
      title: "Introduction to Computing and Problem Solving",
      _csrf: csrfToken,
    });

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty("message", "Lesson created successfully");
  });

  test("Educator creates a page", async () => {
    const res = await agent.get("/csrf-token");
    const csrfToken = res.body.csrfToken;

    const response = await agent.post("/api/pages/").send({
      lessonId: 1,
      title: "Introduction to Computers",
      content: "A computer is a programmable machine that receives input, stores and manipulates data, and provides output in a useful format.",
      _csrf: csrfToken,
    });

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty("message", "Page created successfully");
  });

  test("Student enrolls in a course", async () => {
    // Login as student
    let res = await agent.get("/csrf-token");
    let csrfToken = res.body.csrfToken;

    res = await agent.post("/api/student/login").send({
      email: "john@example.com",
      password: "securepassword",
      _csrf: csrfToken,
    });

    expect(res.statusCode).toBe(200);

    // Enroll in the course
    res = await agent.get("/csrf-token");
    csrfToken = res.body.csrfToken;

    const response = await agent.post("/api/enroll").send({
      userId: 1,
      courseId: 1,
      _csrf: csrfToken,
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("message", "Enrollment successful!");
  });

  test("Student marks a page as completed", async () => {
    const res = await agent.get("/csrf-token");
    const csrfToken = res.body.csrfToken;

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
    // Sign up a new student
    let res = await agent.get("/csrf-token");
    let csrfToken = res.body.csrfToken;

    await agent.post("/api/student/signup").send({
      name: "Jane Smith",
      email: "jane@example.com",
      password: "studentpass2",
      _csrf: csrfToken,
    });

    res = await agent.get("/csrf-token");
    csrfToken = res.body.csrfToken;

    await agent.post("/api/student/login").send({
      email: "jane@example.com",
      password: "studentpass2",
      _csrf: csrfToken,
    });

    res = await agent.get("/csrf-token");
    csrfToken = res.body.csrfToken;

    // Enroll in the course
    await agent.post("/api/enroll").send({
      userId: 2,
      courseId: 1,
      _csrf: csrfToken,
    });

    // Attempt certificate generation without completing pages
    res = await agent.get("/csrf-token");
    csrfToken = res.body.csrfToken;

    const response = await agent.post("/api/certificates/generate").send({
      userId: 2,
      courseId: 1,
      score: 85,
      _csrf: csrfToken,
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty("message");
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
});