module.exports = [
    {
        ignores: ["node_modules/**"],
    },

    // Backend : Node.js en CommonJS (src/, fichiers de config à la racine)
    {
        files: ["src/**/*.js", "*.js"],
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

    // Frontend : modules ES natifs, exécutés dans le navigateur
    {
        files: ["public/js/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                window: "readonly",
                document: "readonly",
                localStorage: "readonly",
                fetch: "readonly",
                console: "readonly",
                alert: "readonly",
                prompt: "readonly",
                navigator: "readonly",
            },
        },
        rules: {
            "no-unused-vars": "warn",
        },
    },
];