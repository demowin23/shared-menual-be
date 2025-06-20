# Projects API

A Node.js REST API for managing projects with images, areas, and HTML content.

## Features

- CRUD operations for projects
- Multiple image upload support (up to 20 images)
- Area/category filtering (with recursive children)
- PostgreSQL database integration

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database
- Yarn package manager

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   yarn install
   ```
3. Create a `.env` file in the root directory with the following variables:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=your_username
   DB_PASSWORD=your_password
   DB_NAME=your_database
   PORT=4000
   UPLOAD_PATH=uploads
   ```
4. Create the database and run the schema:
   ```bash
   psql -U your_username -d your_database -f src/database/schema.sql
   ```
5. Start the server:
   ```bash
   # Development mode
   yarn dev
   # Production mode
   yarn start
   ```

## API Endpoints

### GET /api/projects

- Get all projects
- Optional query param: `areas` (area id, will include all children recursively)
- Example: `/api/projects?areas=1`

### GET /api/projects/:id

- Get a single project by ID

### POST /api/projects

- Create a new project
- Body: multipart/form-data
  - name: string (required)
  - areas: string (area id, required)
  - detail: string (optional, can contain HTML)
  - images: file[] (optional, up to 20 files)

### PUT /api/projects/:id

- Update a project
- Body: multipart/form-data
  - name: string (optional)
  - areas: string (area id, optional)
  - detail: string (optional)
  - images: file[] (optional, up to 20 files)

### DELETE /api/projects/:id

- Delete a project and its associated images

## File Structure

```
.
├── src/
│   ├── config/
│   │   └── db.js
│   │
│   ├── routes/
│   │   └── projects.js
│   │
│   ├── database/
│   │   └── schema.sql
│   │
│   └── index.js
│
├── uploads/
│
├── .env
│
├── package.json
│
├── README.md
```
