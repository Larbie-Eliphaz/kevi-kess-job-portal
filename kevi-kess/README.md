# Kevi Kess Staffing – Node/Express + MongoDB

## Setup
1. Install Node 18+ and MongoDB (local or hosted).
2. In this folder:
   ```
   npm install
   ```
3. Copy `.env.example` to `.env`. Set a strong, unique `ADMIN_PASSWORD` and configure `MONGODB_URI`.
4. Start MongoDB (`mongod`, or the MongoDB service), then:
   ```
   npm start
   ```
5. Open http://localhost:3000 (website), http://localhost:3000/portal (jobs and accounts), and http://localhost:3000/admin (admin dashboard). Sign in to the dashboard with `ADMIN_USER` and `ADMIN_PASSWORD` from `.env`.

Use HTTPS in production; session cookies are marked `Secure` when `NODE_ENV=production`. Set `TRUST_PROXY=1` only when deployed behind a trusted reverse proxy.

## What gets saved (database `kevi_kess`)
| Form | Endpoint | Collection |
|------|----------|------------|
| "I'm looking for a job" | `POST /api/candidates` | `candidates` |
| "I need workers" | `POST /api/employers` | `employers` |

Each record stores the form fields, `status`, admin `notes`, `createdAt/updatedAt`, and the submitter's IP and user agent.

## Candidate and employer portal
- Candidate and employer accounts register with an email and password (minimum 10 characters). Passwords are stored as scrypt hashes; sessions use random, hashed, expiring tokens in HttpOnly cookies.
- Candidates can maintain their profile, search and filter open jobs, apply once per job, track application status, and withdraw applications.
- Employers can maintain company profiles, post/open/close jobs, view applicants and candidate profiles, and update application status.
- Both account types can see in-app notifications for application events. No email delivery service is required.
- Register and sign-in endpoints have a separate rate limit of 10 requests per 15 minutes per IP. Public enquiry forms retain their 15-per-15-minute limit.

## Marketplace API
- `POST /api/auth/register` – `{ "email", "password", "role": "candidate"|"employer", "fullName"|"companyName", "phone" }`
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `PATCH /api/auth/profile`, `PATCH /api/auth/password` – update account details or change the password
- `GET /api/jobs?q=&location=&sector=&type=&page=&limit=` and `GET /api/jobs/:id`
- Candidate: `POST /api/jobs/:id/applications`, `GET /api/candidate/applications`, `PATCH /api/candidate/applications/:id` (withdraw)
- Employer: `GET|POST /api/employer/jobs`, `PATCH|DELETE /api/employer/jobs/:id`, `GET /api/employer/jobs/:jobId/applications`, `PATCH /api/employer/applications/:id`
- Notifications: `GET /api/notifications`, `PATCH /api/notifications/:id/read`

Job applications are retained when a job closes. A job with applications cannot be deleted, preserving its history. Each account can access only its own profile, jobs, applications, and notifications.

## Admin (session sign-in, credentials from `.env`)
- `GET /admin` – live dashboard for candidate/employer enquiries, marketplace accounts, jobs, and applications; refreshes database data every 30 seconds.
- `GET /admin/login` – admin sign-in page
- `POST /api/admin/login` – `{ "username": "...", "password": "..." }`; creates an eight-hour HttpOnly session.
- `POST /api/admin/logout` – revoke the current session and sign out.
- `GET /api/admin/stats` – enquiry counts, candidate/employer account counts, jobs, open jobs, and applications.
- `GET /api/admin/candidates|employers?status=&q=&page=&limit=`
- `GET /api/admin/accounts?role=&q=&page=&limit=`
- `GET /api/admin/jobs?status=&q=&page=&limit=`
- `PATCH /api/admin/jobs/:id` – `{ "status": "open"|"closed" }`
- `GET /api/admin/applications?status=&page=&limit=`
- `PATCH /api/admin/applications/:id` – `{ "status": "..." }`
- `PATCH /api/admin/candidates|employers/:id` – `{ "status": "...", "notes": "..." }`
- `DELETE /api/admin/candidates|employers/:id`

## Other
- `GET /health` – server and DB status
- Public form endpoints are rate limited to 15 requests per 15 minutes per IP.
- Inspect data directly: `mongosh kevi_kess` then `db.candidates.find()`.
