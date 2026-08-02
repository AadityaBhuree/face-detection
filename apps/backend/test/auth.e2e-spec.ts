import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';

// ─── Mocks ─────────────────────────────────────────────────────

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  refresh: jest.fn(),
  getProfile: jest.fn(),
  logout: jest.fn(),
};

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = {} as any;

// ─── Test Data ─────────────────────────────────────────────────

const validRegister = {
  name: 'Dr. Priya Sharma',
  email: 'doctor@jeevandata.com',
  password: 'StrongPass123',
};

const validLogin = {
  email: 'doctor@jeevandata.com',
  password: 'StrongPass123',
};

const mockUser = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Dr. Priya Sharma',
  email: 'doctor@jeevandata.com',
  role: 'DOCTOR',
  clinicId: 'clinic-001',
};

describe('AuthController (E2E)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let validAccessToken: string;

  beforeAll(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // JwtModule.registerAsync in AuthModule injects ConfigService.
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              jwt: { secret: 'test-secret', expiration: '24h' },
            }),
          ],
        }),
        AuthModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideProvider(AuditService)
      .useValue(mockAuditService)
      .overrideProvider(AuthService)
      .useValue(mockAuthService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    // Sign a REAL access token with the same secret the JwtStrategy
    // validates against, so the guard lets these requests through.
    jwtService = app.get(JwtService);
    validAccessToken = await jwtService.signAsync({
      sub: mockUser.id,
      email: mockUser.email,
      role: mockUser.role,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── POST /auth/register ─────────────────────────────────────

  describe('POST /auth/register', () => {
    it('should return 201 with the created user', async () => {
      mockAuthService.register.mockResolvedValue(mockUser);

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(validRegister)
        .expect(201);

      expect(response.body).toEqual(mockUser);
      expect(mockAuthService.register).toHaveBeenCalledWith(validRegister);
    });

    it('should return 400 for a weak password', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Test User',
          email: 'test@jeevandata.com',
          password: 'short', // < 8 chars, no uppercase/number
        })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for an invalid email', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Test User',
          email: 'not-an-email',
          password: 'StrongPass123',
        })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for a missing name', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@jeevandata.com',
          password: 'StrongPass123',
        })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── POST /auth/login ────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('should return 200 with user + token pair', async () => {
      mockAuthService.login.mockResolvedValue({
        user: mockUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 86400,
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(validLogin)
        .expect(200);

      expect(response.body.accessToken).toBe('access-token');
      expect(response.body.refreshToken).toBe('refresh-token');
      expect(response.body.user.email).toBe('doctor@jeevandata.com');
    });

    it('should return 400 when password is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'doctor@jeevandata.com' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── POST /auth/refresh ──────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('should return 200 with a fresh token pair', async () => {
      mockAuthService.refresh.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresIn: 86400,
      });

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'some-valid-refresh-token' })
        .expect(200);

      expect(response.body.accessToken).toBe('new-access');
      expect(mockAuthService.refresh).toHaveBeenCalledWith('some-valid-refresh-token');
    });

    it('should return 400 when refreshToken is missing or too short', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'abc' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── GET /auth/profile ───────────────────────────────────────

  describe('GET /auth/profile', () => {
    it('should return the authenticated user profile', async () => {
      mockAuthService.getProfile.mockResolvedValue(mockUser);

      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);

      expect(response.body.email).toBe('doctor@jeevandata.com');
    });
  });

  // ─── POST /auth/logout ───────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('should revoke tokens and return success', async () => {
      mockAuthService.logout.mockResolvedValue({ success: true });

      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);

      expect(response.body).toEqual({ success: true });
    });
  });
});
