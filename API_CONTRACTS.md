# API Contracts — Library Management System

Base URL: `/api/v1`

---

## Table of Contents

1. [Auth](#1-auth)
2. [Users](#2-users)
3. [Books](#3-books)
4. [Loans](#4-loans)
5. [Genres](#5-genres)

---

## 1. Auth

### POST /api/v1/auth/register

Register a new user account. All new accounts are assigned the `member` role.

**Request Body**

| Field       | Type   | Required | Constraints                  |
|-------------|--------|----------|------------------------------|
| firstName   | string | Yes      | 1–100 characters             |
| lastName    | string | Yes      | 1–100 characters             |
| email       | string | Yes      | Valid email format           |
| password    | string | Yes      | Minimum 8 characters         |

**Example Request Body**
```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "password": "securepass123"
}
```

**Responses**

| Status | Description              |
|--------|--------------------------|
| 201    | User registered          |
| 400    | Validation error         |
| 409    | Email already registered |

**Example Success Response (201)**
```json
{
  "data": {
    "token": "<jwt>",
    "user": {
      "id": 1,
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "jane@example.com",
      "role": "member"
    }
  },
  "meta": {}
}
```

---

### POST /api/v1/auth/login

Authenticate an existing user and receive a JWT token.

**Request Body**

| Field    | Type   | Required |
|----------|--------|----------|
| email    | string | Yes      |
| password | string | Yes      |

**Example Request Body**
```json
{
  "email": "jane@example.com",
  "password": "securepass123"
}
```

**Responses**

| Status | Description        |
|--------|--------------------|
| 200    | Login successful   |
| 400    | Validation error   |
| 401    | Invalid credentials|

**Example Success Response (200)**
```json
{
  "data": {
    "token": "<jwt>",
    "expiresIn": 86400
  },
  "meta": {}
}
```

---

## 2. Users

All `/users` routes require a valid `Authorization: Bearer <token>` header unless noted otherwise.

---

### GET /api/v1/users

Retrieve a paginated list of all users.

**Authorization:** Admin only

**Query Parameters**

| Parameter | Type    | Required | Description                          |
|-----------|---------|----------|--------------------------------------|
| page      | integer | No       | Page number (default: 1)             |
| limit     | integer | No       | Results per page, max 100 (default: 20) |
| role      | string  | No       | Filter by role: `member` or `admin`  |

**Responses**

| Status | Description       |
|--------|-------------------|
| 200    | Success           |
| 401    | Unauthenticated   |
| 403    | Forbidden         |

**Example Success Response (200)**
```json
{
  "data": [
    {
      "id": 1,
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "jane@example.com",
      "role": "member",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### GET /api/v1/users/:id

Retrieve a single user's profile.

**Authorization:** Admin (any user); Member (own profile only)

**URL Parameters**

| Parameter | Type    | Description |
|-----------|---------|-------------|
| id        | integer | User ID     |

**Responses**

| Status | Description          |
|--------|----------------------|
| 200    | Success              |
| 401    | Unauthenticated      |
| 403    | Forbidden            |
| 404    | User not found       |

**Example Success Response (200)**
```json
{
  "data": {
    "id": 1,
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com",
    "role": "member",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  },
  "meta": {}
}
```

---

### PATCH /api/v1/users/:id

Partially update a user's profile. Only provided fields are updated.

**Authorization:** Admin (any user, can change roles); Member (own profile only, cannot change role)

**URL Parameters**

| Parameter | Type    | Description |
|-----------|---------|-------------|
| id        | integer | User ID     |

**Request Body** (all fields optional)

| Field     | Type   | Constraints                            |
|-----------|--------|----------------------------------------|
| firstName | string | 1–100 characters                       |
| lastName  | string | 1–100 characters                       |
| email     | string | Valid email, must be unique            |
| password  | string | Minimum 8 characters                   |
| role      | string | `member` or `admin` — admin only       |

**Example Request Body**
```json
{
  "firstName": "Janet"
}
```

**Responses**

| Status | Description          |
|--------|----------------------|
| 200    | User updated         |
| 400    | Validation error     |
| 401    | Unauthenticated      |
| 403    | Forbidden            |
| 404    | User not found       |
| 409    | Email already taken  |

**Example Success Response (200)**
```json
{
  "data": {
    "id": 1,
    "firstName": "Janet",
    "lastName": "Doe",
    "email": "jane@example.com",
    "role": "member",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-06-01T12:00:00.000Z"
  },
  "meta": {}
}
```

---

### DELETE /api/v1/users/:id

Delete a user account. Users with active loans cannot be deleted.

**Authorization:** Admin only

**URL Parameters**

| Parameter | Type    | Description |
|-----------|---------|-------------|
| id        | integer | User ID     |

**Responses**

| Status | Description                        |
|--------|------------------------------------|
| 204    | User deleted                       |
| 401    | Unauthenticated                    |
| 403    | Forbidden                          |
| 404    | User not found                     |
| 409    | User has active loans              |

---

### GET /api/v1/users/:id/loans

Retrieve a paginated list of loans belonging to a specific user.

**Authorization:** Admin (any user); Member (own loans only)

**URL Parameters**

| Parameter | Type    | Description |
|-----------|---------|-------------|
| id        | integer | User ID     |

**Query Parameters**

| Parameter | Type    | Required | Description                                        |
|-----------|---------|----------|----------------------------------------------------|
| page      | integer | No       | Page number (default: 1)                           |
| limit     | integer | No       | Results per page, max 100 (default: 20)            |
| status    | string  | No       | Filter by status: `active`, `returned`, `overdue`  |

**Responses**

| Status | Description    |
|--------|----------------|
| 200    | Success        |
| 401    | Unauthenticated|
| 403    | Forbidden      |
| 404    | User not found |

**Example Success Response (200)**
```json
{
  "data": [
    {
      "id": 3,
      "userId": 1,
      "bookId": 5,
      "borrowedAt": "2025-06-01T10:00:00.000Z",
      "dueDate": "2025-06-15T10:00:00.000Z",
      "returnedAt": null,
      "status": "active",
      "createdAt": "2025-06-01T10:00:00.000Z",
      "updatedAt": "2025-06-01T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

## 3. Books

Public GET routes require no authentication. Write operations require authentication.

---

### GET /api/v1/books

Retrieve a paginated, filterable list of books.

**Authorization:** Public

**Query Parameters**

| Parameter | Type    | Required | Description                                         |
|-----------|---------|----------|-----------------------------------------------------|
| page      | integer | No       | Page number (default: 1)                            |
| limit     | integer | No       | Results per page, max 100 (default: 20)             |
| title     | string  | No       | Filter by title (partial match)                     |
| author    | string  | No       | Filter by author (partial match)                    |
| genre     | string  | No       | Filter by genre name (partial match)                |
| available | boolean | No       | If `true`, only return books with available copies  |
| sort      | string  | No       | Sort field: `title`, `author`, `publishedYear`, `createdAt`. Prefix with `-` for descending (e.g., `-title`) |

**Responses**

| Status | Description |
|--------|-------------|
| 200    | Success     |

**Example Success Response (200)**
```json
{
  "data": [
    {
      "id": 1,
      "title": "The Great Gatsby",
      "author": "F. Scott Fitzgerald",
      "isbn": "9780743273565",
      "genreId": 2,
      "genre": "Fiction",
      "totalCopies": 3,
      "availableCopies": 2,
      "publishedYear": 1925,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### GET /api/v1/books/:id

Retrieve a single book by ID.

**Authorization:** Public

**URL Parameters**

| Parameter | Type    | Description |
|-----------|---------|-------------|
| id        | integer | Book ID     |

**Responses**

| Status | Description    |
|--------|----------------|
| 200    | Success        |
| 404    | Book not found |

**Example Success Response (200)**
```json
{
  "data": {
    "id": 1,
    "title": "The Great Gatsby",
    "author": "F. Scott Fitzgerald",
    "isbn": "9780743273565",
    "genreId": 2,
    "genre": "Fiction",
    "totalCopies": 3,
    "availableCopies": 2,
    "publishedYear": 1925,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  },
  "meta": {}
}
```

---

### POST /api/v1/books

Add a new book to the library.

**Authorization:** Admin only

**Request Body**

| Field         | Type    | Required | Constraints                    |
|---------------|---------|----------|--------------------------------|
| title         | string  | Yes      | 1–255 characters               |
| author        | string  | Yes      | 1–255 characters               |
| isbn          | string  | Yes      | Must be unique                 |
| genreId       | integer | Yes      | Must reference an existing genre|
| totalCopies   | integer | Yes      | Minimum 1                      |
| publishedYear | integer | No       | 4-digit year (1000–9999)       |

**Example Request Body**
```json
{
  "title": "The Great Gatsby",
  "author": "F. Scott Fitzgerald",
  "isbn": "9780743273565",
  "genreId": 2,
  "totalCopies": 3,
  "publishedYear": 1925
}
```

**Responses**

| Status | Description         |
|--------|---------------------|
| 201    | Book created        |
| 400    | Validation error    |
| 401    | Unauthenticated     |
| 403    | Forbidden           |
| 404    | Genre not found     |
| 409    | ISBN already exists |

---

### PATCH /api/v1/books/:id

Partially update a book's details. Only provided fields are updated.

**Authorization:** Admin only

**URL Parameters**

| Parameter | Type    | Description |
|-----------|---------|-------------|
| id        | integer | Book ID     |

**Request Body** (all fields optional)

| Field         | Type    | Constraints                                             |
|---------------|---------|---------------------------------------------------------|
| title         | string  | 1–255 characters                                        |
| author        | string  | 1–255 characters                                        |
| genreId       | integer | Must reference an existing genre                        |
| totalCopies   | integer | Minimum 1; cannot be less than currently borrowed count |
| publishedYear | integer | 4-digit year (1000–9999), or `null` to clear            |

**Example Request Body**
```json
{
  "totalCopies": 5
}
```

**Responses**

| Status | Description      |
|--------|------------------|
| 200    | Book updated     |
| 400    | Validation error |
| 401    | Unauthenticated  |
| 403    | Forbidden        |
| 404    | Book/genre not found |

---

### DELETE /api/v1/books/:id

Delete a book. Books with active loans cannot be deleted.

**Authorization:** Admin only

**URL Parameters**

| Parameter | Type    | Description |
|-----------|---------|-------------|
| id        | integer | Book ID     |

**Responses**

| Status | Description                  |
|--------|------------------------------|
| 204    | Book deleted                 |
| 401    | Unauthenticated              |
| 403    | Forbidden                    |
| 404    | Book not found               |
| 409    | Book has active loans        |

---

## 4. Loans

All `/loans` routes require authentication.

---

### GET /api/v1/loans

Retrieve a paginated list of loans. Admins see all loans; members see only their own.

**Authorization:** Authenticated (member sees own; admin sees all)

**Query Parameters**

| Parameter | Type    | Required | Description                                        |
|-----------|---------|----------|----------------------------------------------------|
| page      | integer | No       | Page number (default: 1)                           |
| limit     | integer | No       | Results per page, max 100 (default: 20)            |
| status    | string  | No       | Filter by status: `active`, `returned`, `overdue`  |

**Responses**

| Status | Description    |
|--------|----------------|
| 200    | Success        |
| 401    | Unauthenticated|

**Example Success Response (200)**
```json
{
  "data": [
    {
      "id": 1,
      "userId": 2,
      "bookId": 1,
      "borrowedAt": "2025-06-01T10:00:00.000Z",
      "dueDate": "2025-06-15T10:00:00.000Z",
      "returnedAt": null,
      "status": "active",
      "createdAt": "2025-06-01T10:00:00.000Z",
      "updatedAt": "2025-06-01T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### POST /api/v1/loans

Borrow a book. Creates a new loan for the authenticated user with a 14-day due date. Automatically decrements the book's available copies.

**Authorization:** Authenticated (any role)

**Request Body**

| Field  | Type    | Required | Constraints                   |
|--------|---------|----------|-------------------------------|
| bookId | integer | Yes      | Must reference an existing book|

**Example Request Body**
```json
{
  "bookId": 1
}
```

**Responses**

| Status | Description              |
|--------|--------------------------|
| 201    | Loan created             |
| 400    | Validation error         |
| 401    | Unauthenticated          |
| 404    | Book not found           |
| 409    | No copies available      |

**Example Success Response (201)**
```json
{
  "data": {
    "id": 1,
    "userId": 2,
    "bookId": 1,
    "borrowedAt": "2025-06-01T10:00:00.000Z",
    "dueDate": "2025-06-15T10:00:00.000Z",
    "returnedAt": null,
    "status": "active",
    "createdAt": "2025-06-01T10:00:00.000Z",
    "updatedAt": "2025-06-01T10:00:00.000Z"
  },
  "meta": {}
}
```

---

### PATCH /api/v1/loans/:id

Return a borrowed book. Sets `returnedAt`, updates status to `returned`, and increments the book's available copies.

**Authorization:** Admin (any loan); Member (own loans only)

**URL Parameters**

| Parameter | Type    | Description |
|-----------|---------|-------------|
| id        | integer | Loan ID     |

**Request Body**

| Field    | Type    | Required | Constraints       |
|----------|---------|----------|-------------------|
| returned | boolean | Yes      | Must be `true`    |

**Example Request Body**
```json
{
  "returned": true
}
```

**Responses**

| Status | Description              |
|--------|--------------------------|
| 200    | Book returned            |
| 400    | Validation error / already returned |
| 401    | Unauthenticated          |
| 403    | Forbidden                |
| 404    | Loan not found           |

**Example Success Response (200)**
```json
{
  "data": {
    "id": 1,
    "userId": 2,
    "bookId": 1,
    "borrowedAt": "2025-06-01T10:00:00.000Z",
    "dueDate": "2025-06-15T10:00:00.000Z",
    "returnedAt": "2025-06-10T09:00:00.000Z",
    "status": "returned",
    "createdAt": "2025-06-01T10:00:00.000Z",
    "updatedAt": "2025-06-10T09:00:00.000Z"
  },
  "meta": {}
}
```

---

## 5. Genres

Public GET requires no authentication. Write operations require admin.

---

### GET /api/v1/genres

Retrieve a full list of all genres, ordered alphabetically.

**Authorization:** Public

**Responses**

| Status | Description |
|--------|-------------|
| 200    | Success     |

**Example Success Response (200)**
```json
{
  "data": [
    { "id": 1, "name": "Biography", "createdAt": "2025-01-01T00:00:00.000Z" },
    { "id": 2, "name": "Fiction", "createdAt": "2025-01-01T00:00:00.000Z" }
  ],
  "meta": { "total": 2 }
}
```

---

### POST /api/v1/genres

Create a new genre.

**Authorization:** Admin only

**Request Body**

| Field | Type   | Required | Constraints                  |
|-------|--------|----------|------------------------------|
| name  | string | Yes      | 1–100 characters, must be unique |

**Example Request Body**
```json
{
  "name": "Science Fiction"
}
```

**Responses**

| Status | Description              |
|--------|--------------------------|
| 201    | Genre created            |
| 400    | Validation error         |
| 401    | Unauthenticated          |
| 403    | Forbidden                |
| 409    | Genre name already exists|

**Example Success Response (201)**
```json
{
  "data": {
    "id": 3,
    "name": "Science Fiction",
    "createdAt": "2025-06-01T10:00:00.000Z"
  },
  "meta": {}
}
```

---

### PUT /api/v1/genres/:id

Fully replace a genre's name.

**Authorization:** Admin only

**URL Parameters**

| Parameter | Type    | Description |
|-----------|---------|-------------|
| id        | integer | Genre ID    |

**Request Body**

| Field | Type   | Required | Constraints                  |
|-------|--------|----------|------------------------------|
| name  | string | Yes      | 1–100 characters, must be unique |

**Example Request Body**
```json
{
  "name": "Sci-Fi"
}
```

**Responses**

| Status | Description               |
|--------|---------------------------|
| 200    | Genre updated             |
| 400    | Validation error          |
| 401    | Unauthenticated           |
| 403    | Forbidden                 |
| 404    | Genre not found           |
| 409    | Genre name already exists |

**Example Success Response (200)**
```json
{
  "data": {
    "id": 3,
    "name": "Sci-Fi",
    "createdAt": "2025-06-01T10:00:00.000Z"
  },
  "meta": {}
}
```

---

### DELETE /api/v1/genres/:id

Delete a genre. Genres assigned to books cannot be deleted.

**Authorization:** Admin only

**URL Parameters**

| Parameter | Type    | Description |
|-----------|---------|-------------|
| id        | integer | Genre ID    |

**Responses**

| Status | Description                          |
|--------|--------------------------------------|
| 204    | Genre deleted                        |
| 401    | Unauthenticated                      |
| 403    | Forbidden                            |
| 404    | Genre not found                      |
| 409    | Genre is in use by one or more books |

---

## Error Response Format

All error responses follow this structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": [
      { "field": "fieldName", "message": "Specific issue" }
    ]
  }
}
```

`details` is only included for `VALIDATION_ERROR` responses.

### Error Codes

| Code             | HTTP Status | Description                        |
|------------------|-------------|------------------------------------|
| VALIDATION_ERROR | 400         | Invalid or missing input fields    |
| UNAUTHORIZED     | 401         | Missing, invalid, or expired token |
| FORBIDDEN        | 403         | Insufficient role permissions      |
| NOT_FOUND        | 404         | Resource does not exist            |
| CONFLICT         | 409         | Uniqueness or business rule violation |
