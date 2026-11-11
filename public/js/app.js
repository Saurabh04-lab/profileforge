
"use strict";

// ==========================================
// PROFILEFORGE
// FRONTEND + POSTGRESQL INTEGRATION
// ==========================================

const API_URL = "/api/profiles";

const form = document.getElementById("profileForm");

const elements = {
    fullName: document.getElementById("fullName"),
    headline: document.getElementById("headline"),
    bio: document.getElementById("bio"),
    bioCount: document.getElementById("bioCount"),

    skillInput: document.getElementById("skillInput"),
    skillList: document.getElementById("skillList"),
    addSkillButton: document.getElementById("addSkillButton"),

    avatarInput: document.getElementById("avatarInput"),
    uploadAvatar: document.getElementById("uploadAvatar"),

    previewAvatar: document.getElementById("previewAvatar"),
    previewName: document.getElementById("previewName"),
    previewHeadline: document.getElementById("previewHeadline"),
    previewBio: document.getElementById("previewBio"),
    previewSkills: document.getElementById("previewSkills"),
    previewSocials: document.getElementById("previewSocials"),
    profileCard: document.getElementById("profileCard"),

    toast: document.getElementById("toast"),

    resetButton: document.getElementById("resetButton"),
    copyButton: document.getElementById("copyButton"),
    downloadButton: document.getElementById("downloadButton"),

    generateButton: document.getElementById("generateButton"),
    saveProfileButton: document.getElementById("saveProfileButton"),
    cancelEditButton: document.getElementById("cancelEditButton"),

    savedProfilesList: document.getElementById("savedProfilesList"),
    savedProfileCount: document.getElementById("savedProfileCount"),
    databaseStatus: document.getElementById("databaseStatus"),
    refreshProfilesButton: document.getElementById("refreshProfilesButton")
};

const defaultSkills = [
    "JavaScript",
    "React",
    "Node.js",
    "UI/UX Design"
];

let skills = [...defaultSkills];
let avatarDataUrl = null;
let editingProfileId = null;
let toastTimer;

// ==========================================
// GENERAL HELPERS
// ==========================================

function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        elements.toast.classList.remove("show");
    }, 3000);
}

function getInitials(name) {
    const words = String(name || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (words.length === 0) return "PF";

    return words
        .slice(0, 2)
        .map(word => word.charAt(0).toUpperCase())
        .join("");
}

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

function getFieldValue(element) {
    return element.value.trim();
}

async function parseResponse(response) {
    return response.json().catch(() => ({
        success: false,
        message: "The server returned an invalid response."
    }));
}

function getSelectedTheme() {
    const selectedTheme = document.querySelector(
        'input[name="theme"]:checked'
    );

    return selectedTheme ? selectedTheme.value : "midnight";
}

function buildProfileData() {
    return {
        fullName: getFieldValue(elements.fullName),
        headline: getFieldValue(elements.headline),
        bio: getFieldValue(elements.bio),
        skills: [...skills],

        github: getFieldValue(
            document.getElementById("github")
        ),

        linkedin: getFieldValue(
            document.getElementById("linkedin")
        ),

        website: getFieldValue(
            document.getElementById("website")
        ),

        theme: getSelectedTheme(),
        avatar: avatarDataUrl
    };
}

// ==========================================
// SKILLS MANAGEMENT
// ==========================================

function renderSkills() {
    elements.skillList.replaceChildren();
    elements.previewSkills.replaceChildren();

    if (skills.length === 0) {
        const emptyMessage = document.createElement("span");

        emptyMessage.className = "no-skills";
        emptyMessage.textContent = "No skills added yet.";

        elements.previewSkills.appendChild(emptyMessage);
    }

    skills.forEach((skill, index) => {
        const chip = document.createElement("span");
        chip.className = "skill-chip";

        const chipText = document.createElement("span");
        chipText.textContent = skill;

        const removeButton = document.createElement("button");

        removeButton.type = "button";
        removeButton.textContent = "×";
        removeButton.setAttribute("aria-label", `Remove ${skill}`);

        removeButton.addEventListener("click", () => {
            skills.splice(index, 1);
            renderSkills();
        });

        chip.append(chipText, removeButton);
        elements.skillList.appendChild(chip);

        const previewChip = document.createElement("span");

        previewChip.className = "preview-skill";
        previewChip.textContent = skill;

        elements.previewSkills.appendChild(previewChip);
    });
}

function addSkill() {
    const skill = elements.skillInput.value.trim();

    if (!skill) {
        showToast("Please enter a skill first.");
        return;
    }

    if (skills.some(item => item.toLowerCase() === skill.toLowerCase())) {
        showToast("That skill has already been added.");
        return;
    }

    if (skills.length >= 10) {
        showToast("You can add a maximum of 10 skills.");
        return;
    }

    if (skill.length > 25) {
        showToast("Skill must not exceed 25 characters.");
        return;
    }

    skills.push(skill);

    elements.skillInput.value = "";

    renderSkills();
    elements.skillInput.focus();
}

elements.addSkillButton.addEventListener("click", addSkill);

elements.skillInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        event.preventDefault();
        addSkill();
    }
});

