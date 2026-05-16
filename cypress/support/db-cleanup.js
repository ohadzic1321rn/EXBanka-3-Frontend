import { execSync } from 'child_process'

const SQL = `
DELETE FROM tax_records WHERE user_type = 'client' AND user_id IN (SELECT id FROM clients WHERE email LIKE 'cypress.%@example.com');
DELETE FROM tax_records WHERE user_type = 'bank' AND user_id = 0 AND created_at >= NOW() - INTERVAL '1 day';
DELETE FROM order_transactions WHERE order_id IN (SELECT id FROM orders WHERE user_type = 'client' AND user_id IN (SELECT id FROM clients WHERE email LIKE 'cypress.%@example.com'));
DELETE FROM order_transactions WHERE order_id IN (SELECT id FROM orders WHERE placed_by IN (SELECT id FROM employees WHERE email LIKE 'cypress.employee.%@bank.com'));
DELETE FROM orders WHERE user_type = 'client' AND user_id IN (SELECT id FROM clients WHERE email LIKE 'cypress.%@example.com');
DELETE FROM orders WHERE placed_by IN (SELECT id FROM employees WHERE email LIKE 'cypress.employee.%@bank.com');
DELETE FROM portfolio_holdings WHERE user_type = 'client' AND user_id IN (SELECT id FROM clients WHERE email LIKE 'cypress.%@example.com');
DELETE FROM otc_offers WHERE seller_user_type = 'client' AND seller_user_id IN (SELECT id FROM clients WHERE email LIKE 'cypress.%@example.com');
DELETE FROM otc_offers WHERE buyer_user_type = 'client' AND buyer_user_id IN (SELECT id FROM clients WHERE email LIKE 'cypress.%@example.com');
DELETE FROM loan_installments WHERE loan_id IN (SELECT id FROM loans WHERE client_id IN (SELECT id FROM clients WHERE email LIKE 'cypress.%@example.com'));
DELETE FROM transfers WHERE racun_posiljaoca_id IN (SELECT id FROM accounts WHERE client_id IN (SELECT id FROM clients WHERE email LIKE 'cypress.%@example.com')) OR racun_primaoca_id IN (SELECT id FROM accounts WHERE client_id IN (SELECT id FROM clients WHERE email LIKE 'cypress.%@example.com'));
DELETE FROM payments WHERE racun_posiljaoca_id IN (SELECT id FROM accounts WHERE client_id IN (SELECT id FROM clients WHERE email LIKE 'cypress.%@example.com'));
DELETE FROM card_requests WHERE client_id IN (SELECT id FROM clients WHERE email LIKE 'cypress.%@example.com');
DELETE FROM cards WHERE client_id IN (SELECT id FROM clients WHERE email LIKE 'cypress.%@example.com');
DELETE FROM payment_recipients WHERE client_id IN (SELECT id FROM clients WHERE email LIKE 'cypress.%@example.com');
DELETE FROM loans WHERE client_id IN (SELECT id FROM clients WHERE email LIKE 'cypress.%@example.com');
DELETE FROM accounts WHERE client_id IN (SELECT id FROM clients WHERE email LIKE 'cypress.%@example.com');
DELETE FROM client_permissions WHERE client_id IN (SELECT id FROM clients WHERE email LIKE 'cypress.%@example.com');
DELETE FROM firmas WHERE vlasnik_id IN (SELECT id FROM clients WHERE email LIKE 'cypress.%@example.com');
DELETE FROM clients WHERE email LIKE 'cypress.%@example.com';
DELETE FROM actuary_profiles WHERE employee_id IN (SELECT id FROM employees WHERE email LIKE 'cypress.employee.%@bank.com');
DELETE FROM employee_permissions WHERE employee_id IN (SELECT id FROM employees WHERE email LIKE 'cypress.employee.%@bank.com');
DELETE FROM employees WHERE email LIKE 'cypress.employee.%@bank.com';
`.trim().replace(/\n/g, ' ')

export function cleanupCypressData() {
  try {
    const container = execSync('docker compose -f ../docker-compose.yml ps -q postgres', {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim() || execSync('docker ps --filter "name=postgres" --format "{{.Names}}"', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim().split(/\r?\n/)[0]

    if (!container) {
      throw new Error('Postgres container was not found')
    }

    execSync(`docker exec ${container} psql -U postgres -d bankdb -c "${SQL}"`, {
      stdio: 'pipe',
    })
    console.log('[db-cleanup] Cypress test data removed from DB.')
  } catch (err) {
    console.error('[db-cleanup] Cleanup failed:', err.message)
  }
}
