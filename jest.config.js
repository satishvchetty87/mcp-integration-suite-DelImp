module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	roots: ["<rootDir>/src"],
	testMatch: ["**/__tests__/**/*.(spec|test).ts"],
	transform: {
		"^.+\\.ts$": "ts-jest",
	},
	moduleFileExtensions: ["ts", "js", "json", "node"],
	collectCoverage: true,
	coverageDirectory: "coverage",
	coverageReporters: ["text", "lcov"],
	verbose: true,
	// Map only the @generated alias to the compiled output in dist/generated for Jest
	moduleNameMapper: {
		'^@generated/(.*)$': '<rootDir>/dist/generated/$1'
	}
};
