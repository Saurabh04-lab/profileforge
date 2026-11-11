
const express = require("express");
const { pool } = require("../config/database");

const router = express.Router();

const ALLOWED_THEMES = ["midnight", "ocean", "sunset"];
const ALLOWED_IMAGE_TYPES = ["png", "jpeg", "webp"];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

// ==========================================
// AUTHENTICATION MIDDLEWARE
// ==========================================

router.use((req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({
            success: false,
            message: "Please sign in to access your profiles."
        });
    }

    next();
});

// ==========================================
// HTML ESCAPING
// ==========================================

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[character];
    });
}

// ==========================================
// TEXT VALIDATION
// ==========================================

function normalizeText(value, field, maxLength, errors, required = false) {
    if (value === undefined || value === null) {
        value = "";
    }

    if (typeof value !== "string") {
        errors.push(`${field} must be text.`);
        return "";
    }

    const normalized = value
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .trim();

    if (required && !normalized) {
        errors.push(`${field} is required.`);
    }

    if (normalized.length > maxLength) {
        errors.push(`${field} must not exceed ${maxLength} characters.`);
    }

    return normalized;
}

function getInitials(name) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(word => word.charAt(0).toUpperCase())
        .join("");
}

// ==========================================
// SOCIAL LINK VALIDATION
// ==========================================

function validateSocialUrl(value, field, errors) {
    const normalized = normalizeText(value, field, 500, errors);

    if (!normalized) return "";

    try {
        const url = new URL(normalized);

        if (!["http:", "https:"].includes(url.protocol)) {
            throw new Error("Invalid protocol");
        }

        if (!url.hostname || url.username || url.password) {
            throw new Error("Invalid URL");
        }

        return url.toString();

    } catch {
        errors.push(`${field} must be a valid HTTP or HTTPS URL.`);
        return "";
    }
}

// ==========================================
// AVATAR VALIDATION
// ==========================================

function validateAvatar(value, errors) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    if (typeof value !== "string") {
        errors.push("Avatar must be a valid image.");
        return null;
    }

    const match = value.match(
        /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/
    );

    if (!match || !ALLOWED_IMAGE_TYPES.includes(match[1])) {
        errors.push("Avatar must be a PNG, JPG or WEBP image.");
        return null;
    }

    const imageBuffer = Buffer.from(match[2], "base64");

    if (imageBuffer.length > MAX_AVATAR_BYTES) {
        errors.push("Avatar image must not exceed 5 MB.");
        return null;
    }

    return value;
}

// ==========================================
// SKILL PROCESSING
// ==========================================

function processSkills(value, errors) {
    if (value === undefined) return [];

    if (!Array.isArray(value)) {
        errors.push("Skills must be provided as an array.");
        return [];
    }

    if (value.length > 10) {
        errors.push("You can add a maximum of 10 skills.");
    }

    const result = [];
    const seen = new Set();

    value.slice(0, 10).forEach(item => {
        if (typeof item !== "string") {
            errors.push("Every skill must be text.");
            return;
        }

        const skill = item.trim();

        if (!skill) return;

        if (skill.length > 25) {
            errors.push("Each skill must not exceed 25 characters.");
            return;
        }

        const key = skill.toLowerCase();

        if (!seen.has(key)) {
            seen.add(key);
            result.push(skill);
        }
    });

    return result;
}

// ==========================================
// PROFILE VALIDATION
// ==========================================

function validateProfile(body) {
    const errors = [];

    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { errors: ["Invalid profile request."] };
    }

    const fullName = normalizeText(
        body.fullName,
        "Full name",
        60,
        errors,
        true
    );

    const headline = normalizeText(
        body.headline,
        "Professional headline",
        80,
        errors
    );

    const bio = normalizeText(
        body.bio,
        "Bio",
        240,
        errors
    );

    const skills = processSkills(body.skills, errors);

    const socials = {
        github: validateSocialUrl(body.github, "GitHub URL", errors),
        linkedin: validateSocialUrl(body.linkedin, "LinkedIn URL", errors),
        website: validateSocialUrl(body.website, "Website URL", errors)
    };

    const theme = body.theme === undefined
        ? "midnight"
        : body.theme;

    if (
        typeof theme !== "string" ||
        !ALLOWED_THEMES.includes(theme)
    ) {
        errors.push("Please select a valid profile theme.");
    }

    const avatarDataUrl = validateAvatar(body.avatar, errors);

    if (errors.length > 0) {
        return { errors };
    }

    return {
        errors: [],
        profile: {
            fullName,
            headline,
            bio,
            skills,
            socials,
            theme,
            avatarDataUrl
        }
    };
}