// ==========================================
// AVATAR MANAGEMENT
// ==========================================

function updateAvatar() {
    const initials = getInitials(
        getFieldValue(elements.fullName)
    );

    if (avatarDataUrl) {
        elements.uploadAvatar.replaceChildren();
        elements.previewAvatar.replaceChildren();

        const uploadImage = document.createElement("img");

        uploadImage.src = avatarDataUrl;
        uploadImage.alt = "Uploaded profile photo";

        const previewImage = uploadImage.cloneNode();

        previewImage.alt = "Profile preview photo";

        elements.uploadAvatar.appendChild(uploadImage);
        elements.previewAvatar.appendChild(previewImage);

    } else {
        elements.uploadAvatar.textContent = initials;
        elements.previewAvatar.textContent = initials;
    }
}

elements.avatarInput.addEventListener("change", event => {
    const file = event.target.files[0];

    if (!file) return;

    const validTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!validTypes.includes(file.type)) {
        showToast("Please select a JPG, PNG or WEBP image.");
        event.target.value = "";
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showToast("Your image must be smaller than 5 MB.");
        event.target.value = "";
        return;
    }

    const reader = new FileReader();

    reader.onload = () => {
        avatarDataUrl = reader.result;

        updateAvatar();

        showToast("Profile photo uploaded successfully.");
    };

    reader.onerror = () => {
        showToast("Unable to read the selected image.");
    };

    reader.readAsDataURL(file);
});

// ==========================================
// SOCIAL LINKS
// ==========================================

function updateSocialLinks() {
    elements.previewSocials.replaceChildren();

    const platforms = [
        {
            id: "github",
            label: "GitHub",
            shortName: "GH"
        },
        {
            id: "linkedin",
            label: "LinkedIn",
            shortName: "in"
        },
        {
            id: "website",
            label: "Website",
            shortName: "↗"
        }
    ];

    platforms.forEach(platform => {
        const value = getFieldValue(
            document.getElementById(platform.id)
        );

        if (!value) return;

        try {
            const url = new URL(value);

            if (!["http:", "https:"].includes(url.protocol)) {
                return;
            }

            const link = document.createElement("a");

            link.className = "social-link";
            link.href = url.href;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = platform.shortName;
            link.title = platform.label;

            elements.previewSocials.appendChild(link);

        } catch {
            // Invalid URLs are excluded from the preview.
        }
    });
}

// ==========================================
// THEME MANAGEMENT
// ==========================================

function updateTheme() {
    const theme = getSelectedTheme();

    elements.profileCard.classList.remove(
        "theme-midnight",
        "theme-ocean",
        "theme-sunset"
    );

    elements.profileCard.classList.add(`theme-${theme}`);
}

document.querySelectorAll('input[name="theme"]').forEach(input => {
    input.addEventListener("change", updateTheme);
});

// ==========================================
// LIVE PREVIEW
// ==========================================

function updatePreview() {
    const name = getFieldValue(elements.fullName);
    const headline = getFieldValue(elements.headline);
    const bio = getFieldValue(elements.bio);

    elements.previewName.textContent = name || "Your name";

    elements.previewHeadline.textContent =
        headline || "Your professional headline";

    elements.previewBio.textContent =
        bio || "Your introduction will appear here.";

    elements.bioCount.textContent = elements.bio.value.length;

    updateAvatar();
    updateSocialLinks();
    updateTheme();
}

[
    elements.fullName,
    elements.headline,
    elements.bio,
    document.getElementById("github"),
    document.getElementById("linkedin"),
    document.getElementById("website")
].forEach(element => {
    element.addEventListener("input", updatePreview);
});

