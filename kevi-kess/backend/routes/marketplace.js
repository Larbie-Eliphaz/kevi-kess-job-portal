const crypto = require('crypto');
const { promisify } = require('util');
const express = require('express');
const { query, isValidId } = require('../db');
const {
  APPLICATION_STATUSES,
  EMPLOYER_APPLICATION_STATUSES,
  JOB_STATUSES,
  JOB_TYPES,
  SECTORS
} = require('../constants');
const { clearCookie, createSession, getToken, hashToken, requireAuth, requireRole } = require('../middleware/accountAuth');

const router = express.Router();
const scrypt = promisify(crypto.scrypt);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\d\s.-]{7,30}$/;
const str = (value) => typeof value === 'string' ? value.trim() : '';

function publicAccount(account) {
  const { passwordHash, ...data } = account;
  return data;
}

function accountColumns(alias = 'a') {
  return `${alias}.Id AS _id, ${alias}.Email AS email, ${alias}.Role AS role,
    ${alias}.FullName AS fullName, ${alias}.Phone AS phone, ${alias}.Location AS location,
    ${alias}.Skills AS skills, ${alias}.Experience AS experience,
    ${alias}.CompanyName AS companyName, ${alias}.CompanyDescription AS companyDescription,
    ${alias}.CompanyWebsite AS companyWebsite, ${alias}.CreatedAt AS createdAt,
    ${alias}.UpdatedAt AS updatedAt`;
}

function pagination(req, defaultLimit, maxLimit) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || defaultLimit, 1), maxLimit);
  return { page, limit, offset: (page - 1) * limit };
}

function escapeLike(value) {
  return `%${value.replace(/[\[\]%_]/g, (character) => `[${character}]`)}%`;
}

async function passwordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}

