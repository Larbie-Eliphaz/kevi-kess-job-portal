const fs = require('fs');
const path = require('path');
const sql = require('mssql/msnodesqlv8');

const server = process.env.SQL_SERVER || 'localhost';
const database = process.env.SQL_DATABASE || 'kevi_kess';
const instanceName = process.env.SQL_INSTANCE_NAME;
const port = Number(process.env.SQL_PORT || 1433);
const odbcDriver = process.env.SQL_ODBC_DRIVER || 'ODBC Driver 18 for SQL Server';
const trustServerCertificate = process.env.SQL_TRUST_SERVER_CERTIFICATE === 'true';
const serverAddress = instanceName ? `${server}\\${instanceName}` : `${server},${port}`;
const odbcValue = (value) => `{${String(value).replace(/}/g, '}}')}}`;
const connectionString = [
  `Driver=${odbcValue(odbcDriver)}`,
  `Server=${odbcValue(serverAddress)}`,
  `Database=${odbcValue(database)}`,
  'Trusted_Connection=Yes',
  `Encrypt=${process.env.SQL_ENCRYPT === 'false' ? 'No' : 'Yes'}`,
  `TrustServerCertificate=${trustServerCertificate ? 'Yes' : 'No'}`
].join(';') + ';';

const config = {
  server,
  database,
  port,
  driver: 'msnodesqlv8',
  connectionString,
  options: {
    trustedConnection: true,
    encrypt: process.env.SQL_ENCRYPT !== 'false',
    trustServerCertificate,
    ...(process.env.SQL_INSTANCE_NAME ? { instanceName: process.env.SQL_INSTANCE_NAME } : {})
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

let poolPromise;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect().catch((error) => {
      poolPromise = null;
      throw error;
    });
  }
  return poolPromise;
}

async function query(statement, parameters = {}) {
  const pool = await getPool();
  const request = pool.request();
  for (const [name, value] of Object.entries(parameters)) {
    if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      request.input(name, sql.UniqueIdentifier, value);
    } else if (typeof value === 'string' && value.length > 4000) {
      request.input(name, sql.NVarChar(sql.MAX), value);
    } else {
      request.input(name, value);
    }
  }
  return request.query(statement);
}

async function initializeSchema() {
  const pool = await getPool();
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.request().batch(schema);
}

function isValidId(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

module.exports = { sql, getPool, query, initializeSchema, isValidId };