// ==========================================
// INSTALL SERVER-GENERATED CARD
// ==========================================

function installServerGeneratedCard(cardHtml) {
    if (typeof cardHtml !== "string" || !cardHtml.trim()) {
        throw new Error("The server returned an empty profile card.");
    }

    const parser = new DOMParser();

    const parsedDocument = parser.parseFromString(
        cardHtml,
        "text/html"
    );

    const generatedCard = parsedDocument.body.querySelector(
        "article#profileCard"
    );

    if (!generatedCard || generatedCard.tagName !== "ARTICLE") {
        throw new Error("Invalid profile card received from server.");
    }

    elements.profileCard.className = generatedCard.className;
    elements.profileCard.innerHTML = generatedCard.innerHTML;

    elements.previewAvatar =
        elements.profileCard.querySelector("#previewAvatar");

    elements.previewName =
        elements.profileCard.querySelector("#previewName");

    elements.previewHeadline =
        elements.profileCard.querySelector("#previewHeadline");

    elements.previewBio =
        elements.profileCard.querySelector("#previewBio");

    elements.previewSkills =
        elements.profileCard.querySelector("#previewSkills");

    elements.previewSocials =
        elements.profileCard.querySelector("#previewSocials");

    const requiredElements = [
        elements.previewAvatar,
        elements.previewName,
        elements.previewHeadline,
        elements.previewBio,
        elements.previewSkills,
        elements.previewSocials
    ];

    if (requiredElements.some(element => !element)) {
        throw new Error("The generated profile card is incomplete.");
    }
}

// ==========================================
// GENERATE PREVIEW THROUGH NODE.JS
// ==========================================

async function generateProfileOnServer() {
    if (!form.reportValidity()) return;

    const originalButtonText = elements.generateButton.innerHTML;

    try {
        elements.generateButton.disabled = true;
        elements.generateButton.textContent = "Generating...";

        const response = await fetch(`${API_URL}/preview`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(buildProfileData())
        });

        const result = await parseResponse(response);

        if (!response.ok || !result.success) {
            throw new Error(
                result.errors
                    ? result.errors.join(" ")
                    : result.message
            );
        }

        installServerGeneratedCard(result.cardHtml);

        showToast("Profile preview generated by Node.js!");

    } catch (error) {
        console.error("Preview generation error:", error);
        showToast(error.message || "Unable to generate preview.");

    } finally {
        elements.generateButton.disabled = false;
        elements.generateButton.innerHTML = originalButtonText;
    }
}

form.addEventListener("submit", event => {
    event.preventDefault();
    generateProfileOnServer();
});

// ==========================================
// SAVE OR UPDATE PROFILE IN POSTGRESQL
// ==========================================

async function saveProfileToDatabase() {
    if (!form.reportValidity()) return;

    const isEditing = Boolean(editingProfileId);

    const originalButtonText = elements.saveProfileButton.innerHTML;

    try {
        elements.saveProfileButton.disabled = true;
        elements.saveProfileButton.textContent = "Saving...";

        const endpoint = isEditing
            ? `${API_URL}/${encodeURIComponent(editingProfileId)}`
            : API_URL;

        const response = await fetch(endpoint, {
            method: isEditing ? "PUT" : "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(buildProfileData())
        });

        const result = await parseResponse(response);

        if (!response.ok || !result.success) {
            throw new Error(
                result.errors
                    ? result.errors.join(" ")
                    : result.message
            );
        }

        installServerGeneratedCard(result.cardHtml);

        editingProfileId = null;

        updateEditMode();

        await loadSavedProfiles();

        showToast(
            isEditing
                ? "Profile updated successfully!"
                : "Profile saved to PostgreSQL!"
        );

    } catch (error) {
        console.error("Profile saving error:", error);
        showToast(error.message || "Unable to save profile.");

    } finally {
        elements.saveProfileButton.disabled = false;
        elements.saveProfileButton.innerHTML = originalButtonText;
        updateEditMode();
    }
}

elements.saveProfileButton.addEventListener(
    "click",
    saveProfileToDatabase
);

// ==========================================
// EDIT MODE
// ==========================================

