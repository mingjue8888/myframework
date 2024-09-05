import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import weekOfYear from "dayjs/plugin/weekOfYear";
import joi from "joi";

const NODE_TIMEZONE = joi.attempt(process.env.NODE_TIMEZONE, joi.string().default("Asia/Hong_Kong"));

dayjs.extend(timezone);
dayjs.extend(utc);
dayjs.extend(quarterOfYear);
dayjs.extend(weekOfYear);
dayjs.tz.setDefault(NODE_TIMEZONE);

export const date = dayjs;