const express = require('express');
const mariadb = require('mariadb');
const minimist = require('minimist');

const args = minimist(process.argv.slice(2));
const port = args['port'] || 8080;
const dbHost = args['db-host'] || '127.0.0.1';
const dbUser = args['db-user'] || 'app';
const dbPass = args['db-pass'] || 'password';
const dbName = args['db-name'] || 'simple_inventory';

const app = express();
app.use(express.json()); 

const pool = mariadb.createPool({
    host: dbHost,
    user: dbUser,
    password: dbPass,
    database: dbName,
    connectionLimit: 5
});

function sendResponse(req, res, data, htmlGenerator) {
    if (req.accepts('html')) {
        res.type('text/html').send(htmlGenerator(data));
    } else {
        res.json(data);
    }
}


app.get('/health/alive', (req, res) => {
    res.status(200).send('OK');
});

app.get('/health/ready', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('SELECT 1');
        res.status(200).send('OK');
    } catch (err) {
        console.error(err);
        res.status(500).send('Database connection error');
    } finally {
        if (conn) conn.release();
    }
});

app.get('/', (req, res) => {
    const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Simple Inventory</title></head>
        <body>
            <h1>Simple Inventory API</h1>
            <ul>
                <li><a href="/items">GET /items</a> - Отримати всі предмети</li>
                <li>POST /items - Створити предмет (JSON: name, quantity)</li>
                <li>GET /items/1 - Отримати предмет за ID</li>
                <li><a href="/health/alive">GET /health/alive</a> - Перевірка доступності</li>
                <li><a href="/health/ready">GET /health/ready</a> - Перевірка підключення до БД</li>
            </ul>
        </body>
        </html>
    `;
    res.type('text/html').send(html);
});

app.get('/items', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query("SELECT id, name FROM items");
        
        sendResponse(req, res, rows, (data) => {
            let rowsHtml = data.map(r => `<tr><td>${r.id}</td><td>${r.name}</td></tr>`).join('');
            return `<!DOCTYPE html><html><body><table border="1"><tr><th>ID</th><th>Name</th></tr>${rowsHtml}</table></body></html>`;
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

app.post('/items', async (req, res) => {
    let conn;
    try {
        const { name, quantity } = req.body;
        if (!name || quantity === undefined) {
            return res.status(400).json({ error: "Name and quantity are required" });
        }
        conn = await pool.getConnection();
        const result = await conn.query("INSERT INTO items (name, quantity) VALUES (?, ?)", [name, quantity]);
        
        const newItem = { id: Number(result.insertId), name, quantity };
        
        sendResponse(req, res, newItem, (data) => {
            return `<!DOCTYPE html><html><body><p>Item created! ID: ${data.id}, Name: ${data.name}</p></body></html>`;
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

app.get('/items/:id', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query("SELECT id, name, quantity, created_at FROM items WHERE id = ?", [req.params.id]);
        
        if (rows.length === 0) {
            return res.status(404).send('Not found');
        }
        
        sendResponse(req, res, rows[0], (data) => {
            return `<!DOCTYPE html><html><body><table border="1">
                <tr><th>ID</th><th>Name</th><th>Quantity</th><th>Created At</th></tr>
                <tr><td>${data.id}</td><td>${data.name}</td><td>${data.quantity}</td><td>${data.created_at}</td></tr>
            </table></body></html>`;
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

if (require.main === module) {
    const LISTEN_FDS = process.env.LISTEN_FDS;

    if (LISTEN_FDS && parseInt(LISTEN_FDS, 10) > 0) {
        app.listen({ fd: 3 }, () => {
            console.log('App listening via systemd socket activation');
        });
    } else {
        app.listen(port, () => {
            console.log(`App listening on port ${port}`);
        });
    }
}

module.exports = app;