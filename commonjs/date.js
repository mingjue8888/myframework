"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.date = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const timezone_1 = __importDefault(require("dayjs/plugin/timezone"));
const utc_1 = __importDefault(require("dayjs/plugin/utc"));
const quarterOfYear_1 = __importDefault(require("dayjs/plugin/quarterOfYear"));
const weekOfYear_1 = __importDefault(require("dayjs/plugin/weekOfYear"));
const joi_1 = __importDefault(require("joi"));
const NODE_TIMEZONE = joi_1.default.attempt(process.env.NODE_TIMEZONE, joi_1.default.string().default("Asia/Hong_Kong"));
dayjs_1.default.extend(timezone_1.default);
dayjs_1.default.extend(utc_1.default);
dayjs_1.default.extend(quarterOfYear_1.default);
dayjs_1.default.extend(weekOfYear_1.default);
dayjs_1.default.tz.setDefault(NODE_TIMEZONE);
exports.date = dayjs_1.default;
