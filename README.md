# Learning Management System (LMS)

A full-featured Learning Management System (LMS) for educators and students, built with Node.js, Express, Sequelize, and PostgreSQL. This application allows educators to create courses, lessons, and pages, while students can enroll, track progress, and earn certificates.

---

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
  - [Running the Application](#running-the-application)
- [Usage](#usage)
  - [Educator Features](#educator-features)
  - [Student Features](#student-features)
- [Screenshots](#screenshots)
- [Live Demo](#live-demo)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **User Authentication**: Secure login and registration for students and educators.
- **Educator Dashboard**: Create, edit, and manage courses, lessons, and pages.
- **Student Dashboard**: Enroll in courses, track lesson/page completion, and view progress.
- **Progress Tracking**: Mark pages as completed and monitor course progress.
- **Certificate Generation**: Generate certificates upon course completion.
- **CSRF Protection**: Secure forms with CSRF tokens.
- **Role-based Access**: Separate flows and permissions for educators and students.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [npm](https://www.npmjs.com/)
- [PostgreSQL](https://www.postgresql.org/)