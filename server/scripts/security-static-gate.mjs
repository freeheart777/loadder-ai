import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../../", import.meta.url).pathname);
const allowedExt = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".json", ".yml", ".yaml", ".sh"]);
const ignored = new Set(["node_modules", ".git", "dist", "build", "coverage"]);
const findings = [];

const rules = [
  { id: "DYNAMIC_EVAL", re: /\beval\s*\(|\bnew\s+Function\s*\(/g, severity: "high" },
  { id: "SHELL_EXEC", re: /from\s+["']node:child_process["']|require\s*\(\s*["']child_process["']\s*\)|\bexecSync?\s*\(|\bspawnSync?\s*\(/g, severity: "review" },
  { id: "REMOTE_SHELL", re: /\b(curl|wget)\b[^\n]*(\||&&|;)[^\n]*(sh|bash|node|python)/gi, severity: "high" },
  { id: "ENCODED_EXEC", re: /Buffer\.from\([^\n]+["']base64["'][^\n]*\)[^\n]*(eval|Function|exec|spawn)/g, severity: "high" },
  { id: "PRIVATE_KEY", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, severity: "critical" },
  { id: "SUSPICIOUS_TOKEN", re: /(?:api[_-]?key|secret|token)\s*[:=]\s*["'][A-Za-z0-9_\-]{32,}["']/gi, severity: "review" },
];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (allowedExt.has(path.extname(entry.name))) scan(full);
  }
}

function scan(file) {
  const rel = path.relative(root, file);
  const text = fs.readFileSync(file, "utf8");
  for (const rule of rules) {
    rule.re.lastIndex = 0;
    let match;
    while ((match = rule.re.exec(text))) {
      const line = text.slice(0, match.index).split("\n").length;
      findings.push({ rule: rule.id, severity: rule.severity, file: rel, line, sample: match[0].slice(0, 140) });
      if (match.index === rule.re.lastIndex) rule.re.lastIndex++;
    }
  }
}

function inspectLifecycle(packagePath) {
  if (!fs.existsSync(packagePath)) return;
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  for (const name of ["preinstall", "install", "postinstall", "prepare"]) {
    if (pkg.scripts?.[name]) findings.push({ rule: "PACKAGE_LIFECYCLE_SCRIPT", severity: "review", file: path.relative(root, packagePath), line: 1, sample: `${name}: ${pkg.scripts[name]}` });
  }
}

walk(root);
inspectLifecycle(path.join(root, "package.json"));
inspectLifecycle(path.join(root, "server", "package.json"));

const blockers = findings.filter((x) => x.severity === "critical" || x.severity === "high");
console.log(JSON.stringify({ ok: blockers.length === 0, blockerCount: blockers.length, findings }, null, 2));
if (blockers.length) process.exit(1);
