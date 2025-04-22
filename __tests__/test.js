const request = require("supertest");
 var cheerio = require("cheerio");
 const db = require("../models/index");
 const app = require("../app");
 
 let server, agent;
 
 describe("LMS Application flow", function () {
   beforeAll(async () => {
     await db.sequelize.sync({ force: true });
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
  test("User Sign Up", async () => {
    const res = await agent.get("/csrf-token");
    const csrfToken = res.body.csrfToken;

    const response = await agent.post("/api/student/signup").send({
      name: "John Doe",
      email: "john@example.com",
      password: "securepassword",
      _csrf: csrfToken
    });

    expect(response.statusCode).toBe(201);  // Expecting 201, which is correct
    expect(response.body).toHaveProperty("message", "User registered successfully!");
    expect(response.body.user).toHaveProperty("email", "john@example.com");
});

test("User Login", async () => {
  const res = await agent.get("/csrf-token"); 
  const csrfToken = res.body.csrfToken;

  const response = await agent.post("/api/student/login").send({
    email: "john@example.com",
    password: "securepassword",
    _csrf: csrfToken
  });

  expect(response.statusCode).toBe(200);
  expect(response.body).toHaveProperty("message", "Login successful");
  expect(response.body.user).toHaveProperty("email", "john@example.com");
});

  test("Educator creates a course", async () => {
    // Login as educator first
    let res = await agent.get("/");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/signup").send({
      name: "Alice",
      email: "alice@edu.com",
      password: "educatorpass",
      role: "educator",
      _csrf: csrfToken
    });

    res = await agent.get("/");
    csrfToken = extractCsrfToken(res);
    await agent.post("/login").send({
      email: "alice@edu.com",
      password: "educatorpass",
      _csrf: csrfToken
    });

    res = await agent.get("/educator/courses/new");
    csrfToken = extractCsrfToken(res);
    const response = await agent.post("/educator/courses").send({
      title: "Introduction to Programming",
      description: "Learn basic programming concepts.",
      _csrf: csrfToken
    });
    expect(response.statusCode).toBe(302);
  });

  test("Student enrolls in a course", async () => {
    let res = await agent.get("/");
    let csrfToken = extractCsrfToken(res);

    // Login back as student
    await agent.post("/login").send({
      email: "john@example.com",
      password: "securepassword",
      _csrf: csrfToken
    });

    res = await agent.get("/");
    csrfToken = extractCsrfToken(res);
    const response = await agent.post("/api/enroll").send({
      userId: 1, // Adjust based on your setup
      courseId: 1, // Adjust based on your setup
      _csrf: csrfToken
    });
    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe("Enrollment successful!");
  });

  test("Student marks a lesson page as completed", async () => {
    let res = await agent.get("/");
    let csrfToken = extractCsrfToken(res);

    const response = await agent.post("/api/lessons/1/complete").send({
      userId: 1, // Adjust based on your setup
      _csrf: csrfToken
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
