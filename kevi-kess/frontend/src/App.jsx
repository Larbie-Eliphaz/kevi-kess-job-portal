import { useEffect, useState } from 'react';

const SECTORS = [
  'Construction & Engineering', 'Healthcare & Support', 'Hospitality & Tourism',
  'Transportation & Logistics', 'Agriculture & Farming', 'Office & Administration',
  'Manufacturing & Production', 'Retail & Sales', 'Security', 'Other'
];
const JOB_TYPES = ['full-time', 'part-time', 'contract', 'temporary'];
const APPLICATION_STATUSES = ['under_review', 'shortlisted', 'interview', 'offer', 'rejected'];
const ENQUIRY_STATUSES = ['new', 'contacted', 'shortlisted', 'placed', 'rejected'];
const ADMIN_SECTIONS = ['candidates', 'employers', 'accounts', 'jobs', 'applications'];

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (data.errors || []).join(' ') || data.error || `Request failed (${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

const json = (method, body) => ({ method, body: JSON.stringify(body) });

function Message({ children, error = false }) {
  return children ? <p className={`message ${error ? 'error' : 'success'}`} role={error ? 'alert' : 'status'}>{children}</p> : null;
}

function Header({ portal = false }) {
  return (
    <header className="site-header">
      <a className="brand" href="/">KK <span>KEVI KESS RESOURCES</span></a>
      <nav>
        {portal ? <a href="/">Back to website</a> : <><a href="#services">Services</a><a href="#sectors">Job sectors</a><a href="#contact">Contact</a><a className="button small" href="/portal">Jobs &amp; accounts</a></>}
      </nav>
    </header>
  );
}

function PublicSite() {
  const [formMessage, setFormMessage] = useState({});
  async function submit(event, type) {
    event.preventDefault();
    const form = event.currentTarget;
    setFormMessage((prev) => ({ ...prev, [type]: '' }));
    try {
      await api(`/api/${type}`, json('POST', Object.fromEntries(new FormData(form))));
      form.reset();
      setFormMessage((prev) => ({ ...prev, [type]: 'Thank you. Your details have been submitted.' }));
    } catch (error) {
      setFormMessage((prev) => ({ ...prev, [type]: error.message }));
    }
  }

  return (
    <>
      <Header />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Recruitment · Training · Placement</p>
            <h1>The right people.<br /><span>The right opportunities.</span></h1>
            <p>We connect businesses with skilled professionals and help candidates explore suitable employment opportunities.</p>
            <div className="actions"><a className="button gold" href="#candidate-form">Find a job</a><a className="button outline" href="#employer-form">Hire workers</a></div>
          </div>
          <div className="hero-card"><span>KK</span><strong>People are at the heart of every successful business.</strong><a href="/portal">Explore open jobs →</a></div>
        </section>

        <section className="section" id="services">
          <div className="section-title"><p className="eyebrow">What we do</p><h2>Staffing solutions that move you forward</h2></div>
          <div className="three-cards">
            <article className="card"><span className="icon">01</span><h3>Recruitment</h3><p>We connect employers with capable, qualified people for their teams.</p></article>
            <article className="card"><span className="icon">02</span><h3>Training</h3><p>We help candidates strengthen their skills and prepare for work.</p></article>
            <article className="card"><span className="icon">03</span><h3>Placement</h3><p>We support both candidates and employers throughout the hiring journey.</p></article>
          </div>
        </section>

        <section className="section soft" id="sectors">
          <div className="section-title"><p className="eyebrow">Our expertise</p><h2>Connecting talent across sectors</h2></div>
          <div className="sector-list">{SECTORS.slice(0, -1).map((sector) => <span key={sector}>{sector}</span>)}</div>
          <p className="center"><a className="button" href="/portal">Browse jobs and create an account</a></p>
        </section>

        <section className="section" id="contact">
          <div className="section-title"><p className="eyebrow">Get started</p><h2>Tell us what you need</h2><p>Submit an enquiry and our team will be in touch.</p></div>
          <div className="form-grid">
            <form className="card form" id="candidate-form" onSubmit={(event) => submit(event, 'candidates')}>
              <h3>I'm looking for a job</h3>
              <label>Full name<input name="name" required maxLength="120" /></label>
              <label>Phone number<input name="phone" type="tel" required /></label>
              <label>Area of work<select name="role" required defaultValue=""><option value="" disabled>Choose a sector</option>{SECTORS.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Experience or skills<textarea name="experience" maxLength="2000" /></label>
              <button className="button" type="submit">Send enquiry</button><Message>{formMessage.candidates}</Message>
            </form>
            <form className="card form" id="employer-form" onSubmit={(event) => submit(event, 'employers')}>
              <h3>I need workers</h3>
              <label>Company / contact name<input name="company" required maxLength="120" /></label>
              <label>Phone number<input name="phone" type="tel" required /></label>
              <label>Worker type / job role<input name="role" required maxLength="120" /></label>
              <label>Number of workers<input name="count" type="number" min="1" step="1" /></label>
              <label>Requirements<textarea name="details" maxLength="2000" /></label>
              <button className="button" type="submit">Request workers</button><Message>{formMessage.employers}</Message>
            </form>
          </div>
        </section>
      </main>
      <footer className="footer"><strong>KEVI KESS RESOURCES LTD.</strong><span>Recruitment · Training · Placement</span><span>0273144451 / 0535799190</span><a href="/admin/login">Admin</a></footer>
    </>
  );
}

function AuthForm({ onAccount }) {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('candidate');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const body = { email: form.get('email'), password: form.get('password') };
    if (mode === 'register') {
      body.role = role;
      body[role === 'candidate' ? 'fullName' : 'companyName'] = form.get('name');
      body.phone = form.get('phone');
    }
    try {
      const { account } = await api(`/api/auth/${mode === 'register' ? 'register' : 'login'}`, json('POST', body));
      onAccount(account);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Your account</h2>
      <div className="tabs"><button className={mode === 'login' ? 'selected' : ''} onClick={() => { setMode('login'); setError(''); }}>Sign in</button><button className={mode === 'register' ? 'selected' : ''} onClick={() => { setMode('register'); setError(''); }}>Create account</button></div>
      <form className="form compact" onSubmit={submit}>
        {mode === 'register' && <>
          <label>Account type<select value={role} onChange={(event) => setRole(event.target.value)}><option value="candidate">Candidate / employee</option><option value="employer">Employer</option></select></label>
          <label>{role === 'candidate' ? 'Full name' : 'Company name'}<input name="name" required /></label>
          <label>Phone number<input name="phone" type="tel" required /></label>
        </>}
        <label>Email<input name="email" type="email" required maxLength="254" /></label>
        <label>Password<input name="password" type="password" required minLength={mode === 'register' ? 10 : 1} maxLength="128" /></label>
        <Message error>{error}</Message><button className="button" disabled={busy}>{busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}</button>
      </form>
    </section>
  );
}

function Portal() {
  const [account, setAccount] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState({ q: '', location: '', sector: '', type: '' });
  const [search, setSearch] = useState('');

  async function loadJobs() {
    try {
      const params = new URLSearchParams({ limit: '50' });
      Object.entries(query).forEach(([key, value]) => { if (value) params.set(key, value); });
      const data = await api(`/api/jobs?${params}`);
      setJobs(data.items);
      setError('');
    } catch (err) { setError(err.message); }
  }
  async function loadWorkspace(current = account) {
    if (!current) return;
    try {
      await Promise.all([
        api('/api/notifications').then((data) => setNotifications(data.items)),
        current.role === 'candidate'
          ? api('/api/candidate/applications').then((data) => setApplications(data.items))
          : api('/api/employer/jobs').then((data) => setMyJobs(data.items))
      ]);
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { loadJobs(); }, [search]);
  useEffect(() => {
    api('/api/auth/me').then(({ account: current }) => {
      setAccount(current);
      loadWorkspace(current);
    }).catch((err) => {
      if (err.status !== 401) setError(err.message);
    });
  }, []);

  async function signOut() {
    try {
      await api('/api/auth/logout', json('POST', {}));
      setAccount(null); setApplications([]); setMyJobs([]); setNotifications([]);
    } catch (err) { setError(err.message); }
  }
  async function submitProfile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const { account: updated } = await api('/api/auth/profile', json('PATCH', Object.fromEntries(new FormData(form))));
      setAccount(updated); setError('Profile saved.');
    } catch (err) { setError(err.message); }
  }
  async function apply(job) {
    const coverLetter = window.prompt('Cover letter (optional):') || '';
    try {
      await api(`/api/jobs/${job._id}/applications`, json('POST', { coverLetter }));
      setError('Application submitted.');
      loadWorkspace();
    } catch (err) { setError(err.message); }
  }
  async function createJob(event) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await api('/api/employer/jobs', json('POST', Object.fromEntries(new FormData(form))));
      form.reset(); setError('Job published.'); loadWorkspace(); loadJobs();
    } catch (err) { setError(err.message); }
  }
  async function markRead(id) {
    try {
      await api(`/api/notifications/${id}/read`, json('PATCH', {}));
      loadWorkspace();
    } catch (err) { setError(err.message); }
  }

  return (
    <>
      <Header portal />
      <main className="portal-main">
        <section className="portal-intro"><p className="eyebrow">Jobs &amp; accounts</p><h1>{account?.role === 'employer' ? 'Your hiring workspace' : 'Find your next opportunity.'}</h1><p>Explore current openings, manage applications, and connect with qualified candidates.</p></section>
        <Message error={Boolean(error && !error.includes('saved') && !error.includes('submitted') && !error.includes('published'))}>{error}</Message>
        <div className="portal-grid">
          <section className="panel jobs-panel">
            <h2>Open jobs</h2><p className="muted">Search current opportunities posted by employers.</p>
            <form className="filters" onSubmit={(event) => { event.preventDefault(); setSearch(String(Date.now())); }}>
              <input aria-label="Keyword" placeholder="Job title or keyword" value={query.q} onChange={(event) => setQuery({ ...query, q: event.target.value })} />
              <input aria-label="Location" placeholder="Location" value={query.location} onChange={(event) => setQuery({ ...query, location: event.target.value })} />
              <select aria-label="Sector" value={query.sector} onChange={(event) => setQuery({ ...query, sector: event.target.value })}><option value="">All sectors</option>{SECTORS.map((s) => <option key={s}>{s}</option>)}</select>
              <select aria-label="Employment type" value={query.type} onChange={(event) => setQuery({ ...query, type: event.target.value })}><option value="">Any type</option>{JOB_TYPES.map((type) => <option key={type} value={type}>{type.replace('-', ' ')}</option>)}</select>
              <button className="button">Search</button>
            </form>
            {jobs.length ? jobs.map((job) => <JobCard key={job._id} job={job} account={account} onApply={apply} />) : <p className="empty">No jobs match your search yet.</p>}
          </section>
          <aside className="workspace">
            {!account ? <AuthForm onAccount={(current) => { setAccount(current); loadWorkspace(current); }} /> : <>
              <section className="panel">
                <h2>{account.role === 'employer' ? account.companyName || 'Employer account' : account.fullName || 'Candidate account'}</h2>
                <p className="muted">{account.email} · {account.role}</p>
                <button className="button secondary" onClick={signOut}>Sign out</button>
              </section>
              <ProfileForm account={account} onSubmit={submitProfile} />
              <PasswordForm onError={setError} />
              {account.role === 'candidate' ? <section className="panel"><h2>My applications</h2>{applications.map((item) => <article className="list-item" key={item._id}><strong>{item.job?.title || 'Job no longer available'}</strong><span className="badge">{item.status.replace('_', ' ')}</span>{!['withdrawn', 'rejected'].includes(item.status) && <button className="text-button" onClick={async () => { try { await api(`/api/candidate/applications/${item._id}`, json('PATCH', {})); loadWorkspace(); } catch (err) { setError(err.message); } }}>Withdraw</button>}</article>)}{!applications.length && <p className="muted">Your submitted applications will appear here.</p>}</section> :
                <EmployerWorkspace jobs={myJobs} onCreate={createJob} onChange={async (id, status) => { try { await api(`/api/employer/jobs/${id}`, json('PATCH', { status })); loadWorkspace(); } catch (err) { setError(err.message); } }} onError={setError} />}
              <section className="panel"><h2>Updates</h2>{notifications.map((item) => <div className="list-item" key={item._id}><span>{item.message}</span>{!item.readAt && <button className="text-button" onClick={() => markRead(item._id)}>Mark read</button>}</div>)}{!notifications.length && <p className="muted">Application and hiring updates will appear here.</p>}</section>
            </>}
          </aside>
        </div>
      </main>
      <footer className="footer"><a href="/">Kevi Kess Resources Ltd.</a><span>Recruitment, training and placement</span></footer>
    </>
  );
}

function JobCard({ job, account, onApply }) {
  const [details, setDetails] = useState(null);
  const [detailError, setDetailError] = useState('');
  async function toggleDetails() {
    if (details) { setDetails(null); return; }
    try { setDetails((await api(`/api/jobs/${job._id}`)).job); } catch (err) { setDetailError(err.message); }
  }
  return <article className="job-card"><h3>{job.title}</h3><p className="muted">{job.employer?.companyName || 'Kevi Kess employer'} · {job.location} · {job.sector}</p><p>{job.employmentType?.replace('-', ' ')} {job.salary && `· ${job.salary}`}</p><div className="actions"><button className="button secondary" onClick={toggleDetails}>{details ? 'Hide details' : 'View details'}</button>{account?.role === 'candidate' && <button className="button" onClick={() => onApply(job)}>Apply</button>}</div>{detailError && <Message error>{detailError}</Message>}{details && <div className="job-details"><p>{details.description}</p>{details.requirements && <p><strong>Requirements:</strong> {details.requirements}</p>}{details.employer?.companyDescription && <p>{details.employer.companyDescription}</p>}</div>}</article>;
}

function ProfileForm({ account, onSubmit }) {
  const candidate = account.role === 'candidate';
  const fields = candidate
    ? [['fullName', 'Full name'], ['phone', 'Phone'], ['location', 'Location'], ['skills', 'Skills'], ['experience', 'Experience']]
    : [['companyName', 'Company name'], ['phone', 'Phone'], ['location', 'Location'], ['companyDescription', 'Company description'], ['companyWebsite', 'Company website']];
  return <details className="panel"><summary>Edit profile</summary><form className="form compact" onSubmit={onSubmit}>{fields.map(([name, label]) => <label key={name}>{label}{['skills', 'experience', 'companyDescription'].includes(name) ? <textarea name={name} defaultValue={account[name] || ''} /> : <input name={name} type={name === 'companyWebsite' ? 'url' : 'text'} defaultValue={account[name] || ''} />}</label>)}<button className="button">Save profile</button></form></details>;
}

function PasswordForm({ onError }) {
  const [message, setMessage] = useState('');
  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage('');
    try {
      await api('/api/auth/password', json('PATCH', Object.fromEntries(new FormData(form))));
      form.reset();
      setMessage('Password updated. Other active sessions have been signed out.');
    } catch (err) { onError(err.message); }
  }
  return <details className="panel"><summary>Change password</summary><form className="form compact" onSubmit={submit}><label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required /></label><label>New password<input name="newPassword" type="password" autoComplete="new-password" minLength="10" maxLength="128" required /></label>{message && <Message>{message}</Message>}<button className="button">Update password</button></form></details>;
}

function EmployerWorkspace({ jobs, onCreate, onChange, onError }) {
  const [selected, setSelected] = useState('');
  const [applicants, setApplicants] = useState([]);
  async function viewApplicants(jobId) {
    if (selected === jobId) { setSelected(''); return; }
    try {
      const { items } = await api(`/api/employer/jobs/${jobId}/applications`);
      setApplicants(items); setSelected(jobId);
    } catch (err) { onError(err.message); }
  }
  return <>
    <section className="panel"><h2>Post a job</h2><form className="form compact" onSubmit={onCreate}>
      <label>Job title<input name="title" required maxLength="160" /></label><label>Sector<select name="sector" required defaultValue=""><option value="" disabled>Select a sector</option>{SECTORS.map((s) => <option key={s}>{s}</option>)}</select></label>
      <label>Location<input name="location" required maxLength="160" /></label><label>Employment type<select name="employmentType">{JOB_TYPES.map((type) => <option key={type} value={type}>{type.replace('-', ' ')}</option>)}</select></label>
      <label>Salary<input name="salary" maxLength="120" /></label><label>Description<textarea name="description" required maxLength="5000" /></label><label>Requirements<textarea name="requirements" maxLength="3000" /></label><button className="button">Publish job</button>
    </form></section>
    <section className="panel"><h2>Your job posts</h2>{jobs.map((job) => <article className="list-item stacked" key={job._id}><strong>{job.title}</strong><span className="muted">{job.location} · {job.applicationCount} application(s) · {job.status}</span><div className="actions"><button className="button secondary" onClick={() => onChange(job._id, job.status === 'open' ? 'closed' : 'open')}>{job.status === 'open' ? 'Close job' : 'Reopen job'}</button><button className="button secondary" onClick={() => viewApplicants(job._id)}>Applicants</button></div>{selected === job._id && applicants.map((item) => <Applicant key={item._id} item={item} onError={onError} />)}</article>)}{!jobs.length && <p className="muted">You have not posted any jobs yet.</p>}</section>
  </>;
}

function Applicant({ item, onError }) {
  const [status, setStatus] = useState(item.status);
  async function update(event) {
    const next = event.target.value;
    try { await api(`/api/employer/applications/${item._id}`, json('PATCH', { status: next })); setStatus(next); }
    catch (err) { onError(err.message); }
  }
  return <div className="applicant"><strong>{item.candidate?.fullName}</strong><p>{item.candidate?.email} · {item.candidate?.phone}</p>{item.coverLetter && <p>{item.coverLetter}</p>}<select value={status} onChange={update}>{APPLICATION_STATUSES.map((value) => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}</select></div>;
}

const ADMIN_COLUMNS = {
  candidates: [['name', 'Name'], ['phone', 'Phone'], ['role', 'Sector'], ['experience', 'Experience']],
  employers: [['company', 'Company / contact'], ['phone', 'Phone'], ['role', 'Worker type'], ['count', 'Count'], ['details', 'Requirements']],
  accounts: [['role', 'Account type'], ['email', 'Email'], ['fullName', 'Candidate'], ['companyName', 'Company'], ['phone', 'Phone']],
  jobs: [['title', 'Job title'], ['employer.companyName', 'Employer'], ['location', 'Location'], ['sector', 'Sector'], ['employmentType', 'Type']],
  applications: [['job.title', 'Job'], ['candidate.fullName', 'Candidate'], ['candidate.email', 'Candidate email'], ['employer.companyName', 'Employer']]
};

function AdminLogin() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await api('/api/admin/login', json('POST', Object.fromEntries(new FormData(event.currentTarget))));
      window.location.assign('/admin');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <main className="login-page"><form className="panel form" onSubmit={submit}><p className="eyebrow">Kevi Kess Resources</p><h1>Admin sign in</h1><label>Username<input name="username" required autoComplete="username" /></label><label>Password<input name="password" type="password" required autoComplete="current-password" /></label><Message error>{error}</Message><button className="button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button><a href="/">Back to website</a></form></main>;
}

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [kind, setKind] = useState('candidates');
  const [items, setItems] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState('');

  async function loadStats() {
    try { setStats(await api('/api/admin/stats')); }
    catch (err) {
      if (err.status === 401) window.location.replace('/admin/login');
      else setError(err.message);
    }
  }
  async function load() {
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (search) params.set('q', search);
    if (filter) params.set(kind === 'accounts' ? 'role' : 'status', filter);
    try {
      const data = await api(`/api/admin/${kind}?${params}`);
      setItems(data.items);
      setPages(data.pages || 1);
      setStatuses(kind === 'accounts' ? ['candidate', 'employer'] : data.statuses || []);
      setError('');
    } catch (err) {
      if (err.status === 401) window.location.replace('/admin/login');
      else setError(err.message);
    }
  }
  useEffect(() => { loadStats(); }, []);
  useEffect(() => { load(); }, [kind, search, filter, page]);
  async function signOut() {
    try { await api('/api/admin/logout', json('POST', {})); window.location.assign('/admin/login'); }
    catch (err) { setError(err.message); }
  }
  async function update(id, body, method = 'PATCH') {
    try { await api(`/api/admin/${kind}/${id}`, json(method, body)); load(); loadStats(); }
    catch (err) { setError(err.message); }
  }
  const statLabels = stats ? [
    ['Candidate enquiries', stats.candidates], ['New candidate enquiries', stats.newCandidates],
    ['Employer requests', stats.employers], ['New employer requests', stats.newEmployers],
    ['Candidate accounts', stats.candidateAccounts], ['Employer accounts', stats.employerAccounts],
    ['All jobs', stats.jobs], ['Open jobs', stats.openJobs], ['Applications', stats.applications]
  ] : [];
  return <div className="admin-page"><header className="admin-header"><strong>KEVI KESS <span>ADMIN</span></strong><div><button className="button secondary" onClick={() => { loadStats(); load(); }}>Refresh</button><button className="button" onClick={signOut}>Sign out</button></div></header><main className="admin-main">
    <Message error>{error}</Message>
    <div className="stats">{statLabels.map(([label, value]) => <div className="stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
    <div className="admin-toolbar"><div className="tabs">{ADMIN_SECTIONS.map((section) => <button key={section} className={kind === section ? 'selected' : ''} onClick={() => { setKind(section); setFilter(''); setPage(1); }}>{section}</button>)}</div><input placeholder="Search…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /><select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}><option value="">All {kind === 'accounts' ? 'account types' : 'statuses'}</option>{statuses.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select></div>
    <div className="table-scroll"><table><thead><tr><th>Created</th>{ADMIN_COLUMNS[kind].map(([, label]) => <th key={label}>{label}</th>)}{kind !== 'accounts' && <th>Status</th>}{['candidates', 'employers'].includes(kind) && <><th>Notes</th><th>Actions</th></>}</tr></thead>
      <tbody>{items.map((item) => <AdminRow key={item._id} item={item} kind={kind} update={update} />)}</tbody></table>
      {!items.length && <p className="empty">No records found.</p>}
    </div>
    <div className="pager"><button className="button secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="button secondary" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</button></div>
  </main></div>;
}

function AdminRow({ item, kind, update }) {
  const pathValue = (object, path) => path.split('.').reduce((value, part) => value?.[part], object);
  return <tr><td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}</td>{ADMIN_COLUMNS[kind].map(([key]) => <td key={key}>{String(pathValue(item, key) ?? '')}</td>)}
    {kind !== 'accounts' && <td><select value={item.status} onChange={(event) => update(item._id, { status: event.target.value })}>{(kind === 'jobs' ? ['open', 'closed'] : kind === 'applications' ? APPLICATION_STATUSES : ENQUIRY_STATUSES).map((value) => <option key={value}>{value}</option>)}</select></td>}
    {['candidates', 'employers'].includes(kind) && <><td><textarea aria-label="Admin notes" defaultValue={item.notes || ''} onBlur={(event) => { if (event.target.value !== (item.notes || '')) update(item._id, { notes: event.target.value }); }} /></td><td><button className="danger-button" onClick={() => { if (window.confirm('Delete this enquiry?')) update(item._id, {}, 'DELETE'); }}>Delete</button></td></>}
  </tr>;
}

export default function App() {
  const path = window.location.pathname;
  if (path === '/admin/login') return <AdminLogin />;
  if (path === '/admin') return <AdminDashboard />;
  if (path === '/portal' || path === '/jobs') return <Portal />;
  return <PublicSite />;
}