function updateEditMode() {
    const isEditing = Boolean(editingProfileId);

    elements.saveProfileButton.innerHTML = isEditing
        ? "↻ Update profile"
        : "<span>↓</span> Save profile";

    elements.cancelEditButton.hidden = !isEditing;
}

async function editSavedProfile(id) {
    try {
        showToast("Loading profile...");

        const response = await fetch(
            `${API_URL}/${encodeURIComponent(id)}`
        );

        const result = await parseResponse(response);

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Unable to load profile.");
        }

        const profile = result.profile;

        elements.fullName.value = profile.fullName || "";
        elements.headline.value = profile.headline || "";
        elements.bio.value = profile.bio || "";

        document.getElementById("github").value =
            profile.socials?.github || "";

        document.getElementById("linkedin").value =
            profile.socials?.linkedin || "";

        document.getElementById("website").value =
            profile.socials?.website || "";

        skills = Array.isArray(profile.skills)
            ? [...profile.skills]
            : [];

        avatarDataUrl = profile.avatarDataUrl || null;

        elements.avatarInput.value = "";

        const themeOption = document.querySelector(
            `input[name="theme"][value="${profile.theme}"]`
        );

        if (themeOption) {
            themeOption.checked = true;
        }

        editingProfileId = String(profile.id);

        renderSkills();
        updatePreview();
        installServerGeneratedCard(result.cardHtml);
        updateEditMode();

        showToast("Profile loaded. You can now edit it.");

        document.getElementById("builder").scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } catch (error) {
        console.error("Profile loading error:", error);
        showToast(error.message || "Unable to load profile.");
    }
}

// ==========================================
// CANCEL EDITING
// ==========================================

function resetEditor() {
    form.reset();

    skills = [...defaultSkills];
    avatarDataUrl = null;
    editingProfileId = null;

    elements.avatarInput.value = "";
    elements.skillInput.value = "";

    renderSkills();
    updatePreview();
    updateEditMode();
}

elements.cancelEditButton.addEventListener("click", () => {
    resetEditor();
    showToast("Editing cancelled.");
});

elements.resetButton.addEventListener("click", () => {
    const confirmed = window.confirm(
        "Reset your profile to the original sample details?"
    );

    if (!confirmed) return;

    resetEditor();

    showToast("Profile has been reset.");
});

// ==========================================
// DELETE SAVED PROFILE
// ==========================================

