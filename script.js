const certificates = [
  {
    id: "ai-intro",
    title: "Introduction to Artificial Intelligence",
    issuer: "Simplilearn SkillUp",
    date: "2026-11",
    description: "Foundational course on core AI concepts and their real-world applications.",
    file: "assets/certificates/introduction-to-artificial-intelligence.pdf",
    preview: "assets/certificates/previews/introduction-to-artificial-intelligence.png",
    icon: "AI",
  },
  {
    id: "microsoft-learn",
    title: "Introduction to Generative AI and Agents",
    issuer: "Microsoft Learn",
    date: "2026-11",
    description: "A Microsoft Learn achievement covering generative AI concepts and AI agents.",
    file: "assets/certificates/microsoft-learn-achievement.pdf",
    preview: "assets/certificates/previews/microsoft-learn-achievement.png",
    icon: "ML",
  },
  {
    id: "ey-microsoft-ai-skills",
    title: "AI Skills Passport for Older Adults",
    issuer: "EY × Microsoft",
    date: "",
    description: "Completed the general and employability sections of a program offered by EY and Microsoft.",
    file: "assets/certificates/certificate-377448.pdf",
    preview: "assets/certificates/previews/certificate-377448.png",
    icon: "AI",
  },
  {
    id: "claude-101",
    title: "Claude Code 101",
    issuer: "Claude Academy",
    date: "2026-11",
    description: "Introductory Claude Code course badge for AI-assisted software workflows.",
    file: "assets/certificates/claude-code-101.pdf",
    preview: "assets/certificates/previews/claude-code-101.png",
    icon: "CC",
  },
  {
    id: "claude-action",
    title: "Claude Code in Action",
    issuer: "Claude Academy",
    date: "2026-11",
    description: "Course badge for practicing Claude Code in hands-on coding workflows.",
    file: "assets/certificates/claude-code-in-action.pdf",
    preview: "assets/certificates/previews/claude-code-in-action.png",
    icon: "CC",
  },
  {
    id: "python-basics",
    title: "Basics of Python",
    issuer: "UniAthena × Cambridge International Qualifications",
    date: "2026-11",
    description: "Course completion certificate for foundational Python programming.",
    file: "assets/certificates/cr641-certificate.pdf",
    preview: "assets/certificates/previews/cr641-certificate.png",
    icon: "PY",
  },
  {
    id: "opswat-cip",
    title: "Introduction to Critical Infrastructure Protection",
    issuer: "OPSWAT Academy",
    date: "2026-11",
    description: "Completed OPSWAT Academy’s introductory program on protecting critical infrastructure.",
    file: "assets/certificates/opswat-critical-infrastructure-protection.jpeg",
    preview: "assets/certificates/opswat-critical-infrastructure-protection.jpeg",
    icon: "CIP",
  },
];

const grid = document.querySelector("#certificate-grid");
const dialog = document.querySelector("#certificate-dialog");
const form = document.querySelector("#certificate-form");
const fileInput = document.querySelector("#cert-file");
const fileName = document.querySelector("#selected-file");
const formError = document.querySelector("#form-error");
const ownerPassword = document.querySelector("#cert-owner-password");
const publicUploadAuth = document.querySelector("#public-upload-auth");
const publicUploadStatus = document.querySelector("#public-upload-status");
const publicCertificateEndpoint = window.PORTFOLIO_UPLOAD_ENDPOINT || "";
const maxFileSize = 8 * 1024 * 1024;
const objectUrls = new Set();
let publicCertificates = [];
let revealObserver;

if (publicCertificateEndpoint) {
  publicUploadAuth.hidden = false;
  ownerPassword.required = true;
  publicUploadStatus.hidden = true;
}

function observeRevealItems(root = document) {
  if (!revealObserver) return;
  const items = root.querySelectorAll(".experience-section,.about,.work,.credentials,.contact,.experience-card,.project-card,.certificate-card");
  items.forEach((item, index) => {
    if (item.classList.contains("reveal-item")) return;
    item.classList.add("reveal-item");
    item.style.setProperty("--reveal-delay", `${(index % 4) * 75}ms`);
    revealObserver.observe(item);
  });
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Your browser does not support local certificate storage."));
      return;
    }
    const request = indexedDB.open("tonmoy-portfolio", 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("certificates")) {
        database.createObjectStore("certificates", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open browser storage."));
  });
}

