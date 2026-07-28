module.exports = [
    {
        ignores: ["node_modules/**"],
    },
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "commonjs",
            globals: {
                require: "readonly",
                module: "writable",
                exports: "writable",
                process: "readonly",
                console: "readonly",
                __dirname: "readonly",
                __filename: "readonly",
                fetch: "readonly",
                // Globales injectées par Jest dans les fichiers de test
                describe: "readonly",
                it: "readonly",
                test: "readonly",
                expect: "readonly",
                beforeAll: "readonly",
                afterAll: "readonly",
                beforeEach: "readonly",
                afterEach: "readonly",
            },
        },
        rules: {
            "no-unused-vars": "warn",
        },
    },
];