async function deleteSavedProfile(id, name) {
    const confirmed = window.confirm(
        `Are you sure you want to delete "${name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
        const response = await fetch(
            `${API_URL}/${encodeURIComponent(id)}`,
            {
                method: "DELETE"
            }
        );

        const result = await parseResponse(response);

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Unable to delete profile.");
        }

        if (String(editingProfileId) === String(id)) {
            resetEditor();
        }

        await loadSavedProfiles();

        showToast("Profile deleted successfully.");

    } catch (error) {
        console.error("Profile deletion error:", error);
        showToast(error.message || "Unable to delete profile.");
    }
}

// ==========================================
// FORMAT DATE
// ==========================================

function formatDate(value) {
    if (!value) return "Date unavailable";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Date unavailable";
    }

    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

// ==========================================
// CREATE SAVED PROFILE GALLERY CARD
// ==========================================

function createGalleryCard(profile) {
    const card = document.createElement("article");
    card.className = "gallery-card";

    // Profile heading
    const top = document.createElement("div");
    top.className = "gallery-card-top";

    const avatar = document.createElement("div");
    avatar.className = "gallery-avatar";
    avatar.textContent = getInitials(profile.fullName);

    const identity = document.createElement("div");
    identity.className = "gallery-identity";

    const name = document.createElement("h3");
    name.textContent = profile.fullName;

    const headline = document.createElement("p");
    headline.textContent = profile.headline || "No headline added";

    identity.append(name, headline);
    top.append(avatar, identity);

    // Bio
    const description = document.createElement("p");
    description.className = "gallery-description";
    description.textContent = profile.bio || "No biography provided.";

    // Theme and date
    const meta = document.createElement("div");
    meta.className = "gallery-meta";

    const theme = document.createElement("span");
    theme.className = "gallery-theme";
    theme.textContent = profile.theme || "midnight";

    const date = document.createElement("span");
    date.className = "gallery-date";
    date.textContent = `Created ${formatDate(profile.createdAt)}`;

    meta.append(theme, date);

    // Skills
    const skillContainer = document.createElement("div");
    skillContainer.className = "gallery-skills";

    const profileSkills = Array.isArray(profile.skills)
        ? profile.skills
        : [];

    profileSkills.slice(0, 4).forEach(skill => {
        const chip = document.createElement("span");

        chip.className = "gallery-skill";
        chip.textContent = skill;

        skillContainer.appendChild(chip);
    });

    if (profileSkills.length > 4) {
        const extra = document.createElement("span");

        extra.className = "gallery-skill";
        extra.textContent = `+${profileSkills.length - 4}`;

        skillContainer.appendChild(extra);
    }

    // Action buttons
    const actions = document.createElement("div");
    actions.className = "gallery-actions";

    const editButton = document.createElement("button");

    editButton.type = "button";
    editButton.className = "edit-profile-button";
    editButton.textContent = "✎ Edit";

    editButton.addEventListener("click", () => {
        editSavedProfile(profile.id);
    });

    const deleteButton = document.createElement("button");

    deleteButton.type = "button";
    deleteButton.className = "delete-profile-button";
    deleteButton.textContent = "× Delete";

    deleteButton.addEventListener("click", () => {
        deleteSavedProfile(profile.id, profile.fullName);
    });

    actions.append(editButton, deleteButton);

    card.append(
        top,
        description,
        meta,
        skillContainer,
        actions
    );

    return card;
}

// ==========================================
// LOAD SAVED PROFILES FROM POSTGRESQL
// ==========================================

async function loadSavedProfiles() {
    elements.savedProfilesList.setAttribute("aria-busy", "true");

    try {
        const response = await fetch(API_URL);

        const result = await parseResponse(response);

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Unable to retrieve saved profiles."
            );
        }

        const profiles = Array.isArray(result.profiles)
            ? result.profiles
            : [];

        elements.savedProfilesList.replaceChildren();

        elements.savedProfileCount.textContent = String(
            profiles.length
        );

        if (profiles.length === 0) {
            const emptyState = document.createElement("div");

            emptyState.className = "gallery-empty";

            emptyState.textContent =
                "No saved profiles yet. Create your first profile and click Save Profile.";

            elements.savedProfilesList.appendChild(emptyState);

        } else {
            profiles.forEach(profile => {
                elements.savedProfilesList.appendChild(
                    createGalleryCard(profile)
                );
            });
        }

        return profiles;

    } catch (error) {
        console.error("Gallery loading error:", error);

        elements.savedProfileCount.textContent = "Unavailable";

        const errorState = document.createElement("div");

        errorState.className = "gallery-empty";
        errorState.textContent =
            "Unable to load profiles. Check your database connection and refresh.";

        elements.savedProfilesList.replaceChildren(errorState);

        showToast(error.message || "Unable to load saved profiles.");

        return [];

    } finally {
        elements.savedProfilesList.removeAttribute("aria-busy");
    }
}

elements.refreshProfilesButton.addEventListener("click", async () => {
    elements.refreshProfilesButton.disabled = true;
    elements.refreshProfilesButton.textContent = "Refreshing...";

    await loadSavedProfiles();

    elements.refreshProfilesButton.disabled = false;
    elements.refreshProfilesButton.textContent = "↻ Refresh";

    showToast("Saved profiles refreshed.");
});

// ==========================================
// DATABASE CONNECTION STATUS
// ==========================================

async function checkDatabaseStatus() {
    try {
        const response = await fetch("/api/health");
        const result = await parseResponse(response);

        if (response.ok && result.success && result.database === "connected") {
            elements.databaseStatus.textContent = "Connected";
            return true;
        }

        elements.databaseStatus.textContent = "Disconnected";
        return false;

    } catch (error) {
        console.error("Database status error:", error);

        elements.databaseStatus.textContent = "Unavailable";

        return false;
    }
}

// ==========================================
// COPY PROFILE TEXT
// ==========================================

elements.copyButton.addEventListener("click", async () => {
    const socialData = [
        ["GitHub", "github"],
        ["LinkedIn", "linkedin"],
        ["Website", "website"]
    ]
        .map(([label, id]) => {
            const value = getFieldValue(
                document.getElementById(id)
            );

            return value ? `${label}: ${value}` : null;
        })
        .filter(Boolean);

    const profileText = [
        getFieldValue(elements.fullName),
        getFieldValue(elements.headline),
        getFieldValue(elements.bio),
        "",
        "Skills: " + skills.join(", "),
        ...socialData
    ].filter(Boolean).join("\n");

    try {
        await navigator.clipboard.writeText(profileText);

        showToast("Profile text copied to clipboard!");

    } catch {
        showToast("Clipboard access is unavailable in this browser.");
    }
});

// ==========================================
// EXPORT PROFILE AS HTML
// ==========================================

elements.downloadButton.addEventListener("click", () => {
    const name = escapeHTML(
        getFieldValue(elements.fullName) || "Your name"
    );

    const headline = escapeHTML(
        getFieldValue(elements.headline) || "Professional"
    );

    const bio = escapeHTML(
        getFieldValue(elements.bio)
    );

    const theme = getSelectedTheme();

    const themeColors = {
        midnight: ["#202039", "#7457df"],
        ocean: ["#083c50", "#239ca6"],
        sunset: ["#522e59", "#ee927b"]
    };

    const colors = themeColors[theme];

    const skillsHTML = skills.map(skill => `
        <span class="skill">${escapeHTML(skill)}</span>
    `).join("");

    const socialFields = [
        ["GitHub", "github"],
        ["LinkedIn", "linkedin"],
        ["Website", "website"]
    ];

    const linksHTML = socialFields.map(([label, id]) => {
        const value = getFieldValue(
            document.getElementById(id)
        );

        if (!value) return "";

        try {
            const url = new URL(value);

            if (!["http:", "https:"].includes(url.protocol)) {
                return "";
            }

            return `
                <a href="${escapeHTML(url.href)}"
                   target="_blank"
                   rel="noopener noreferrer">${label}</a>
            `;

        } catch {
            return "";
        }
    }).join("");

    const avatarHTML = avatarDataUrl
        ? `<img src="${escapeHTML(avatarDataUrl)}" alt="Profile photo">`
        : `<span>${escapeHTML(getInitials(getFieldValue(elements.fullName)))}</span>`;

    const documentHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name} — Profile</title>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f1f0f8;font-family:Arial,sans-serif}
.card{width:100%;max-width:400px;background:white;border-radius:18px;overflow:hidden;box-shadow:0 20px 50px #29274a22}
.cover{height:125px;background:linear-gradient(120deg,${colors[0]},${colors[1]});display:flex;justify-content:flex-end;align-items:flex-end;padding:16px;color:#fff;font-weight:bold;letter-spacing:2px}
.main{padding:0 25px 25px}
.avatar{width:82px;height:82px;border:5px solid white;margin-top:-41px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:#8165ee;color:white;font-size:22px;font-weight:bold}
.avatar img{width:100%;height:100%;object-fit:cover}
h1{font-size:24px;margin:15px 0 5px;color:#26273d;overflow-wrap:anywhere}
h2{font-size:14px;font-weight:normal;color:#888;margin:0}
p{font-size:13px;color:#777;line-height:1.7;margin-top:18px}
h3{font-size:10px;letter-spacing:1.4px;color:#999;margin:23px 0 12px}
.skills{display:flex;flex-wrap:wrap;gap:7px}
.skill{font-size:11px;background:#f0edff;color:#7156db;padding:7px 10px;border-radius:5px}
.links{border-top:1px solid #eee;margin-top:22px;padding-top:16px;display:flex;gap:15px;flex-wrap:wrap}
.links a{font-size:12px;color:${colors[1]};text-decoration:none;font-weight:bold}
</style>
</head>
<body>
<article class="card">
<div class="cover">PROFILEFORGE.</div>
<div class="main">
<div class="avatar">${avatarHTML}</div>
<h1>${name}</h1>
<h2>${headline}</h2>
<p>${bio}</p>
<h3>EXPERTISE</h3>
<div class="skills">${skillsHTML}</div>
<div class="links">${linksHTML}</div>
</div>
</article>
</body>
</html>`;

    const blob = new Blob(
        [documentHTML],
        { type: "text/html;charset=utf-8" }
    );

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = "profileforge-card.html";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

    showToast("Your profile card HTML was exported!");
});

// ==========================================
// APPLICATION INITIALIZATION
// ==========================================

async function initializeApp() {
    renderSkills();
    updatePreview();

    await checkDatabaseStatus();
    await loadSavedProfiles();

    console.log("ProfileForge initialized.");
}

initializeApp();