async function storedCertificates(action, record) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("certificates", action === "getAll" ? "readonly" : "readwrite");
    const store = transaction.objectStore("certificates");
    const request = action === "getAll" ? store.getAll() : action === "delete" ? store.delete(record) : store.put(record);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not save your certificate."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error || new Error("Could not save your certificate."));
  });
}

async function loadPublicCertificates() {
  try {
    const response = await fetch("assets/certificates/public-certificates.json", { cache: "no-store" });
    if (!response.ok) return;
    const result = await response.json();
    if (Array.isArray(result)) {
      publicCertificates = result;
      await renderCertificates();
    }
  } catch {
    // The bundled certificates remain visible if no public manifest exists yet.
  }
}

function fileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Could not read the selected certificate."));
    reader.readAsDataURL(file);
  });
}

function formatMonth(value) {
  if (!value) return "";
  const parsed = new Date(`${value}-01T12:00:00`);
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(parsed);
}

async function renderCertificates() {
  const draw = (added = []) => {
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls.clear();
    const saved = added.map((certificate) => {
      const url = URL.createObjectURL(certificate.fileBlob);
      objectUrls.add(url);
      return { ...certificate, file: url, isAdded: true };
    });
    const all = [...saved, ...publicCertificates, ...certificates];
  grid.innerHTML = all.map((certificate) => {
      const preview = certificate.preview
        ? `<img src="${escapeHTML(certificate.preview)}" alt="Full preview of ${escapeHTML(certificate.title)}" loading="lazy" />`
        : certificate.fileBlob?.type?.startsWith("image/")
          ? `<img src="${escapeHTML(certificate.file)}" alt="${escapeHTML(certificate.title)}" loading="lazy" />`
          : `<iframe src="${escapeHTML(certificate.file)}#toolbar=0&navpanes=0&scrollbar=0" title="Preview of ${escapeHTML(certificate.title)}" loading="lazy"></iframe>`;
      const description = certificate.description || "A new learning milestone added to my ongoing education and skills portfolio.";
      return `
        <article class="certificate-card">
          <a class="cert-preview" href="${escapeHTML(certificate.file)}" target="_blank" rel="noreferrer" aria-label="Open full ${escapeHTML(certificate.title)}">
            ${preview}<span class="cert-preview-label">FULL CERTIFICATE ↗</span>
          </a>
          <div class="cert-body">
            <div class="cert-heading"><h3 class="cert-title">${escapeHTML(certificate.title)}</h3><span class="cert-icon" aria-hidden="true">${escapeHTML(certificate.icon || "✳")}</span></div>
            <p class="cert-issuer">${escapeHTML(certificate.issuer || "Certificate")}</p>
            <p class="cert-description">${escapeHTML(description)}</p>
            <div class="cert-date">${escapeHTML(formatMonth(certificate.date) || "LEARNING MILESTONE")}</div>
          </div>
          ${certificate.isAdded ? `<button class="cert-delete" type="button" data-delete="${escapeHTML(certificate.id)}" aria-label="Remove ${escapeHTML(certificate.title)}">REMOVE</button>` : ""}
        </article>`;
  }).join("");
    observeRevealItems(grid);
  };

  // Draw bundled certificates immediately; browser storage can load afterward.
  draw();
  try {
    draw(await storedCertificates("getAll"));
  } catch (error) {
    console.warn("Saved certificate uploads are unavailable in this browser.", error);
  }
}

document.querySelector("#add-certificate").addEventListener("click", () => {
  form.reset();
  fileName.textContent = "No file selected";
  formError.textContent = "";
  dialog.showModal();
  document.querySelector("#cert-name").focus();
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => dialog.close());
});

dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  fileName.textContent = file ? file.name : "No file selected";
  formError.textContent = "";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.textContent = "";
  const file = fileInput.files?.[0];
  if (!file) {
    formError.textContent = "Choose your certificate file first.";
    return;
  }
  if (!/^(application\/pdf|image\/(png|jpeg|webp))$/.test(file.type)) {
    formError.textContent = "Choose a PDF, PNG, JPG, or WebP file.";
    return;
  }
  if (file.size > maxFileSize) {
    formError.textContent = "This file is larger than 8 MB. Choose a smaller file.";
    return;
  }

  const data = new FormData(form);
  const record = {
    id: `added-${crypto.randomUUID()}`,
    title: data.get("title").trim(),
    issuer: data.get("issuer").trim() || "Certificate",
    date: data.get("date"),
    description: data.get("description").trim(),
    fileBlob: file,
    icon: file.type === "application/pdf" ? "PDF" : "IMG",
  };

  try {
    if (publicCertificateEndpoint) {
      const response = await fetch(publicCertificateEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerPassword.value}`,
        },
        body: JSON.stringify({
          title: record.title,
          issuer: record.issuer,
          date: record.date,
          description: record.description,
          fileName: file.name,
          mimeType: file.type,
          fileContentBase64: await fileAsBase64(file),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not publish this certificate.");
      publicCertificates.unshift(result.certificate);
      ownerPassword.value = "";
      dialog.close();
      await renderCertificates();
      return;
    }

    await storedCertificates("put", record);
    dialog.close();
    await renderCertificates();
  } catch (error) {
    formError.textContent = error.message || "Could not save this certificate. Please try again.";
  }
});

grid.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;
  try {
    await storedCertificates("delete", button.dataset.delete);
    await renderCertificates();
  } catch (error) {
    formError.textContent = error.message || "Could not remove this certificate.";
  }
});

const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#site-nav");
menuToggle.addEventListener("click", () => {
  const expanded = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!expanded));
  menuToggle.setAttribute("aria-label", expanded ? "Open navigation" : "Close navigation");
  navigation.classList.toggle("is-open", !expanded);
});
navigation.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
  navigation.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open navigation");
}));

const projectCards = [...document.querySelectorAll("#project-grid .project-card")];
document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
  const filter = button.dataset.filter;
  document.querySelectorAll("[data-filter]").forEach((item) => {
    item.setAttribute("aria-pressed", String(item === button));
  });
  projectCards.forEach((card) => {
    card.hidden = filter !== "all" && card.dataset.category !== filter;
  });
}));

async function showNewPublicRepositories() {
  try {
    const response = await fetch("https://api.github.com/users/snahasishpaul7-design/repos?type=owner&sort=updated&per_page=100");
    if (!response.ok) return;
    const repositories = await response.json();
    const known = new Set(projectCards.map((card) => card.href.replace(/\/$/, "").split("/").pop().toLowerCase()));
    const excluded = new Set(["project-simulator-group-6-", "webtech_versity", "my-portfolio"]);
    const additions = repositories.filter((repo) => !repo.fork && !repo.archived && !known.has(repo.name.toLowerCase()) && !excluded.has(repo.name.toLowerCase()));
    const grid = document.querySelector("#project-grid");
    additions.forEach((repo, index) => {
      const category = ["Python", "Jupyter Notebook"].includes(repo.language) ? "ai-data" : "apps";
      const card = document.createElement("a");
      card.className = "project-card new-repository";
      card.dataset.category = category;
      card.href = repo.html_url;
      card.target = "_blank";
      card.rel = "noreferrer";
      const description = repo.description || "Open this repository to explore the code and README for this project.";
      card.innerHTML = `<div class="project-art art-new"><div class="new-repo-mark">${escapeHTML((repo.language || "GH").slice(0, 3).toUpperCase())}</div><span class="art-label">NEW REPOSITORY</span></div><div class="project-info"><div><span class="project-type">${escapeHTML(repo.language || "GITHUB PROJECT")}</span><h3>${escapeHTML(repo.name.replace(/[-_]/g, " "))}</h3><p>${escapeHTML(description)}</p></div><span class="project-arrow" aria-hidden="true">↗</span></div><div class="project-tags"><span>${escapeHTML(repo.language || "GitHub")}</span><span>New work</span></div>`;
      grid.append(card);
    });
    document.querySelector("#project-count").textContent = String(document.querySelectorAll("#project-grid .project-card").length);
    const activeFilter = document.querySelector("[data-filter][aria-pressed='true']")?.dataset.filter || "all";
    document.querySelectorAll("#project-grid .project-card").forEach((card) => {
      card.hidden = activeFilter !== "all" && card.dataset.category !== activeFilter;
    });
  } catch {
    // Curated project cards remain visible if GitHub cannot be reached.
  }
}

document.querySelector("#year").textContent = new Date().getFullYear();
if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
  document.documentElement.classList.add("motion-ready");
  revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -35px 0px" });
  observeRevealItems();
}
renderCertificates();
loadPublicCertificates();
showNewPublicRepositories();

