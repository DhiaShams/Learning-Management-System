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
  test("Student Sign Up", async () => {
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

test("Student Login", async () => {
  const res = await agent.get("/csrf-token"); 
  const csrfToken = res.body.csrfToken;

  const response = await agent.post("/api/student/login").send({
    email: "john@example.com",
    password: "securepassword",
    _csrf: csrfToken
  });

  expect(response.statusCode).toBe(200);
  expect(response.body).toHaveProperty("message", "Login successful");
  expect(response.statusCode).toBe(200);
  expect(response.body.user).toHaveProperty("email", "john@example.com");
});

  test("Educator creates a course", async () => {
    // Login as educator first
  let res = await agent.get("/csrf-token"); 
  let csrfToken = res.body.csrfToken;
    await agent.post("/api/educator/signup").send({
      name: "Alice",
      email: "alice@edu.com",
      password: "educatorpass",
      role: "educator",
      _csrf: csrfToken
    });

    res = await agent.get("/csrf-token"); 
    csrfToken = res.body.csrfToken;
    await agent.post("/api/educator/login").send({
      email: "alice@edu.com",
      password: "educatorpass",
      _csrf: csrfToken
    });

    res = await agent.get("/csrf-token");
    csrfToken = res.body.csrfToken;
    const response = await agent.post("/api/courses/create").send({
      title: "Introduction to Programming",
      description: "Learn basic programming concepts.",
      _csrf: csrfToken
    });
    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty("message", "Course created successfully!");
  });
  test("Educator creates a lesson", async () => {
    res = await agent.get("/csrf-token");
    csrfToken = res.body.csrfToken;
    const response = await agent.post("/api/lessons/").send({
      courseId: 1,
      title: "Introduction to computing and problem solving",
      _csrf: csrfToken
    });
    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty("message","Lesson created successfully");
  });

  test("Educator creates a page", async () => {
    res = await agent.get("/csrf-token");
    csrfToken = res.body.csrfToken;
    const response = await agent.post("/api/pages/").send({
      lessonId: 1,
      title: "Introduction to computers",
      content: "A computer is defined as 'A computer is a programmable machine that receives input, stores and manipulates data, and provides output in a useful format.' ",
      _csrf: csrfToken
    });
    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty("message","Page created successfully");
  });

  test("Student enrolls in a course", async () => {
    // Fetch CSRF token
    let res = await agent.get("/csrf-token");
    let csrfToken = res.body.csrfToken;
  
    // Login back as student
    res = await agent.post("/api/student/login").send({
      email: "john@example.com",
      password: "securepassword",
      _csrf: csrfToken,
    });
  
    expect(res.statusCode).toBe(200); // Ensure login was successful
  
    // Fetch CSRF token again after login
    res = await agent.get("/csrf-token");
    csrfToken = res.body.csrfToken;
  
    // Fetch CSRF token again before enrollment
    res = await agent.get("/csrf-token");
    csrfToken = res.body.csrfToken;
  
    // Enroll the student in the course
    const response = await agent.post("/api/enroll").send({
      userId: 1,
      courseId: 1,
      _csrf: csrfToken,
    });
  
    // Validate the response
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("message", "Enrollment successful!");
  });

  test("Student marks a page as completed", async () => {
    res = await agent.get("/csrf-token");
    csrfToken = res.body.csrfToken;

    const response = await agent.post("/api/progress/track").send({
      userId: 1,
      courseId: 1, 
      lessonId: 1, 
      pageId: 1, 
      isCompleted: true,
      _csrf: csrfToken
    });
    
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("message", "Progress updated successfully");
  });

  test("should allow a student to rate and review a course", async () => {
    let res = await agent.get("/csrf-token");
    let csrfToken = res.body.csrfToken;

      const response = await agent
        .post("/api/reviews/")
        .send({
          userId:1,
          courseId:1,
          rating: 5,
          comment: "Amazing course!",
          _csrf: csrfToken
        });
  
        expect(response.statusCode).toBe(201);
        expect(response.body).toHaveProperty("message", "Review submitted!");
    });
  
    test("should allow a student to post a doubt", async () => {
      res = await agent.get("/csrf-token");
      csrfToken = res.body.csrfToken;
  
      const response = await agent.post("/api/doubts/ask").send({
        userId: 1,
        courseId: 1, 
        lessonId: 1, 
        pageId: 1, 
        questionText: "What is a compiler?",
        _csrf: csrfToken
      });
      
      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveProperty("message", "Doubt posted successfully.");
    });

    test("should allow an educator to respond to a doubt", async () => {
      res = await agent.get("/csrf-token");
      csrfToken = res.body.csrfToken;
  
      const response = await agent.put("/api/doubts/answer/1").send({
        answerText: "A compiler translates an entire programming code into byte code before execution,creating an executable file.",
        _csrf: csrfToken
      });
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty("message", "Doubt answered successfully.");
    });

    test("should allow certificate generation upon completion", async () => {
      const res = await agent.get("/csrf-token"); 
      const csrfToken = res.body.csrfToken;
    
      await agent.post("/api/educator/login").send({
        email: "alice@edu.com",
        password: "educatorpass",
        _csrf: csrfToken
      });

      res = await agent.get("/csrf-token");
      csrfToken = res.body.csrfToken;
  
      const response = await agent.post("/api/certificates/generate").send({
        userId: 1,
        courseId: 1, 
        score: 100,
        _csrf: csrfToken
      });
      
      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveProperty("message", "Certificate generated successfully!");
    });

  // describe("Course Completion and Certification", () => {
  //   it("should mark a course as completed when all pages are done", async () => {
  //     const res = await request(app)
  //       .get(`/courses/${courseId}/status`)
  //       .set("Authorization", `Bearer ${studentToken}`);
  
  //     expect(res.statusCode).toBe(200);
  //     expect(res.body).toHaveProperty("completed", true);
  //   });
  
  //   it("should allow certificate download upon completion", async () => {
  //     const res = await request(app)
  //       .get(`/courses/${courseId}/certificate`)
  //       .set("Authorization", `Bearer ${studentToken}`);
  
  //     expect(res.statusCode).toBe(200);
  //     expect(res.headers["content-type"]).toContain("application/pdf");
  //   });
  // });
  
 });