// ==========================================
// PROFILE HTML GENERATOR
// ==========================================

function generateProfileHTML(profile) {
    const name = escapeHTML(profile.fullName);

    const headline = escapeHTML(
        profile.headline || "Your professional headline"
    );

    const bio = escapeHTML(
        profile.bio || "Your introduction will appear here."
    );

    const initials = escapeHTML(
        getInitials(profile.fullName)
    );

    const avatarHTML = profile.avatarDataUrl
        ? `<img src="${escapeHTML(profile.avatarDataUrl)}" alt="Profile photo">`
        : initials;

    const skillsHTML = profile.skills.length
        ? profile.skills.map(skill => `
            <span class="preview-skill">${escapeHTML(skill)}</span>
        `).join("")
        : `<span class="no-skills">No skills added yet.</span>`;

    const platforms = [
        {
            name: "GitHub",
            shortName: "GH",
            url: profile.socials.github
        },
        {
            name: "LinkedIn",
            shortName: "in",
            url: profile.socials.linkedin
        },
        {
            name: "Website",
            shortName: "↗",
            url: profile.socials.website
        }
    ];

    const socialsHTML = platforms
        .filter(platform => platform.url)
        .map(platform => `
            <a class="social-link"
               href="${escapeHTML(platform.url)}"
               target="_blank"
               rel="noopener noreferrer"
               title="${platform.name}"
               aria-label="${platform.name}">
               ${platform.shortName}
            </a>
        `)
        .join("");

    return `
        <article class="profile-card theme-${profile.theme}" id="profileCard">
            <div class="card-cover">
                <div class="cover-orb orb-one"></div>
                <div class="cover-orb orb-two"></div>
                <div class="cover-brand">PROFILE<span>FORGE.</span></div>
            </div>

            <div class="card-main">
                <div class="preview-avatar" id="previewAvatar">
                    ${avatarHTML}
                </div>

                <div class="card-identity">
                    <div class="verified-label">
                        <span>✦</span> DIGITAL PROFILE
                    </div>
                    <h2 id="previewName">${name}</h2>
                    <p id="previewHeadline">${headline}</p>
                </div>

                <p class="preview-bio" id="previewBio">${bio}</p>

                <div class="card-divider"></div>

                <div class="preview-subheading">EXPERTISE</div>
                <div class="preview-skills" id="previewSkills">
                    ${skillsHTML}
                </div>

                <div class="card-divider"></div>

                <div class="card-footer">
                    <div class="preview-socials" id="previewSocials">
                        ${socialsHTML}
                    </div>
                    <span class="card-watermark">PF.</span>
                </div>
            </div>
        </article>
    `;
}

// ==========================================
// DATABASE HELPERS
// ==========================================

function validateId(value) {
    if (!/^\d+$/.test(value)) return null;

    const id = Number(value);

    return Number.isSafeInteger(id) && id > 0
        ? id
        : null;
}

function mapProfile(row, includeAvatar = false) {
    const profile = {
        id: String(row.id),
        fullName: row.full_name,
        headline: row.headline,
        bio: row.bio,
        skills: row.skills,
        socials: row.socials,
        theme: row.theme,
        hasAvatar: Boolean(row.avatar_data_url),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };

    if (includeAvatar) {
        profile.avatarDataUrl = row.avatar_data_url;
    }

    return profile;
}

