import path from "path";
import fs from "fs";

// Shared projPath - single source of truth
export const projPath = path.resolve(__dirname, "..", "..");

// Shared logging - no circular dependencies
const log_file = fs.createWriteStream(path.resolve(projPath, "serverlog.txt"), {
    flags: "a", encoding: "utf-8", mode: 0o666,
});
const err_log_file = fs.createWriteStream(path.resolve(projPath, "errorlog.txt"), {
    flags: "a", encoding: "utf-8", mode: 0o666,
});

import util from "util";

export const logInfo = (msg: any): void => {
    try { log_file.write(util.format(msg) + "\n"); } catch {}
};

export const logError = (msg: any): void => {
    try { err_log_file.write(util.format(msg) + "\n"); } catch {}
};