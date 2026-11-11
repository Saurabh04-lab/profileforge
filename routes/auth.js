
const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { rateLimit } = require("express-rate-limit");
const { pool } = require("../config/database");

const router = express.Router();

// ==========================================
// RATE LIMIT AUTHENTICATION REQUESTS
// ==========================================

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many login attempts. Please try again later."
    }
});

const registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many registration attempts. Please try again later."
    }
});

// ==========================================
// SESSION HELPERS
// ==========================================

function saveSession(req) {
    return new Promise((resolve, reject) => {
        req.session.save(error => {
            if (error) reject(error);
            else resolve();
        });
    });
}

function regenerateSession(req) {
    return new Promise((resolve, reject) => {
        req.session.regenerate(error => {
            if (error) reject(error);
            else resolve();
        });
    });
}

function publicUser(user) {
    return {
        id: String(user.id),
        name: user.name,
        email: user.email
    };
}

async function establishSession(req, user) {
    await regenerateSession(req);

    req.session.userId = Number(user.id);
    req.session.user = publicUser(user);
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");

    await saveSession(req);

    return {
        user: req.session.user,
        csrfToken: req.session.csrfToken
    };
}

// ==========================================
// GET /api/auth/me
// CURRENT USER AND CSRF TOKEN
// ==========================================

router.get("/me", async (req, res) => {
    try {
        if (!req.session.csrfToken) {
            req.session.csrfToken = crypto.randomBytes(32).toString("hex");
            await saveSession(req);
        }

        res.set("Cache-Control", "no-store");

        return res.json({
            success: true,
            authenticated: Boolean(req.session.userId),
            user: req.session.user || null,
            csrfToken: req.session.csrfToken
        });

    } catch (error) {
        console.error("Session check error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to check your account session."
        });
    }
});

// ==========================================
// POST /api/auth/register
// CREATE ACCOUNT
// ==========================================

router.post("/register", registrationLimiter, async (req, res) => {
    const body = req.body || {};

    const name = typeof body.name === "string"
        ? body.name.trim()
        : "";

    const email = typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password = typeof body.password === "string"
        ? body.password
        : "";

    if (!name || name.length > 60) {
        return res.status(400).json({
            success: false,
            message: "Name is required and must not exceed 60 characters."
        });
    }

    if (
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
        return res.status(400).json({
            success: false,
            message: "Enter a valid email address."
        });
    }

    if (password.length < 10 || Buffer.byteLength(password, "utf8") > 72) {
        return res.status(400).json({
            success: false,
            message: "Password must contain at least 10 characters and no more than 72 UTF-8 bytes."
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Serialize first-account creation so only one account
        // can claim legacy profiles during initial registration.
        await client.query(
            "SELECT pg_advisory_xact_lock($1)",
            [73628194]
        );

        const countResult = await client.query(
            "SELECT COUNT(*)::int AS total FROM users"
        );

        const isFirstUser = countResult.rows[0].total === 0;

        const existing = await client.query(
            "SELECT id FROM users WHERE LOWER(email) = $1",
            [email]
        );

        if (existing.rows.length > 0) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const inserted = await client.query(
            `INSERT INTO users (name, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, name, email`,
            [name, email, passwordHash]
        );

        const user = inserted.rows[0];

        // Preserve existing profiles by assigning unowned
        // legacy profiles to the first registered account.
        if (isFirstUser) {
            await client.query(
                "UPDATE profiles SET owner_id = $1 WHERE owner_id IS NULL",
                [user.id]
            );
        }

        await client.query("COMMIT");

        const session = await establishSession(req, user);

        return res.status(201).json({
            success: true,
            message: "Your account was created successfully.",
            user: session.user,
            csrfToken: session.csrfToken
        });

    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch {
            // Transaction may already have been completed.
        }

        console.error("Registration error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to create your account."
        });

    } finally {
        client.release();
    }
});

// ==========================================
// POST /api/auth/login
// SIGN IN
// ==========================================

router.post("/login", loginLimiter, async (req, res) => {
    try {
        const body = req.body || {};

        const email = typeof body.email === "string"
            ? body.email.trim().toLowerCase()
            : "";

        const password = typeof body.password === "string"
            ? body.password
            : "";

        if (!email || !password || password.length > 72) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const result = await pool.query(
            `SELECT id, name, email, password_hash
             FROM users
             WHERE LOWER(email) = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const user = result.rows[0];

        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const session = await establishSession(req, user);

        return res.json({
            success: true,
            message: "Login successful.",
            user: session.user,
            csrfToken: session.csrfToken
        });

    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to sign in right now."
        });
    }
});

// ==========================================
// POST /api/auth/logout
// SIGN OUT
// ==========================================

router.post("/logout", (req, res) => {
    req.session.destroy(error => {
        if (error) {
            console.error("Logout error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to sign out."
            });
        }

        res.clearCookie("pf.sid", {
            path: "/",
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax"
        });

        return res.json({
            success: true,
            message: "You have been signed out."
        });
    });
});

module.exports = router;
