const request = require('supertest');
const mariadb = require('mariadb');
const app = require('../app');

jest.mock('mariadb', () => {
    const mPool = {
        getConnection: jest.fn(),
        end: jest.fn()
    };
    return {
        createPool: jest.fn(() => mPool)
    };
});

const pool = mariadb.createPool();

describe('App Endpoints', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('GET / should response with 200 and HTML', async () => {
        const response = await request(app).get('/');
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toMatch(/html/);
    });

    test('GET /health/alive should return 200 OK', async () => {
        const response = await request(app).get('/health/alive');
        expect(response.statusCode).toBe(200);
        expect(response.text).toBe('OK');
    });

    test('GET /health/ready should return 200 when DB is connected', async () => {
        const mConn = { query: jest.fn(), release: jest.fn() };
        pool.getConnection.mockResolvedValue(mConn);

        const response = await request(app).get('/health/ready');
        expect(response.statusCode).toBe(200);
        expect(mConn.query).toHaveBeenCalledWith('SELECT 1');
        expect(mConn.release).toHaveBeenCalled();
    });

    test('GET /health/ready should return 500 when DB fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        pool.getConnection.mockRejectedValue(new Error('Database is down'));

        const response = await request(app).get('/health/ready');
        expect(response.statusCode).toBe(500);
        expect(response.text).toBe('Database connection error');
        
        consoleSpy.mockRestore();
    });

    test('GET /items should return list of items', async () => {
        const mConn = { query: jest.fn(), release: jest.fn() };
        mConn.query.mockResolvedValue([{ id: 1, name: 'Test Item' }]);
        pool.getConnection.mockResolvedValue(mConn);

        const response = await request(app).get('/items');
        
        expect(response.statusCode).toBe(200);
        expect(mConn.query).toHaveBeenCalledWith("SELECT id, name FROM items");
        expect(mConn.release).toHaveBeenCalled();
    });
});