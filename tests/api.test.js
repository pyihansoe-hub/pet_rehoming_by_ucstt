const request = require('supertest');
const app = require('../src/server');
const { Pool } = require('pg');

// Mock database connection for testing
jest.mock('pg', () => {
  const mPool = {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

describe('API Endpoint Tests', () => {
  let pool;

  beforeAll(() => {
    pool = new Pool();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Auth Endpoints', () => {
    test('POST /api/auth/register - should register a new user', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 1, email: 'test@example.com' }] });
      
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          role: 'adopter'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe('test@example.com');
    });

    test('POST /api/auth/login - should login and return tokens', async () => {
      pool.query.mockResolvedValue({ 
        rows: [{ 
          id: 1, 
          email: 'test@example.com', 
          password_hash: 'hashed',
          role: 'adopter'
        }] 
      });
      
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    test('POST /api/auth/forgot-password - should send reset email', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 1, email: 'test@example.com' }] });
      
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toContain('reset link');
    });

    test('POST /api/auth/refresh-token - should refresh access token', async () => {
      pool.query.mockResolvedValue({ 
        rows: [{ 
          id: 1, 
          email: 'test@example.com',
          role: 'adopter'
        }] 
      });
      
      const res = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });
  });

  describe('Pet Endpoints', () => {
    test('GET /api/pets/trending - should return trending pets', async () => {
      pool.query.mockResolvedValue({ 
        rows: [
          { id: 1, name: 'Fluffy', views: 150 },
          { id: 2, name: 'Buddy', views: 120 }
        ] 
      });
      
      const res = await request(app)
        .get('/api/pets/trending?limit=10');

      expect(res.statusCode).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body[0]).toHaveProperty('name');
      expect(res.body[0]).toHaveProperty('views');
    });

    test('GET /api/pets/search/location - should filter by city', async () => {
      pool.query.mockResolvedValue({ 
        rows: [{ id: 1, name: 'City Pet', pet_city: 'Yangon' }] 
      });
      
      const res = await request(app)
        .get('/api/pets/search/location?city=Yangon');

      expect(res.statusCode).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body[0].pet_city).toBe('Yangon');
    });

    test('GET /api/pets/:id/timeline - should return welfare timeline', async () => {
      pool.query.mockResolvedValue({ 
        rows: [
          { type: 'health_log', event_date: '2024-01-15', details: 'Vaccination' },
          { type: 'status_change', event_date: '2024-01-10', details: 'Adopted' }
        ] 
      });
      
      const res = await request(app)
        .get('/api/pets/1/timeline');

      expect(res.statusCode).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body[0]).toHaveProperty('type');
      expect(res.body[0]).toHaveProperty('event_date');
    });

    test('GET /api/pets/status-history/:id - should return status changes', async () => {
      pool.query.mockResolvedValue({ 
        rows: [
          { old_status: 'available', new_status: 'pending', changed_at: '2024-01-10' },
          { old_status: 'pending', new_status: 'adopted', changed_at: '2024-01-15' }
        ] 
      });
      
      const res = await request(app)
        .get('/api/pets/status-history/1');

      expect(res.statusCode).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body[0]).toHaveProperty('old_status');
      expect(res.body[0]).toHaveProperty('new_status');
    });
  });

  describe('Adoption Endpoints', () => {
    test('POST /api/adoption-requests/:id/agree-contract - should sign contract', async () => {
      pool.query.mockResolvedValue({ 
        rows: [{ id: 1, status: 'approved', contract_signed: true }] 
      });
      
      const res = await request(app)
        .post('/api/adoption-requests/1/agree-contract')
        .send({ userId: 1 });

      expect(res.statusCode).toBe(200);
      expect(res.body.contract_signed).toBe(true);
    });

    test('GET /api/adoption-requests/:id/contract - should return contract details', async () => {
      pool.query.mockResolvedValue({ 
        rows: [{ 
          id: 1, 
          contract_text: 'Adoption Agreement...',
          signed_at: '2024-01-15',
          ip_address: '192.168.1.1'
        }] 
      });
      
      const res = await request(app)
        .get('/api/adoption-requests/1/contract');

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('contract_text');
      expect(res.body).toHaveProperty('signed_at');
    });
  });

  describe('Payment Endpoints', () => {
    test('POST /api/payments/simulate/:id - should simulate payment', async () => {
      pool.query.mockResolvedValue({ 
        rows: [{ id: 1, status: 'completed', payment_verified: true }] 
      });
      
      const res = await request(app)
        .post('/api/payments/simulate/1')
        .send({ userId: 1 });

      expect(res.statusCode).toBe(200);
      expect(res.body.payment_verified).toBe(true);
    });

    test('POST /api/payments/webhook/aya - should handle Aya Pay webhook', async () => {
      pool.query.mockResolvedValue({ 
        rows: [{ id: 1, status: 'completed' }] 
      });
      
      const res = await request(app)
        .post('/api/payments/webhook/aya')
        .send({
          transaction_id: 'TXN123',
          status: 'SUCCESS',
          amount: 50000
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });

  describe('Message Endpoints', () => {
    test('POST /api/messages/send - should send message', async () => {
      pool.query.mockResolvedValue({ 
        rows: [{ id: 1, content: 'Hello', sender_id: 1, receiver_id: 2 }] 
      });
      
      const res = await request(app)
        .post('/api/messages/send')
        .send({
          receiverId: 2,
          content: 'Hello',
          adoptionRequestId: 1
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('content');
      expect(res.body.receiver_id).toBe(2);
    });

    test('GET /api/messages/conversations - should get conversations', async () => {
      pool.query.mockResolvedValue({ 
        rows: [
          { partner_id: 2, partner_name: 'John', last_message: 'Hi', unread_count: 2 }
        ] 
      });
      
      const res = await request(app)
        .get('/api/messages/conversations')
        .set('Authorization', 'Bearer token');

      expect(res.statusCode).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body[0]).toHaveProperty('partner_name');
    });
  });

  describe('Monitoring Endpoints', () => {
    test('GET /api/monitoring/followups/my-due - should get upcoming follow-ups', async () => {
      pool.query.mockResolvedValue({ 
        rows: [
          { pet_id: 1, pet_name: 'Fluffy', due_date: '2024-02-01', type: '1_week' }
        ] 
      });
      
      const res = await request(app)
        .get('/api/monitoring/followups/my-due')
        .set('Authorization', 'Bearer token');

      expect(res.statusCode).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body[0]).toHaveProperty('due_date');
    });

    test('DELETE /api/monitoring/pets/:id/health-logs/:logId - should delete health log', async () => {
      pool.query.mockResolvedValue({ rowCount: 1 });
      
      const res = await request(app)
        .delete('/api/monitoring/pets/1/health-logs/5')
        .set('Authorization', 'Bearer token');

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toContain('deleted');
    });
  });

  describe('Admin Endpoints', () => {
    test('GET /api/admin/audit-logs - should get audit logs', async () => {
      pool.query.mockResolvedValue({ 
        rows: [
          { action: 'USER_SUSPENDED', actor_id: 1, target_id: 2, timestamp: '2024-01-15' }
        ] 
      });
      
      const res = await request(app)
        .get('/api/admin/audit-logs?page=1&limit=20')
        .set('Authorization', 'Bearer token');

      expect(res.statusCode).toBe(200);
      expect(res.body.logs).toBeInstanceOf(Array);
      expect(res.body.logs[0]).toHaveProperty('action');
    });
  });
});
