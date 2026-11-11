
require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const helmet = require("helmet");
const session = require("express-session");

const connectPgSimple = require("connect-pg-simple");

const profilesRouter = require("./routes/profiles");
const authRouter = require("./routes/auth");

const {
    pool,
    initializeDatabase,
    checkDatabaseConnection
} = require("./config/database");

const app = express();

const PORT = process.env.PORT || 3000;
const publicDirectory = path.join(__dirname, "public");
const dashboardPath = path.join(__dirname, "views", "dashboard.html");

const isVercel = process.env.VERCEL === "1";
const isProduction =
    process.env.NODE_ENV === "production" || isVercel;

const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
    throw new Error(
        "SESSION_SECRET must contain at least 32 characters."
    );
}

// ==========================================
// SERVER CONFIGURATION
// ==========================================

if (isProduction) {
    app.set("trust proxy", 1);
}

app.disable("x-powered-by");

// ==========================================
// SECURITY HEADERS
// ==========================================

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],

            scriptSrc: ["'self'"],

            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://fonts.googleapis.com"
            ],

            fontSrc: [
                "'self'",
                "https://fonts.gstatic.com",
                "data:"
            ],

            imgSrc: [
                "'self'",
                "data:"
            ],

            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"]
        }
    }
}));

// ==========================================
// BODY PARSING
// ==========================================

app.use(express.json({
    limit: "8mb"
}));

app.use(express.urlencoded({
    extended: true,
    limit: "8mb"
}));

// ==========================================
// DATABASE INITIALIZATION
// ==========================================

let databasePromise = null;

function ensureDatabase() {
    if (!databasePromise) {
        databasePromise = initializeDatabase()
            .then(() => {
                console.log("PostgreSQL initialized successfully.");
                return true;
            })
            .catch(error => {
                console.error(
                    "Database initialization failed:",
                    error.message
                );

                // Allow a subsequent invocation to retry.
                databasePromise = null;

                return false;
            });
    }

    return databasePromise;
}

// Every request must wait for the database schema.
app.use(async (req, res, next) => {
    try {
        const ready = await ensureDatabase();

        if (!ready) {
            return res.status(503).json({
                success: false,
                message: "Database temporarily unavailable."
            });
        }

        next();

    } catch (error) {
        next(error);
    }
});

// ==========================================
// POSTGRESQL SESSION STORE
// ==========================================

const PgSession = connectPgSimple(session);

app.use(session({
    name: "pf.sid",

    store: new PgSession({
        pool,
        tableName: "user_sessions",
        createTableIfMissing: true,
        pruneSessionInterval: 15 * 60
    }),

    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,

    cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/"
    }
}));

// ==========================================
// CSRF PROTECTION
// ==========================================

app.use("/api", (req, res, next) => {
    const mutatingMethods = [
        "POST",
        "PUT",
        "PATCH",
        "DELETE"
    ];

    if (!mutatingMethods.includes(req.method)) {
        return next();
    }

    const expected = req.session?.csrfToken;
    const supplied = req.get("X-CSRF-Token");

    if (
        typeof expected !== "string" ||
        typeof supplied !== "string"
    ) {
        return res.status(403).json({
            success: false,
            message: "Security validation failed."
        });
    }

    const expectedBuffer = Buffer.from(expected);
    const suppliedBuffer = Buffer.from(supplied);

    if (
        expectedBuffer.length !== suppliedBuffer.length ||
        !crypto.timingSafeEqual(
            expectedBuffer,
            suppliedBuffer
        )
    ) {
        return res.status(403).json({
            success: false,
            message: "Invalid security token."
        });
    }

    next();
});

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/api/health", async (req, res) => {
    try {
        const database = await checkDatabaseConnection();

        res.set("Cache-Control", "no-store");

        return res.json({
            success: true,
            message: "ProfileForge server is running!",
            database: "connected",
            databaseTime: database.database_time
        });

    } catch (error) {
        console.error("Health check error:", error.message);

        return res.status(503).json({
            success: false,
            message: "Database unavailable.",
            database: "disconnected"
        });
    }
});

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

app.use("/api/auth", authRouter);

// ==========================================
// PROFILE ROUTES
// ==========================================

app.use("/api/profiles", profilesRouter);

// ==========================================
// LOCAL STATIC FILE SERVING
// ==========================================

// Vercel serves public/** through its CDN.
// Express static serving is used only locally.

if (!isVercel) {
    app.use(express.static(publicDirectory, {
        index: false,
        dotfiles: "deny"
    }));
}

// ==========================================
// PROTECTED DASHBOARD
// ==========================================

async function sendDashboard(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.redirect(302, "/login.html");
    }

    try {
        let html = await fs.readFile(
            dashboardPath,
            "utf8"
        );

        const originalScript =
            '<script src="/js/app.js"></script>';

        const authenticatedScripts = `
            <script src="/js/auth-client.js"></script>
            <script src="/js/app.js"></script>
        `;

        if (!html.includes(originalScript)) {
            throw new Error(
                "Dashboard script insertion point not found."
            );
        }

        html = html.replace(
            originalScript,
            authenticatedScripts
        );

        res.set("Cache-Control", "no-store");

        return res.type("html").send(html);

    } catch (error) {
        next(error);
    }
}

app.get(["/", "/index.html"], sendDashboard);

// ==========================================
// UNKNOWN API ROUTES
// ==========================================

app.use("/api", (req, res) => {
    return res.status(404).json({
        success: false,
        message: "API endpoint not found."
    });
});

// ==========================================
// ERROR HANDLING
// ==========================================

app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    if (error.type === "entity.too.large") {
        return res.status(413).json({
            success: false,
            message: "Request too large."
        });
    }

    if (
        error instanceof SyntaxError &&
        error.status === 400
    ) {
        return res.status(400).json({
            success: false,
            message: "Invalid JSON request."
        });
    }

    console.error("Application error:", error);

    return res.status(500).json({
        success: false,
        message: "An unexpected error occurred."
    });
});

// ==========================================
// EXPORT EXPRESS APPLICATION FOR VERCEL
// ==========================================

module.exports = app;

// ==========================================
// LOCAL DEVELOPMENT SERVER
// ==========================================

if (require.main === module) {
    async function startLocalServer() {
        const ready = await ensureDatabase();

        if (!ready) {
            console.error(
                "Cannot start: database initialization failed."
            );

            process.exitCode = 1;
            return;
        }

        app.listen(PORT, "0.0.0.0", () => {
            console.log("-----------------------------------");
            console.log("       PROFILEFORGE SERVER");
            console.log("-----------------------------------");
            console.log(`Server: http://localhost:${PORT}`);
            console.log(`Health: http://localhost:${PORT}/api/health`);
            console.log("-----------------------------------");
        });
    }

    startLocalServer();
}
