const express = require('express');
const { query, isValidId } = require('../db');
const {
  APPLICATION_STATUSES,
  CANDIDATE_STATUSES,
  EMPLOYER_STATUSES,
  JOB_STATUSES
} = require('../constants');

const router = express.Router();

const ENQUIRIES = {
  candidates: {
    table: 'Candidates',
    statuses: CANDIDATE_STATUSES,
    columns: 'Id AS _id, Name AS name, Phone AS phone, Role AS role, Experience AS experience, Status AS status, Notes AS notes, Ip AS ip, UserAgent AS userAgent, CreatedAt AS createdAt, UpdatedAt AS updatedAt',
    search: ['Name', 'Phone', 'Role', 'Experience']
  },
  employers: {
    table: 'Employers',
    statuses: EMPLOYER_STATUSES,
    columns: 'Id AS _id, Company AS company, Phone AS phone, Role AS role, [Count] AS count, Details AS details, Status AS status, Notes AS notes, Ip AS ip, UserAgent AS userAgent, CreatedAt AS createdAt, UpdatedAt AS updatedAt',
    search: ['Company', 'Phone', 'Role', 'Details']
  }
};

function pageOptions(req) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  return { page, limit, offset: (page - 1) * limit };
}

function safeSearch(value) {
  return `%${value.replace(/[\[\]%_]/g, (character) => `[${character}]`)}%`;
}

function enquiryResult(row) {
  const { ip, userAgent, ...item } = row;
  return { ...item, meta: { ip, userAgent } };
}

function addSearchCondition(where, params, fields, value) {
  if (typeof value !== 'string' || !value.trim()) return;
  params.q = safeSearch(value.trim());
  where.push(`(${fields.map((field) => `${field} LIKE @q`).join(' OR ')})`);
}

for (const [path, config] of Object.entries(ENQUIRIES)) {
  router.get(`/${path}`, async (req, res, next) => {
    try {
      const { page, limit, offset } = pageOptions(req);
      const where = [];
      const params = { offset, limit };
      if (config.statuses.includes(req.query.status)) {
        where.push('Status = @status');
        params.status = req.query.status;
      }
      addSearchCondition(where, params, config.search, req.query.q);
      const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const [items, count] = await Promise.all([
        query(`
          SELECT ${config.columns} FROM dbo.${config.table}
          ${clause} ORDER BY CreatedAt DESC
          OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `, params),
        query(`SELECT COUNT_BIG(*) AS total FROM dbo.${config.table} ${clause}`, params)
      ]);
      const total = Number(count.recordset[0].total);
      res.json({
        items: items.recordset.map(enquiryResult),
        total,
        page,
        pages: Math.ceil(total / limit),
        statuses: config.statuses
      });
    } catch (err) { next(err); }
  });

  router.patch(`/${path}/:id`, async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return res.status(400).json({ error: 'Invalid id.' });
      const updates = [];
      const params = { id };
      if (typeof req.body.status === 'string' && config.statuses.includes(req.body.status)) {
        updates.push('Status = @status');
        params.status = req.body.status;
      }
      if (typeof req.body.notes === 'string') {
        updates.push('Notes = @notes');
        params.notes = req.body.notes.slice(0, 2000);
      }
      if (!updates.length) return res.status(400).json({ error: 'Nothing to update.' });
      const updated = await query(`
        UPDATE dbo.${config.table}
        SET ${updates.join(', ')}, UpdatedAt = SYSUTCDATETIME()
        WHERE Id = @id
      `, params);
      if (!updated.rowsAffected[0]) return res.status(404).json({ error: 'Not found.' });
      const result = await query(`SELECT ${config.columns} FROM dbo.${config.table} WHERE Id = @id`, { id });
      res.json(enquiryResult(result.recordset[0]));
    } catch (err) { next(err); }
  });

  router.delete(`/${path}/:id`, async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return res.status(400).json({ error: 'Invalid id.' });
      const deleted = await query(`DELETE FROM dbo.${config.table} WHERE Id = @id`, { id });
      if (!deleted.rowsAffected[0]) return res.status(404).json({ error: 'Not found.' });
      res.json({ success: true });
    } catch (err) { next(err); }
  });
}

