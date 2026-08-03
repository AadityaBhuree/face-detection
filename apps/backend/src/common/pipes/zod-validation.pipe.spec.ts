import { BadRequestException } from '@nestjs/common';
import { z, type ZodSchema } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  describe('transform', () => {
    it('should return the parsed value for valid input', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().int().positive(),
      });
      const pipe = new ZodValidationPipe(schema);

      const result = pipe.transform({ name: 'Aditya', age: 30 });

      expect(result).toEqual({ name: 'Aditya', age: 30 });
    });

    it('should apply zod coercion when the schema transforms values', () => {
      const schema = z.object({ age: z.coerce.number() });
      const pipe = new ZodValidationPipe(schema);

      const result = pipe.transform({ age: '42' });

      expect(result).toEqual({ age: 42 });
    });

    it('should throw BadRequestException with VALIDATION_ERROR code for invalid input', () => {
      const schema = z.object({ name: z.string().min(2) });
      const pipe = new ZodValidationPipe(schema);

      let thrown: unknown;
      try {
        pipe.transform({ name: 'x' });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(BadRequestException);
      const response = (thrown as BadRequestException).getResponse() as Record<string, unknown>;
      expect(response.code).toBe('VALIDATION_ERROR');
      expect(response.message).toBe('Validation failed');
    });

    it('should map nested field paths with dot notation', () => {
      const schema = z.object({
        user: z.object({ email: z.string().email() }),
      });
      const pipe = new ZodValidationPipe(schema);

      let thrown: unknown;
      try {
        pipe.transform({ user: { email: 'not-an-email' } });
      } catch (error) {
        thrown = error;
      }

      const response = (thrown as BadRequestException).getResponse() as {
        details: { errors: Array<{ field: string; message: string; code: string }> };
      };
      const firstError = response.details.errors[0]!;
      expect(firstError.field).toBe('user.email');
      expect(firstError.code).toBe('invalid_string');
      expect(firstError.message).toContain('email');
    });

    it('should report every failing field in the details', () => {
      const schema = z.object({ name: z.string(), age: z.number() });
      const pipe = new ZodValidationPipe(schema);

      let thrown: unknown;
      try {
        pipe.transform({ name: 123, age: 'nope' });
      } catch (error) {
        thrown = error;
      }

      const response = (thrown as BadRequestException).getResponse() as {
        details: { errors: unknown[] };
      };
      expect(response.details.errors.length).toBe(2);
    });

    it('should rethrow non-Zod errors untouched', () => {
      const boom = new Error('boom');
      const fakeSchema = {
        parse: () => {
          throw boom;
        },
      } as unknown as ZodSchema;
      const pipe = new ZodValidationPipe(fakeSchema);

      expect(() => pipe.transform({})).toThrow('boom');
    });
  });
});
