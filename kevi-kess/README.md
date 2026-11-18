# Kevi Kess Resources

The project is split into a React frontend and an Express/Microsoft SQL Server backend:

- `frontend/` contains the Vite/React application.
- `backend/` contains the Express server, SQL queries, database schema, API routes, and authentication middleware.

## Development

1. Install Node.js 18+, Microsoft SQL Server, and ODBC Driver 18 for SQL Server.
2. Run `npm install`.
3. Create an empty database named `kevi_kess` in SQL Server.
4. Copy `.env.example` to `.env` (or update your existing `.env`). Configure `SQL_SERVER`, `SQL_DATABASE`, and optional `SQL_INSTANCE_NAME`; the backend uses Windows integrated authentication for the Windows account running Node. Set `ADMIN_USER` and a strong `ADMIN_PASSWORD`.
5. In one terminal run `npm run dev:backend`.
6. In another terminal run `npm run dev:frontend`.
7. Open the Vite URL shown in the frontend terminal (normally http://localhost:5173).

Vite proxies `/api` requests to the Express server on port 3000. Alternatively, use `npm run build` and `npm start` to serve the built React app from Express at http://localhost:3000.
On startup, the backend creates any missing application tables and indexes. The Windows account running Node must have permission to connect to the database and create these objects. For production SQL Server instances, configure a trusted certificate instead of enabling `SQL_TRUST_SERVER_CERTIFICATE`.
This setup starts with an empty SQL database; it does not copy records from the previous MongoDB database. Existing MongoDB data is left untouched.

## Existing API

The backend API remains available under `/api`. The React portal uses the existing account, job, application, notification, enquiry, and admin endpoints. `GET /health` reports server and SQL Server status.

Public enquiry form endpoints are rate limited to 15 requests per 15 minutes per IP. Account and admin sign-in endpoints have separate limits. In production, use HTTPS; session cookies are marked `Secure` when `NODE_ENV=production`. Set `TRUST_PROXY=1` only when deployed behind a trusted reverse proxy.

## Main pages

- `/` – public website and candidate/employer enquiry forms
- `/portal` – job search, candidate accounts, and employer workspace
- `/admin/login` – admin sign in
- `/admin` – admin dashboard for enquiries and marketplace activity
