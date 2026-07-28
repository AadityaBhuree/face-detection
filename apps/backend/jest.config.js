module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s', '!**/*.module.ts', '!main.ts'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@common/(.*)$': '<rootDir>/common/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@ayutalk/shared-schemas$': '<rootDir>/../../../packages/shared-schemas/src/index.ts',
    '^@ayutalk/shared-types$': '<rootDir>/../../../packages/shared-types/src/index.ts',
    '^@ayutalk/shared-utils$': '<rootDir>/../../../packages/shared-utils/src/index.ts',
    '^@prisma/client$': '<rootDir>/../node_modules/@prisma/client',
  },
};
