const SITE_ORIGIN = "https://snahasishpaul7-design.github.io";
const REPOSITORY = "snahasishpaul7-design/my-portfolio";
const BRANCH = "main";
const MANIFEST_PATH = "assets/certificates/public-certificates.json";
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const FILE_TYPES = new Map([
  ["application/pdf", { extension: "pdf", icon: "PDF" }],
  ["image/png", { extension: "png", icon: "IMG" }],
  ["image/jpeg", { extension: "jpg", icon: "IMG" }],
  ["image/webp", { extension: "webp", icon: "IMG" }],
]);

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function reply(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function secureMatch(candidate, expected) {
  if (!candidate || !expected || candidate.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i += 1) difference |= candidate.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

function decodeBase64Utf8(value) {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeUtf8Base64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function githubRequest(path, init, token) {
  const [filePath, query] = path.split("?");
  const encodedPath = encodeURIComponent(filePath).replaceAll("%2F", "/");
  const queryString = query ? `?${query}` : "";
  return fetch(`https://api.github.com/repos/${REPOSITORY}/contents/${encodedPath}${queryString}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Tonmoy-Portfolio-Certificate-Uploader",
      ...(init?.headers || {}),
    },
  });
}

async function putRepositoryFile(path, base64, message, env, sha) {
  const response = await githubRequest(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: base64,
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    }),
  }, env.GITHUB_TOKEN);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub rejected a certificate file update (${response.status}): ${detail.slice(0, 300)}`);
  }
  return response.json();
}

async function readManifest(env) {
  const response = await githubRequest(`${MANIFEST_PATH}?ref=${BRANCH}`, { method: "GET" }, env.GITHUB_TOKEN);
  if (response.status === 404) return { certificates: [], sha: undefined };
  if (!response.ok) throw new Error(`Could not load the public certificate list (${response.status}).`);
  const file = await response.json();
  const certificates = JSON.parse(decodeBase64Utf8(file.content));
  if (!Array.isArray(certificates)) throw new Error("The public certificate list has an invalid format.");
  return { certificates, sha: file.sha };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (origin !== SITE_ORIGIN) return new Response("Origin not allowed", { status: 403 });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method !== "POST") return reply({ error: "Use POST to publish a certificate." }, 405, origin);
    if (!env.GITHUB_TOKEN || !env.UPLOAD_PASSWORD) return reply({ error: "The secure uploader is not configured yet." }, 503, origin);

    const suppliedPassword = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!secureMatch(suppliedPassword, env.UPLOAD_PASSWORD)) return reply({ error: "Upload password is incorrect." }, 401, origin);

    const pathname = new URL(request.url).pathname.replace(/\/+$/, "");
    if (pathname === "/authorize") return reply({ authorized: true }, 200, origin);
    if (pathname !== "") return reply({ error: "Not found." }, 404, origin);

    let data;
    try {
      data = await request.json();
    } catch {
      return reply({ error: "The upload details could not be read." }, 400, origin);
    }

    const title = String(data.title || "").trim().slice(0, 90);
    const issuer = String(data.issuer || "Certificate").trim().slice(0, 70) || "Certificate";
    const description = String(data.description || "").trim().slice(0, 180);
    const date = /^\d{4}-\d{2}$/.test(data.date || "") ? data.date : "";
    const type = FILE_TYPES.get(data.mimeType);
    const base64 = String(data.fileContentBase64 || "").replace(/\s/g, "");
    if (!title || !type || !/^[A-Za-z0-9._ -]{1,160}$/.test(data.fileName || "")) {
      return reply({ error: "Enter a title and choose a PDF, PNG, JPG, or WebP file." }, 400, origin);
    }
    if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return reply({ error: "The selected file is invalid." }, 400, origin);
    const fileBytes = Math.floor((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
    if (fileBytes < 1 || fileBytes > MAX_FILE_BYTES) return reply({ error: "Choose a file smaller than 8 MB." }, 413, origin);

    try {
      const id = `public-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const file = `assets/certificates/uploads/${id}.${type.extension}`;
      const certificate = {
        id,
        title,
        issuer,
        date,
        description,
        file,
        ...(data.mimeType.startsWith("image/") ? { preview: file } : {}),
        icon: type.icon,
      };

      await putRepositoryFile(file, base64, `Add certificate: ${title}`, env);

      const manifest = await readManifest(env);
      const certificates = [certificate, ...manifest.certificates];
      await putRepositoryFile(
        MANIFEST_PATH,
        encodeUtf8Base64(JSON.stringify(certificates, null, 2)),
        `Update public certificates: ${title}`,
        env,
        manifest.sha,
      );
      return reply({ certificate }, 201, origin);
    } catch (error) {
      return reply({ error: error.message || "Could not publish this certificate." }, 502, origin);
    }
  },
};