async function insertProfile(ownerId, profile) {
    const result = await pool.query(
        `INSERT INTO profiles (
            owner_id,
            full_name,
            headline,
            bio,
            skills,
            socials,
            theme,
            avatar_data_url
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
            ownerId,
            profile.fullName,
            profile.headline,
            profile.bio,
            JSON.stringify(profile.skills),
            JSON.stringify(profile.socials),
            profile.theme,
            profile.avatarDataUrl
        ]
    );

    return result.rows[0];
}

async function updateProfile(ownerId, id, profile) {
    const result = await pool.query(
        `UPDATE profiles
         SET full_name = $1,
             headline = $2,
             bio = $3,
             skills = $4,
             socials = $5,
             theme = $6,
             avatar_data_url = $7,
             updated_at = NOW()
         WHERE id = $8 AND owner_id = $9
         RETURNING *`,
        [
            profile.fullName,
            profile.headline,
            profile.bio,
            JSON.stringify(profile.skills),
            JSON.stringify(profile.socials),
            profile.theme,
            profile.avatarDataUrl,
            id,
            ownerId
        ]
    );

    return result.rows[0] || null;
}

// ==========================================
// POST /api/profiles/preview
// ==========================================

router.post("/preview", (req, res) => {
    const result = validateProfile(req.body);

    if (result.errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: "Please correct your profile information.",
            errors: result.errors
        });
    }

    const profile = result.profile;

    return res.json({
        success: true,
        message: "Profile card generated successfully by the server.",
        profile: {
            fullName: profile.fullName,
            headline: profile.headline,
            bio: profile.bio,
            skills: profile.skills,
            socials: profile.socials,
            theme: profile.theme,
            hasAvatar: Boolean(profile.avatarDataUrl)
        },
        cardHtml: generateProfileHTML(profile),
        generatedAt: new Date().toISOString()
    });
});

// ==========================================
// POST /api/profiles
// ==========================================

router.post("/", async (req, res) => {
    try {
        const result = validateProfile(req.body);

        if (result.errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Please correct your profile information.",
                errors: result.errors
            });
        }

        const saved = await insertProfile(
            req.session.userId,
            result.profile
        );

        return res.status(201).json({
            success: true,
            message: "Profile created and saved successfully.",
            profile: mapProfile(saved, true),
            cardHtml: generateProfileHTML(result.profile)
        });

    } catch (error) {
        console.error("Profile creation error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to save your profile."
        });
    }
});

// ==========================================
// GET /api/profiles
// ==========================================

router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT *
             FROM profiles
             WHERE owner_id = $1
             ORDER BY created_at DESC`,
            [req.session.userId]
        );

        const profiles = result.rows.map(row => mapProfile(row));

        return res.json({
            success: true,
            total: profiles.length,
            profiles
        });

    } catch (error) {
        console.error("Profile retrieval error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve your profiles."
        });
    }
});

// ==========================================
// GET /api/profiles/:id
// ==========================================

router.get("/:id", async (req, res) => {
    try {
        const id = validateId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid profile ID."
            });
        }

        const result = await pool.query(
            `SELECT *
             FROM profiles
             WHERE id = $1 AND owner_id = $2`,
            [id, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Profile not found."
            });
        }

        const profile = mapProfile(result.rows[0], true);

        return res.json({
            success: true,
            profile,
            cardHtml: generateProfileHTML({
                fullName: profile.fullName,
                headline: profile.headline,
                bio: profile.bio,
                skills: profile.skills,
                socials: profile.socials,
                theme: profile.theme,
                avatarDataUrl: profile.avatarDataUrl
            })
        });

    } catch (error) {
        console.error("Single profile retrieval error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve this profile."
        });
    }
});

// ==========================================
// PUT /api/profiles/:id
// ==========================================

router.put("/:id", async (req, res) => {
    try {
        const id = validateId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid profile ID."
            });
        }

        const result = validateProfile(req.body);

        if (result.errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Please correct your profile information.",
                errors: result.errors
            });
        }

        const updated = await updateProfile(
            req.session.userId,
            id,
            result.profile
        );

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: "Profile not found."
            });
        }

        return res.json({
            success: true,
            message: "Profile updated successfully.",
            profile: mapProfile(updated, true),
            cardHtml: generateProfileHTML(result.profile)
        });

    } catch (error) {
        console.error("Profile update error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update your profile."
        });
    }
});

// ==========================================
// DELETE /api/profiles/:id
// ==========================================

router.delete("/:id", async (req, res) => {
    try {
        const id = validateId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid profile ID."
            });
        }

        const result = await pool.query(
            `DELETE FROM profiles
             WHERE id = $1 AND owner_id = $2
             RETURNING id`,
            [id, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Profile not found."
            });
        }

        return res.json({
            success: true,
            message: "Profile deleted successfully.",
            deletedId: String(result.rows[0].id)
        });

    } catch (error) {
        console.error("Profile deletion error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to delete profile."
        });
    }
});

module.exports = router;
