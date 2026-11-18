IF OBJECT_ID(N'dbo.Candidates', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Candidates (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Candidates_Id DEFAULT NEWID() PRIMARY KEY,
    Name NVARCHAR(120) NOT NULL,
    Phone NVARCHAR(30) NOT NULL,
    Role NVARCHAR(80) NOT NULL,
    Experience NVARCHAR(2000) NOT NULL CONSTRAINT DF_Candidates_Experience DEFAULT N'',
    Status NVARCHAR(20) NOT NULL CONSTRAINT DF_Candidates_Status DEFAULT N'new',
    Notes NVARCHAR(2000) NOT NULL CONSTRAINT DF_Candidates_Notes DEFAULT N'',
    Ip NVARCHAR(45) NULL,
    UserAgent NVARCHAR(300) NULL,
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Candidates_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Candidates_UpdatedAt DEFAULT SYSUTCDATETIME()
  );
END;

IF OBJECT_ID(N'dbo.Employers', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Employers (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Employers_Id DEFAULT NEWID() PRIMARY KEY,
    Company NVARCHAR(160) NOT NULL,
    Phone NVARCHAR(30) NOT NULL,
    Role NVARCHAR(200) NOT NULL,
    Count INT NULL,
    Details NVARCHAR(3000) NOT NULL CONSTRAINT DF_Employers_Details DEFAULT N'',
    Status NVARCHAR(20) NOT NULL CONSTRAINT DF_Employers_Status DEFAULT N'new',
    Notes NVARCHAR(2000) NOT NULL CONSTRAINT DF_Employers_Notes DEFAULT N'',
    Ip NVARCHAR(45) NULL,
    UserAgent NVARCHAR(300) NULL,
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Employers_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Employers_UpdatedAt DEFAULT SYSUTCDATETIME()
  );
END;

IF OBJECT_ID(N'dbo.Accounts', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Accounts (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Accounts_Id DEFAULT NEWID() PRIMARY KEY,
    Email NVARCHAR(254) NOT NULL CONSTRAINT UQ_Accounts_Email UNIQUE,
    PasswordHash NVARCHAR(200) NOT NULL,
    Role NVARCHAR(20) NOT NULL,
    FullName NVARCHAR(120) NOT NULL CONSTRAINT DF_Accounts_FullName DEFAULT N'',
    Phone NVARCHAR(30) NOT NULL CONSTRAINT DF_Accounts_Phone DEFAULT N'',
    Location NVARCHAR(160) NOT NULL CONSTRAINT DF_Accounts_Location DEFAULT N'',
    Skills NVARCHAR(2000) NOT NULL CONSTRAINT DF_Accounts_Skills DEFAULT N'',
    Experience NVARCHAR(3000) NOT NULL CONSTRAINT DF_Accounts_Experience DEFAULT N'',
    CompanyName NVARCHAR(160) NOT NULL CONSTRAINT DF_Accounts_CompanyName DEFAULT N'',
    CompanyDescription NVARCHAR(3000) NOT NULL CONSTRAINT DF_Accounts_CompanyDescription DEFAULT N'',
    CompanyWebsite NVARCHAR(300) NOT NULL CONSTRAINT DF_Accounts_CompanyWebsite DEFAULT N'',
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Accounts_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Accounts_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Accounts_Role CHECK (Role IN (N'candidate', N'employer'))
  );
END;

IF OBJECT_ID(N'dbo.Jobs', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Jobs (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Jobs_Id DEFAULT NEWID() PRIMARY KEY,
    EmployerId UNIQUEIDENTIFIER NOT NULL,
    Title NVARCHAR(160) NOT NULL,
    Sector NVARCHAR(80) NOT NULL,
    Location NVARCHAR(160) NOT NULL,
    EmploymentType NVARCHAR(20) NOT NULL,
    Salary NVARCHAR(120) NOT NULL CONSTRAINT DF_Jobs_Salary DEFAULT N'',
    Description NVARCHAR(MAX) NOT NULL,
    Requirements NVARCHAR(3000) NOT NULL CONSTRAINT DF_Jobs_Requirements DEFAULT N'',
    Status NVARCHAR(10) NOT NULL CONSTRAINT DF_Jobs_Status DEFAULT N'open',
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Jobs_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Jobs_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Jobs_Employer FOREIGN KEY (EmployerId) REFERENCES dbo.Accounts(Id),
    CONSTRAINT CK_Jobs_Status CHECK (Status IN (N'open', N'closed'))
  );
END;

IF OBJECT_ID(N'dbo.Applications', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Applications (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Applications_Id DEFAULT NEWID() PRIMARY KEY,
    JobId UNIQUEIDENTIFIER NOT NULL,
    CandidateId UNIQUEIDENTIFIER NOT NULL,
    EmployerId UNIQUEIDENTIFIER NOT NULL,
    CoverLetter NVARCHAR(3000) NOT NULL CONSTRAINT DF_Applications_CoverLetter DEFAULT N'',
    Status NVARCHAR(20) NOT NULL CONSTRAINT DF_Applications_Status DEFAULT N'submitted',
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Applications_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Applications_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Applications_Job FOREIGN KEY (JobId) REFERENCES dbo.Jobs(Id),
    CONSTRAINT FK_Applications_Candidate FOREIGN KEY (CandidateId) REFERENCES dbo.Accounts(Id),
    CONSTRAINT FK_Applications_Employer FOREIGN KEY (EmployerId) REFERENCES dbo.Accounts(Id),
    CONSTRAINT UQ_Applications_Job_Candidate UNIQUE (JobId, CandidateId)
  );
END;

IF OBJECT_ID(N'dbo.Notifications', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Notifications (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Notifications_Id DEFAULT NEWID() PRIMARY KEY,
    AccountId UNIQUEIDENTIFIER NOT NULL,
    Message NVARCHAR(240) NOT NULL,
    Href NVARCHAR(200) NOT NULL,
    ReadAt DATETIME2(3) NULL,
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Notifications_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Notifications_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Notifications_Account FOREIGN KEY (AccountId) REFERENCES dbo.Accounts(Id)
  );
END;

IF OBJECT_ID(N'dbo.Sessions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Sessions (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Sessions_Id DEFAULT NEWID() PRIMARY KEY,
    AccountId UNIQUEIDENTIFIER NOT NULL,
    TokenHash CHAR(64) NOT NULL CONSTRAINT UQ_Sessions_TokenHash UNIQUE,
    ExpiresAt DATETIME2(3) NOT NULL,
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Sessions_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Sessions_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Sessions_Account FOREIGN KEY (AccountId) REFERENCES dbo.Accounts(Id) ON DELETE CASCADE
  );
END;

IF OBJECT_ID(N'dbo.AdminSessions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.AdminSessions (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_AdminSessions_Id DEFAULT NEWID() PRIMARY KEY,
    TokenHash CHAR(64) NOT NULL CONSTRAINT UQ_AdminSessions_TokenHash UNIQUE,
    ExpiresAt DATETIME2(3) NOT NULL,
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_AdminSessions_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_AdminSessions_UpdatedAt DEFAULT SYSUTCDATETIME()
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Candidates_CreatedAt' AND object_id = OBJECT_ID(N'dbo.Candidates'))
  CREATE INDEX IX_Candidates_CreatedAt ON dbo.Candidates(CreatedAt DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Employers_CreatedAt' AND object_id = OBJECT_ID(N'dbo.Employers'))
  CREATE INDEX IX_Employers_CreatedAt ON dbo.Employers(CreatedAt DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Jobs_Status_CreatedAt' AND object_id = OBJECT_ID(N'dbo.Jobs'))
  CREATE INDEX IX_Jobs_Status_CreatedAt ON dbo.Jobs(Status, CreatedAt DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Jobs_Employer_CreatedAt' AND object_id = OBJECT_ID(N'dbo.Jobs'))
  CREATE INDEX IX_Jobs_Employer_CreatedAt ON dbo.Jobs(EmployerId, CreatedAt DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Accounts_Role_CreatedAt' AND object_id = OBJECT_ID(N'dbo.Accounts'))
  CREATE INDEX IX_Accounts_Role_CreatedAt ON dbo.Accounts(Role, CreatedAt DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Applications_Candidate_CreatedAt' AND object_id = OBJECT_ID(N'dbo.Applications'))
  CREATE INDEX IX_Applications_Candidate_CreatedAt ON dbo.Applications(CandidateId, CreatedAt DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Applications_Employer_Status' AND object_id = OBJECT_ID(N'dbo.Applications'))
  CREATE INDEX IX_Applications_Employer_Status ON dbo.Applications(EmployerId, Status);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Notifications_Account_CreatedAt' AND object_id = OBJECT_ID(N'dbo.Notifications'))
  CREATE INDEX IX_Notifications_Account_CreatedAt ON dbo.Notifications(AccountId, CreatedAt DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Sessions_Account' AND object_id = OBJECT_ID(N'dbo.Sessions'))
  CREATE INDEX IX_Sessions_Account ON dbo.Sessions(AccountId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Sessions_ExpiresAt' AND object_id = OBJECT_ID(N'dbo.Sessions'))
  CREATE INDEX IX_Sessions_ExpiresAt ON dbo.Sessions(ExpiresAt);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AdminSessions_ExpiresAt' AND object_id = OBJECT_ID(N'dbo.AdminSessions'))
  CREATE INDEX IX_AdminSessions_ExpiresAt ON dbo.AdminSessions(ExpiresAt);
