import { mkdirSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, rmSync } from "node:fs";
import { dirname } from "node:path";
export function atomicWriteFile(target, body) { mkdirSync(dirname(target), { recursive: true, mode: 0o750 }); const temporary = `${target}.${process.pid}.${Date.now()}.tmp`; let fd; try { fd = openSync(temporary, "wx", 0o644); writeFileSync(fd, body, "utf8"); fsyncSync(fd); closeSync(fd); fd = undefined; renameSync(temporary, target); } catch (error) { if (fd !== undefined) closeSync(fd); rmSync(temporary, { force: true }); throw error; } }
