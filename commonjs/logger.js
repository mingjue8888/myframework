"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const joi_1 = __importDefault(require("joi"));
const date_1 = require("./date");
const LOGGER_LEVEL = joi_1.default.attempt(process.env.LOGGER_LEVEL, joi_1.default.string().allow("error", "warn", "info", "http", "debug").default("debug"));
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};
const colors = {
    error: "red",
    warn: "yellow",
    info: "green",
    http: "magenta",
    debug: "white",
};
const format = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: () => (0, date_1.date)().tz().format("YYYY-MM-DD HH:mm:ss.SSS") }), winston_1.default.format.colorize({ all: true }), winston_1.default.format.align(), winston_1.default.format.printf(info => `${info.timestamp} ${info.level}: ${info.message?.toString()}`));
winston_1.default.addColors(colors);
exports.logger = winston_1.default.createLogger({
    level: LOGGER_LEVEL,
    levels,
    format,
    transports: [
        new winston_1.default.transports.Console({})
    ]
});