router.get('/accounts', async (req, res, next) => {
  try {
    const { page, limit, offset } = pageOptions(req);
    const where = [];
    const params = { offset, limit };
    if (['candidate', 'employer'].includes(req.query.role)) {
      where.push('Role = @role');
      params.role = req.query.role;
    }
    addSearchCondition(where, params, ['Email', 'FullName', 'CompanyName', 'Phone', 'Location'], req.query.q);
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [items, count] = await Promise.all([
      query(`
        SELECT Id AS _id, Email AS email, Role AS role, FullName AS fullName,
          Phone AS phone, Location AS location, CompanyName AS companyName, CreatedAt AS createdAt
        FROM dbo.Accounts ${clause}
        ORDER BY CreatedAt DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `, params),
      query(`SELECT COUNT_BIG(*) AS total FROM dbo.Accounts ${clause}`, params)
    ]);
    const total = Number(count.recordset[0].total);
    res.json({ items: items.recordset, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

router.get('/jobs', async (req, res, next) => {
  try {
    const { page, limit, offset } = pageOptions(req);
    const where = [];
    const params = { offset, limit };
    if (JOB_STATUSES.includes(req.query.status)) {
      where.push('j.Status = @status');
      params.status = req.query.status;
    }
    addSearchCondition(where, params, ['j.Title', 'j.Sector', 'j.Location', 'j.Description'], req.query.q);
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [items, count] = await Promise.all([
      query(`
        SELECT j.Id AS _id, j.EmployerId AS employerId, j.Title AS title, j.Sector AS sector,
          j.Location AS location, j.EmploymentType AS employmentType, j.Salary AS salary,
          j.Description AS description, j.Requirements AS requirements, j.Status AS status,
          j.CreatedAt AS createdAt, j.UpdatedAt AS updatedAt,
          a.CompanyName AS employerCompanyName, a.Email AS employerEmail
        FROM dbo.Jobs j
        INNER JOIN dbo.Accounts a ON a.Id = j.EmployerId
        ${clause} ORDER BY j.CreatedAt DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `, params),
      query(`SELECT COUNT_BIG(*) AS total FROM dbo.Jobs j ${clause}`, params)
    ]);
    const total = Number(count.recordset[0].total);
    const result = items.recordset.map(({ employerId, employerCompanyName, employerEmail, ...job }) => ({
      ...job,
      employer: { _id: employerId, companyName: employerCompanyName, email: employerEmail }
    }));
    res.json({ items: result, total, page, pages: Math.ceil(total / limit), statuses: JOB_STATUSES });
  } catch (err) { next(err); }
});

router.patch('/jobs/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const status = req.body && req.body.status;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid id.' });
    if (!JOB_STATUSES.includes(status)) return res.status(400).json({ error: 'Choose open or closed status.' });
    const result = await query(`
      UPDATE dbo.Jobs SET Status = @status, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id
    `, { id, status });
    if (!result.rowsAffected[0]) return res.status(404).json({ error: 'Not found.' });
    const updated = await query(`
      SELECT Id AS _id, EmployerId AS employer, Title AS title, Sector AS sector,
        Location AS location, EmploymentType AS employmentType, Salary AS salary,
        Description AS description, Requirements AS requirements, Status AS status,
        CreatedAt AS createdAt, UpdatedAt AS updatedAt
      FROM dbo.Jobs WHERE Id = @id
    `, { id });
    res.json(updated.recordset[0]);
  } catch (err) { next(err); }
});

router.get('/applications', async (req, res, next) => {
  try {
    const { page, limit, offset } = pageOptions(req);
    const params = { offset, limit };
    const clause = APPLICATION_STATUSES.includes(req.query.status) ? 'WHERE ap.Status = @status' : '';
    if (clause) params.status = req.query.status;
    const [items, count] = await Promise.all([
      query(`
        SELECT ap.Id AS _id, ap.JobId AS jobId, ap.CandidateId AS candidateId,
          ap.EmployerId AS employerId, ap.CoverLetter AS coverLetter, ap.Status AS status,
          ap.CreatedAt AS createdAt, ap.UpdatedAt AS updatedAt,
          j.Title AS jobTitle, c.Email AS candidateEmail, c.FullName AS candidateFullName,
          e.Email AS employerEmail, e.CompanyName AS employerCompanyName
        FROM dbo.Applications ap
        INNER JOIN dbo.Jobs j ON j.Id = ap.JobId
        INNER JOIN dbo.Accounts c ON c.Id = ap.CandidateId
        INNER JOIN dbo.Accounts e ON e.Id = ap.EmployerId
        ${clause} ORDER BY ap.CreatedAt DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `, params),
      query(`SELECT COUNT_BIG(*) AS total FROM dbo.Applications ap ${clause}`, params)
    ]);
    const total = Number(count.recordset[0].total);
    const result = items.recordset.map((row) => ({
      _id: row._id,
      coverLetter: row.coverLetter,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      job: { _id: row.jobId, title: row.jobTitle },
      candidate: { _id: row.candidateId, email: row.candidateEmail, fullName: row.candidateFullName },
      employer: { _id: row.employerId, email: row.employerEmail, companyName: row.employerCompanyName }
    }));
    res.json({
      items: result,
      total,
      page,
      pages: Math.ceil(total / limit),
      statuses: APPLICATION_STATUSES
    });
  } catch (err) { next(err); }
});

router.patch('/applications/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const status = req.body && req.body.status;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid id.' });
    if (!APPLICATION_STATUSES.includes(status)) return res.status(400).json({ error: 'Choose a valid application status.' });
    const result = await query(`
      UPDATE dbo.Applications SET Status = @status, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id
    `, { id, status });
    if (!result.rowsAffected[0]) return res.status(404).json({ error: 'Not found.' });
    const updated = await query(`
      SELECT Id AS _id, JobId AS job, CandidateId AS candidate, EmployerId AS employer,
        CoverLetter AS coverLetter, Status AS status, CreatedAt AS createdAt, UpdatedAt AS updatedAt
      FROM dbo.Applications WHERE Id = @id
    `, { id });
    res.json(updated.recordset[0]);
  } catch (err) { next(err); }
});

router.get('/stats', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        (SELECT COUNT_BIG(*) FROM dbo.Candidates) AS candidates,
        (SELECT COUNT_BIG(*) FROM dbo.Candidates WHERE Status = N'new') AS newCandidates,
        (SELECT COUNT_BIG(*) FROM dbo.Employers) AS employers,
        (SELECT COUNT_BIG(*) FROM dbo.Employers WHERE Status = N'new') AS newEmployers,
        (SELECT COUNT_BIG(*) FROM dbo.Accounts WHERE Role = N'candidate') AS candidateAccounts,
        (SELECT COUNT_BIG(*) FROM dbo.Accounts WHERE Role = N'employer') AS employerAccounts,
        (SELECT COUNT_BIG(*) FROM dbo.Jobs) AS jobs,
        (SELECT COUNT_BIG(*) FROM dbo.Jobs WHERE Status = N'open') AS openJobs,
        (SELECT COUNT_BIG(*) FROM dbo.Applications) AS applications
    `);
    const stats = result.recordset[0];
    for (const key of Object.keys(stats)) stats[key] = Number(stats[key]);
    res.json(stats);
  } catch (err) { next(err); }
});

module.exports = router;
