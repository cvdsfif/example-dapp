export default {
    preset: "ts-jest",
    testEnvironment: "@happy-dom/jest-environment",
    roots: ['<rootDir>/tests'],
    testMatch: ['**/*.test.ts', '**/*.test.tsx'],
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                tsconfig: './tsconfig.app.json'
            }
        ]
    },
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1"
    },
    verbose: true,
    collectCoverage: true,
    collectCoverageFrom: ['!tests/*', '!**/dist/**/*', '!tests/**/*', '!src/contracts/**/*'],
    coverageReporters: ['json-summary', 'text'],
}