const mariadb = require('mariadb');
const minimist = require('minimist');

const args = minimist(process.argv.slice(2));
const dbHost = args['db-host'] || '127.0.0.1';
const dbUser = args['db-user'] || 'app';
const dbPass = args['db-pass'] || 'password';
const dbName = args['db-name'] || 'simple_inventory';

async function migrate() {
    let conn;
    try {
        conn = await mariadb.createConnection({
            host: dbHost,
            user: dbUser,
            password: dbPass,
            database: dbName
        });

        console.log("Підключено до бази даних. Виконується міграція...");

        await conn.query(`
            CREATE TABLE IF NOT EXISTS items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                quantity INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log("Міграція успішно завершена. Таблиця 'items' готова.");
    } catch (err) {
        console.error("Помилка під час міграції:", err);
        process.exit(1);
    } finally {
        if (conn) conn.end();
    }
}

migrate();