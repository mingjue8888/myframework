import winston from "winston";
import joi from "joi";
import { date } from "./date";

const LOGGER_LEVEL = joi.attempt(process.env.LOGGER_LEVEL, joi.string().allow("error", "warn", "info", "http", "debug").default("debug"));

const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
}

const colors = {
    error: "red",
    warn: "yellow",
    info: "green",
    http: "magenta",
    debug: "white",
}

const format = winston.format.combine(
    winston.format.timestamp({ format: () => date().tz().format("YYYY-MM-DD HH:mm:ss.SSS") }),
    winston.format.colorize({ all: true }),
    winston.format.align(),
    winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message?.toString()}`)
);

winston.addColors(colors);

export const logger = winston.createLogger({
    level: LOGGER_LEVEL,
    levels,
    format,
    transports: [
        new winston.transports.Console({})
    ]
});