async function passwordMatches(password, stored) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = await scrypt(password, salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function validateJob(body) {
  const job = {
    title: str(body.title),
    sector: str(body.sector),
    location: str(body.location),
    employmentType: str(body.employmentType),
    salary: str(body.salary),
    description: str(body.description),
    requirements: str(body.requirements)
  };
  const errors = [];
  if (!job.title) errors.push('Job title is required.');
  if (!SECTORS.includes(job.sector)) errors.push('Choose a valid job sector.');
  if (!job.location) errors.push('Job location is required.');
  if (!JOB_TYPES.includes(job.employmentType)) errors.push('Choose a valid employment type.');
  if (!job.description) errors.push('Job description is required.');
  if (job.title.length > 160 || job.location.length > 160 || job.salary.length > 120 ||
      job.description.length > 5000 || job.requirements.length > 3000) {
    errors.push('One or more job fields exceed the allowed length.');
  }
  return { job, errors };
}

async function notify(accountId, message) {
  await query(`
    INSERT INTO dbo.Notifications (AccountId, Message, Href)
    VALUES (@accountId, @message, @href)
  `, { accountId, message: message.slice(0, 240), href: '/portal#applications' });
}

router.post('/auth/register', async (req, res, next) => {
  try {
    const body = req.body || {};
    const email = str(body.email).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    const role = str(body.role);
    const errors = [];
    if (!EMAIL_RE.test(email) || email.length > 254) errors.push('Enter a valid email address.');
    if (password.length < 10 || password.length > 128) errors.push('Password must be between 10 and 128 characters.');
    if (!['candidate', 'employer'].includes(role)) errors.push('Choose candidate or employer account type.');

    const profile = { fullName: '', phone: '', companyName: '' };
    if (role === 'candidate') {
      profile.fullName = str(body.fullName);
      profile.phone = str(body.phone);
      if (!profile.fullName) errors.push('Full name is required.');
      if (profile.fullName.length > 120) errors.push('Full name must be 120 characters or fewer.');
      if (!PHONE_RE.test(profile.phone)) errors.push('Enter a valid phone number.');
    } else if (role === 'employer') {
      profile.companyName = str(body.companyName);
      profile.phone = str(body.phone);
      if (!profile.companyName) errors.push('Company name is required.');
      if (profile.companyName.length > 160) errors.push('Company name must be 160 characters or fewer.');
      if (!PHONE_RE.test(profile.phone)) errors.push('Enter a valid phone number.');
    }
    if (errors.length) return res.status(400).json({ errors });

    const passwordHashValue = await passwordHash(password);
    const inserted = await query(`
      INSERT INTO dbo.Accounts (Email, PasswordHash, Role, FullName, Phone, CompanyName)
      OUTPUT INSERTED.Id AS _id, INSERTED.Email AS email, INSERTED.Role AS role,
        INSERTED.FullName AS fullName, INSERTED.Phone AS phone,
        INSERTED.CompanyName AS companyName, INSERTED.Location AS location,
        INSERTED.Skills AS skills, INSERTED.Experience AS experience,
        INSERTED.CompanyDescription AS companyDescription, INSERTED.CompanyWebsite AS companyWebsite,
        INSERTED.CreatedAt AS createdAt, INSERTED.UpdatedAt AS updatedAt
      VALUES (@email, @passwordHash, @role, @fullName, @phone, @companyName)
    `, { email, passwordHash: passwordHashValue, role, ...profile });
    const account = inserted.recordset[0];
    await createSession(account, res);
    res.status(201).json({ account });
  } catch (err) {
    if ([2601, 2627].includes(err.number)) return res.status(409).json({ error: 'An account with that email already exists.' });
    next(err);
  }
});

router.post('/auth/login', async (req, res, next) => {
  try {
    const email = str(req.body && req.body.email).toLowerCase();
    const password = req.body && typeof req.body.password === 'string' ? req.body.password : '';
    const result = await query(`
      SELECT ${accountColumns()}, a.PasswordHash AS passwordHash
      FROM dbo.Accounts a WHERE a.Email = @email
    `, { email });
    const account = result.recordset[0];
    if (!account || !(await passwordMatches(password, account.passwordHash))) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    await createSession(account, res);
    res.json({ account: publicAccount(account) });
  } catch (err) {
    next(err);
  }
});

router.post('/auth/logout', async (req, res, next) => {
  try {
    const token = getToken(req);
    if (token) {
      await query('DELETE FROM dbo.Sessions WHERE TokenHash = @tokenHash', {
        tokenHash: hashToken(token)
      });
    }
    clearCookie(res);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/auth/me', requireAuth, (req, res) => res.json({ account: req.account }));

router.patch('/auth/profile', requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const account = req.account;
    const update = {};
    const errors = [];
    if (account.role === 'candidate') {
      for (const field of ['fullName', 'phone', 'location', 'skills', 'experience']) {
        if (body[field] !== undefined) update[field] = str(body[field]);
      }
      if (update.fullName !== undefined && !update.fullName) errors.push('Full name is required.');
      if (update.phone !== undefined && !PHONE_RE.test(update.phone)) errors.push('Enter a valid phone number.');
    } else {
      for (const field of ['companyName', 'phone', 'location', 'companyDescription', 'companyWebsite']) {
        if (body[field] !== undefined) update[field] = str(body[field]);
      }
      if (update.companyWebsite) {
        try {
          const url = new URL(update.companyWebsite);
          if (!['http:', 'https:'].includes(url.protocol)) errors.push('Website must use http or https.');
        } catch {
          errors.push('Enter a valid website URL.');
        }
      }
      if (update.companyName !== undefined && !update.companyName) errors.push('Company name is required.');
      if (update.phone !== undefined && !PHONE_RE.test(update.phone)) errors.push('Enter a valid phone number.');
    }
    const maxLengths = {
      fullName: 120, phone: 30, location: 160, skills: 2000, experience: 3000,
      companyName: 160, companyDescription: 3000, companyWebsite: 300
    };
    for (const [field, value] of Object.entries(update)) {
      if (value.length > maxLengths[field]) errors.push(`${field} must be ${maxLengths[field]} characters or fewer.`);
    }
    if (errors.length) return res.status(400).json({ errors });
    if (!Object.keys(update).length) return res.status(400).json({ error: 'No profile fields to update.' });

    const fieldMap = {
      fullName: 'FullName', phone: 'Phone', location: 'Location', skills: 'Skills',
      experience: 'Experience', companyName: 'CompanyName',
      companyDescription: 'CompanyDescription', companyWebsite: 'CompanyWebsite'
    };
    const params = { id: account._id };
    const assignments = Object.entries(update).map(([field, value], index) => {
      const parameter = `value${index}`;
      params[parameter] = value;
      return `${fieldMap[field]} = @${parameter}`;
    });
    await query(`
      UPDATE dbo.Accounts SET ${assignments.join(', ')}, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id
    `, params);
    const updated = await query(`SELECT ${accountColumns()} FROM dbo.Accounts a WHERE a.Id = @id`, { id: account._id });
    res.json({ account: updated.recordset[0] });
  } catch (err) {
    next(err);
  }
});

router.patch('/auth/password', requireAuth, async (req, res, next) => {
  try {
    const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
    if (newPassword.length < 10 || newPassword.length > 128) {
      return res.status(400).json({ error: 'New password must be between 10 and 128 characters.' });
    }
    const result = await query('SELECT PasswordHash AS passwordHash FROM dbo.Accounts WHERE Id = @id', {
      id: req.account._id
    });
    const account = result.recordset[0];
    if (!account || !(await passwordMatches(currentPassword, account.passwordHash))) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    await query(`
      UPDATE dbo.Accounts SET PasswordHash = @passwordHash, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id
    `, { id: req.account._id, passwordHash: await passwordHash(newPassword) });
    await query('DELETE FROM dbo.Sessions WHERE AccountId = @accountId AND Id <> @sessionId', {
      accountId: req.account._id,
      sessionId: req.sessionId
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/jobs', async (req, res, next) => {
  try {
    const { page, limit, offset } = pagination(req, 12, 50);
    const where = ['j.Status = N\'open\''];
    const params = { offset, limit };
    if (SECTORS.includes(req.query.sector)) {
      where.push('j.Sector = @sector');
      params.sector = req.query.sector;
    }
    if (JOB_TYPES.includes(req.query.type)) {
      where.push('j.EmploymentType = @type');
      params.type = req.query.type;
    }
    const search = str(req.query.q);
    if (search) {
      params.q = escapeLike(search);
      where.push('(j.Title LIKE @q OR j.Description LIKE @q OR j.Requirements LIKE @q OR j.Sector LIKE @q)');
    }
    const location = str(req.query.location);
    if (location) {
      params.location = escapeLike(location);
      where.push('j.Location LIKE @location');
    }
    const clause = `WHERE ${where.join(' AND ')}`;
    const [items, count] = await Promise.all([
      query(`
        SELECT j.Id AS _id, j.EmployerId AS employerId, j.Title AS title, j.Sector AS sector,
          j.Location AS location, j.EmploymentType AS employmentType, j.Salary AS salary,
          j.Description AS description, j.CreatedAt AS createdAt, j.UpdatedAt AS updatedAt,
          a.CompanyName AS employerCompanyName, a.Location AS employerLocation
        FROM dbo.Jobs j INNER JOIN dbo.Accounts a ON a.Id = j.EmployerId
        ${clause} ORDER BY j.CreatedAt DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `, params),
      query(`SELECT COUNT_BIG(*) AS total FROM dbo.Jobs j ${clause}`, params)
    ]);
    const total = Number(count.recordset[0].total);
    const result = items.recordset.map(({ employerId, employerCompanyName, employerLocation, ...job }) => ({
      ...job,
      employer: { _id: employerId, companyName: employerCompanyName, location: employerLocation }
    }));
    res.json({ items: result, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

router.get('/jobs/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid job id.' });
    const result = await query(`
      SELECT j.Id AS _id, j.EmployerId AS employerId, j.Title AS title, j.Sector AS sector,
        j.Location AS location, j.EmploymentType AS employmentType, j.Salary AS salary,
        j.Description AS description, j.Requirements AS requirements, j.Status AS status,
        j.CreatedAt AS createdAt, j.UpdatedAt AS updatedAt,
        a.CompanyName AS employerCompanyName, a.Location AS employerLocation,
        a.CompanyDescription AS employerDescription, a.CompanyWebsite AS employerWebsite
      FROM dbo.Jobs j INNER JOIN dbo.Accounts a ON a.Id = j.EmployerId
      WHERE j.Id = @id AND j.Status = N'open'
    `, { id });
    const row = result.recordset[0];
    if (!row) return res.status(404).json({ error: 'Job not found or no longer available.' });
    const { employerId, employerCompanyName, employerLocation, employerDescription, employerWebsite, ...job } = row;
    res.json({
      job: {
        ...job,
        employer: {
          _id: employerId,
          companyName: employerCompanyName,
          location: employerLocation,
          companyDescription: employerDescription,
          companyWebsite: employerWebsite
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/jobs/:id/applications', requireAuth, requireRole('candidate'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid job id.' });
    if (!req.account.fullName || !req.account.phone) {
      return res.status(400).json({ error: 'Complete your name and phone number in your profile before applying.' });
    }
    const jobs = await query(`
      SELECT Id AS _id, EmployerId AS employer, Title AS title
      FROM dbo.Jobs WHERE Id = @id AND Status = N'open'
    `, { id });
    const job = jobs.recordset[0];
    if (!job) return res.status(404).json({ error: 'Job not found or no longer available.' });
    const coverLetter = str(req.body && req.body.coverLetter);
    if (coverLetter.length > 3000) return res.status(400).json({ error: 'Cover letter must be 3000 characters or fewer.' });
    const result = await query(`
      INSERT INTO dbo.Applications (JobId, CandidateId, EmployerId, CoverLetter)
      OUTPUT INSERTED.Id AS _id, INSERTED.JobId AS job, INSERTED.CandidateId AS candidate,
        INSERTED.EmployerId AS employer, INSERTED.CoverLetter AS coverLetter,
        INSERTED.Status AS status, INSERTED.CreatedAt AS createdAt, INSERTED.UpdatedAt AS updatedAt
      VALUES (@jobId, @candidateId, @employerId, @coverLetter)
    `, {
      jobId: job._id,
      candidateId: req.account._id,
      employerId: job.employer,
      coverLetter
    });
    await notify(job.employer, `${req.account.fullName} applied for ${job.title}.`);
    res.status(201).json({ application: result.recordset[0] });
  } catch (err) {
    if ([2601, 2627].includes(err.number)) return res.status(409).json({ error: 'You have already applied for this job.' });
    next(err);
  }
});

router.get('/candidate/applications', requireAuth, requireRole('candidate'), async (req, res, next) => {
  try {
    const result = await query(`
      SELECT ap.Id AS _id, ap.JobId AS jobId, ap.CandidateId AS candidate,
        ap.EmployerId AS employer, ap.CoverLetter AS coverLetter, ap.Status AS status,
        ap.CreatedAt AS createdAt, ap.UpdatedAt AS updatedAt,
        j.Title AS jobTitle, j.Sector AS jobSector, j.Location AS jobLocation,
        j.EmploymentType AS jobEmploymentType, j.Salary AS jobSalary,
        j.Status AS jobStatus, j.CreatedAt AS jobCreatedAt
      FROM dbo.Applications ap
      LEFT JOIN dbo.Jobs j ON j.Id = ap.JobId
      WHERE ap.CandidateId = @candidateId
      ORDER BY ap.CreatedAt DESC
    `, { candidateId: req.account._id });
    const items = result.recordset.map((row) => ({
      _id: row._id,
      candidate: row.candidate,
      employer: row.employer,
      coverLetter: row.coverLetter,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      job: row.jobTitle === null ? null : {
        _id: row.jobId,
        title: row.jobTitle,
        sector: row.jobSector,
        location: row.jobLocation,
        employmentType: row.jobEmploymentType,
        salary: row.jobSalary,
        status: row.jobStatus,
        createdAt: row.jobCreatedAt
      }
    }));
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.patch('/candidate/applications/:id', requireAuth, requireRole('candidate'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid application id.' });
    const result = await query(`
      UPDATE dbo.Applications SET Status = N'withdrawn', UpdatedAt = SYSUTCDATETIME()
      OUTPUT INSERTED.Id AS _id, INSERTED.JobId AS job, INSERTED.CandidateId AS candidate,
        INSERTED.EmployerId AS employer, INSERTED.CoverLetter AS coverLetter,
        INSERTED.Status AS status, INSERTED.CreatedAt AS createdAt, INSERTED.UpdatedAt AS updatedAt
      WHERE Id = @id AND CandidateId = @candidateId AND Status NOT IN (N'withdrawn', N'rejected')
    `, { id, candidateId: req.account._id });
    const application = result.recordset[0];
    if (!application) return res.status(404).json({ error: 'Application not found or cannot be withdrawn.' });
    await notify(application.employer, `${req.account.fullName} withdrew an application.`);
    res.json({ application });
  } catch (err) {
    next(err);
  }
});

router.get('/employer/jobs', requireAuth, requireRole('employer'), async (req, res, next) => {
  try {
    const result = await query(`
      SELECT j.Id AS _id, j.EmployerId AS employer, j.Title AS title, j.Sector AS sector,
        j.Location AS location, j.EmploymentType AS employmentType, j.Salary AS salary,
        j.Description AS description, j.Requirements AS requirements, j.Status AS status,
        j.CreatedAt AS createdAt, j.UpdatedAt AS updatedAt,
        COUNT(ap.Id) AS applicationCount
      FROM dbo.Jobs j
      LEFT JOIN dbo.Applications ap ON ap.JobId = j.Id AND ap.Status <> N'withdrawn'
      WHERE j.EmployerId = @employerId
      GROUP BY j.Id, j.EmployerId, j.Title, j.Sector, j.Location, j.EmploymentType,
        j.Salary, j.Description, j.Requirements, j.Status, j.CreatedAt, j.UpdatedAt
      ORDER BY j.CreatedAt DESC
    `, { employerId: req.account._id });
    res.json({ items: result.recordset });
  } catch (err) {
    next(err);
  }
});

router.post('/employer/jobs', requireAuth, requireRole('employer'), async (req, res, next) => {
  try {
    if (!req.account.companyName || !req.account.phone) {
      return res.status(400).json({ error: 'Complete your company name and phone number in your profile before posting a job.' });
    }
    const { job, errors } = validateJob(req.body || {});
    if (errors.length) return res.status(400).json({ errors });
    const result = await query(`
      INSERT INTO dbo.Jobs (EmployerId, Title, Sector, Location, EmploymentType, Salary, Description, Requirements)
      OUTPUT INSERTED.Id AS _id, INSERTED.EmployerId AS employer, INSERTED.Title AS title,
        INSERTED.Sector AS sector, INSERTED.Location AS location,
        INSERTED.EmploymentType AS employmentType, INSERTED.Salary AS salary,
        INSERTED.Description AS description, INSERTED.Requirements AS requirements,
        INSERTED.Status AS status, INSERTED.CreatedAt AS createdAt, INSERTED.UpdatedAt AS updatedAt
      VALUES (@employerId, @title, @sector, @location, @employmentType, @salary, @description, @requirements)
    `, { employerId: req.account._id, ...job });
    res.status(201).json({ job: result.recordset[0] });
  } catch (err) {
    next(err);
  }
});

router.patch('/employer/jobs/:id', requireAuth, requireRole('employer'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid job id.' });
    const currentResult = await query(`
      SELECT Id AS _id, EmployerId AS employer, Title AS title, Sector AS sector,
        Location AS location, EmploymentType AS employmentType, Salary AS salary,
        Description AS description, Requirements AS requirements, Status AS status,
        CreatedAt AS createdAt, UpdatedAt AS updatedAt
      FROM dbo.Jobs WHERE Id = @id AND EmployerId = @employerId
    `, { id, employerId: req.account._id });
    const current = currentResult.recordset[0];
    if (!current) return res.status(404).json({ error: 'Job not found.' });
    const body = req.body || {};
    const status = body.status === undefined ? current.status : body.status;
    if (!JOB_STATUSES.includes(status)) return res.status(400).json({ error: 'Choose open or closed status.' });
    const fields = ['title', 'sector', 'location', 'employmentType', 'salary', 'description', 'requirements'];
    const merged = { ...current, ...body };
    const { job, errors } = validateJob(merged);
    if (fields.some((field) => body[field] !== undefined) && errors.length) return res.status(400).json({ errors });
    const values = fields.some((field) => body[field] !== undefined) ? job : current;
    const parameters = { id, employerId: req.account._id, status };
    for (const field of fields) parameters[field] = values[field];
    const updated = await query(`
      UPDATE dbo.Jobs
      SET Status = @status, Title = @title, Sector = @sector, Location = @location,
        EmploymentType = @employmentType, Salary = @salary, Description = @description,
        Requirements = @requirements, UpdatedAt = SYSUTCDATETIME()
      OUTPUT INSERTED.Id AS _id, INSERTED.EmployerId AS employer, INSERTED.Title AS title,
        INSERTED.Sector AS sector, INSERTED.Location AS location,
        INSERTED.EmploymentType AS employmentType, INSERTED.Salary AS salary,
        INSERTED.Description AS description, INSERTED.Requirements AS requirements,
        INSERTED.Status AS status, INSERTED.CreatedAt AS createdAt, INSERTED.UpdatedAt AS updatedAt
      WHERE Id = @id AND EmployerId = @employerId
    `, parameters);
    res.json({ job: updated.recordset[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/employer/jobs/:id', requireAuth, requireRole('employer'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid job id.' });
    const owned = await query('SELECT Id FROM dbo.Jobs WHERE Id = @id AND EmployerId = @employerId', {
      id, employerId: req.account._id
    });
    if (!owned.recordset.length) return res.status(404).json({ error: 'Job not found.' });
    const existingApplication = await query('SELECT TOP (1) Id FROM dbo.Applications WHERE JobId = @id', { id });
    if (existingApplication.recordset.length) {
      return res.status(409).json({ error: 'This job has applications. Close it instead to preserve its records.' });
    }
    await query('DELETE FROM dbo.Jobs WHERE Id = @id AND EmployerId = @employerId', {
      id, employerId: req.account._id
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/employer/jobs/:jobId/applications', requireAuth, requireRole('employer'), async (req, res, next) => {
  try {
    const { jobId } = req.params;
    if (!isValidId(jobId)) return res.status(400).json({ error: 'Invalid job id.' });
    const ownsJob = await query('SELECT Id FROM dbo.Jobs WHERE Id = @jobId AND EmployerId = @employerId', {
      jobId, employerId: req.account._id
    });
    if (!ownsJob.recordset.length) return res.status(404).json({ error: 'Job not found.' });
    const result = await query(`
      SELECT ap.Id AS _id, ap.JobId AS job, ap.CandidateId AS candidateId,
        ap.EmployerId AS employer, ap.CoverLetter AS coverLetter, ap.Status AS status,
        ap.CreatedAt AS createdAt, ap.UpdatedAt AS updatedAt,
        c.FullName AS candidateFullName, c.Email AS candidateEmail, c.Phone AS candidatePhone,
        c.Location AS candidateLocation, c.Skills AS candidateSkills, c.Experience AS candidateExperience
      FROM dbo.Applications ap
      INNER JOIN dbo.Accounts c ON c.Id = ap.CandidateId
      WHERE ap.JobId = @jobId AND ap.Status <> N'withdrawn'
      ORDER BY ap.CreatedAt DESC
    `, { jobId });
    const items = result.recordset.map(({ candidateId, candidateFullName, candidateEmail,
      candidatePhone, candidateLocation, candidateSkills, candidateExperience, ...application }) => ({
      ...application,
      candidate: {
        _id: candidateId,
        fullName: candidateFullName,
        email: candidateEmail,
        phone: candidatePhone,
        location: candidateLocation,
        skills: candidateSkills,
        experience: candidateExperience
      }
    }));
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.patch('/employer/applications/:id', requireAuth, requireRole('employer'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid application id.' });
    const status = str(req.body && req.body.status);
    if (!EMPLOYER_APPLICATION_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Choose a valid applicant status.' });
    }
    const updated = await query(`
      UPDATE dbo.Applications
      SET Status = @status, UpdatedAt = SYSUTCDATETIME()
      OUTPUT INSERTED.Id AS _id, INSERTED.JobId AS jobId, INSERTED.CandidateId AS candidate,
        INSERTED.EmployerId AS employer, INSERTED.CoverLetter AS coverLetter,
        INSERTED.Status AS status, INSERTED.CreatedAt AS createdAt, INSERTED.UpdatedAt AS updatedAt
      WHERE Id = @id AND EmployerId = @employerId AND Status <> N'withdrawn'
    `, { id, employerId: req.account._id, status });
    const application = updated.recordset[0];
    if (!application) return res.status(404).json({ error: 'Application not found.' });
    const jobResult = await query('SELECT Title AS title FROM dbo.Jobs WHERE Id = @jobId', {
      jobId: application.jobId
    });
    const jobTitle = jobResult.recordset[0].title;
    await notify(application.candidate, `Your application for ${jobTitle} is now ${status.replace('_', ' ')}.`);
    const { jobId, ...response } = application;
    res.json({ application: { ...response, job: { title: jobTitle } } });
  } catch (err) {
    next(err);
  }
});

router.get('/notifications', requireAuth, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT TOP (50) Id AS _id, AccountId AS account, Message AS message,
        Href AS href, ReadAt AS readAt, CreatedAt AS createdAt, UpdatedAt AS updatedAt
      FROM dbo.Notifications WHERE AccountId = @accountId
      ORDER BY CreatedAt DESC
    `, { accountId: req.account._id });
    const items = result.recordset;
    res.json({ items, unread: items.filter((item) => !item.readAt).length });
  } catch (err) {
    next(err);
  }
});

router.patch('/notifications/:id/read', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid notification id.' });
    const result = await query(`
      UPDATE dbo.Notifications
      SET ReadAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()
      OUTPUT INSERTED.Id AS _id, INSERTED.AccountId AS account, INSERTED.Message AS message,
        INSERTED.Href AS href, INSERTED.ReadAt AS readAt, INSERTED.CreatedAt AS createdAt,
        INSERTED.UpdatedAt AS updatedAt
      WHERE Id = @id AND AccountId = @accountId
    `, { id, accountId: req.account._id });
    const item = result.recordset[0];
    if (!item) return res.status(404).json({ error: 'Notification not found.' });
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
