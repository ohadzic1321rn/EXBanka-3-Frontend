import { execSync } from 'child_process'

let cachedContainer = null

function findPostgresContainer() {
  if (cachedContainer) return cachedContainer

  let container = ''
  try {
    container = execSync('docker compose -f ../docker-compose.yml ps -q postgres', {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch {
    container = ''
  }

  if (!container) {
    container = execSync('docker ps --filter "name=postgres" --format "{{.Names}}"', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim().split(/\r?\n/)[0]
  }

  if (!container) {
    throw new Error('[db-seed] Postgres container not found. Is the Docker stack running?')
  }

  cachedContainer = container
  return container
}

function quoteLiteral(value) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`[db-seed] Non-finite numeric param: ${value}`)
    return String(value)
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (value instanceof Date) return `'${value.toISOString()}'`
  const str = String(value).replace(/'/g, "''")
  return `'${str}'`
}

function interpolate(sql, params) {
  if (!params || params.length === 0) return sql
  return sql.replace(/\$(\d+)/g, (_, idx) => {
    const i = Number(idx) - 1
    if (i < 0 || i >= params.length) {
      throw new Error(`[db-seed] Param $${idx} out of range (got ${params.length} params)`)
    }
    return quoteLiteral(params[i])
  })
}

/**
 * Execute SQL inside the running postgres container.
 *
 * Usage from a spec:
 *   cy.task('dbExec', {
 *     sql: 'INSERT INTO portfolio_holdings (user_id, user_type, ...) VALUES ($1, $2, ...)',
 *     params: [clientId, 'client', ...],
 *   })
 *
 *   cy.task('dbExec', {
 *     sql: 'SELECT id, quantity FROM portfolio_holdings WHERE user_id = $1',
 *     params: [clientId],
 *   }).then(({ rows }) => { ... })
 *
 * Returns { rows: Array<Record<string, any>>, command: string }
 */
export function dbExec({ sql, params = [] }) {
  if (!sql || typeof sql !== 'string') {
    throw new Error('[db-seed] dbExec requires a non-empty sql string')
  }

  const container = findPostgresContainer()
  const interpolated = interpolate(sql.trim(), params)

  const wrappedSql = `SELECT row_to_json(t) FROM (${interpolated.replace(/;$/, '')}) t`
  const isSelect = /^\s*SELECT\b/i.test(interpolated)

  let stdout = ''
  try {
    if (isSelect) {
      stdout = execSync(
        `docker exec -i ${container} psql -U postgres -d bankdb -At -F '|' -c "${wrappedSql.replace(/"/g, '\\"')}"`,
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
      )
    } else {
      stdout = execSync(
        `docker exec -i ${container} psql -U postgres -d bankdb -c "${interpolated.replace(/"/g, '\\"')}"`,
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
      )
    }
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : ''
    throw new Error(`[db-seed] psql failed: ${err.message}\nSQL: ${interpolated}\nSTDERR: ${stderr}`)
  }

  if (!isSelect) {
    return { rows: [], command: stdout.trim() }
  }

  const rows = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return { _raw: line }
      }
    })

  return { rows }
}
