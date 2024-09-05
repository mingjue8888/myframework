import joi, { ValidationError } from "joi";
import express, {
    ErrorRequestHandler,
    Handler, json,
    NextFunction,
    Request,
    RequestHandler,
    Response,
    Router,
    urlencoded,
} from "express";
import multer, { MulterError } from "multer";
import passport from "passport";
import { compareSync, genSaltSync, hashSync } from "bcrypt";
import { date } from "./date";
import { JwtPayload, sign, verify } from "jsonwebtoken";
import { ExtractJwt, Strategy, StrategyOptions } from "passport-jwt";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import { logger } from "./logger";
import compression from "compression";


const envSchema = joi.object({
    NODE_PORT: joi.number().integer().default(1234),
    JWT_SECRET: joi.string().default("HelloWorld!"),
    JWT_REFRESH: joi
        .number()
        .integer()
        .default(1000 * 60 * 60),

    JWT_EXPIRES: joi
        .number()
        .integer()
        .default(1000 * 60 * 60 * 48),
});

const env = joi.attempt(process.env, envSchema, { allowUnknown: true });

type ResponseData = object;
type RequestData = {
    param: any;
    query: any;
    body: any;
}

declare global {
    namespace Express {
        interface Request {
            data: RequestData;
        }

        interface Response {
            data: ResponseData;
        }
    }
}

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE"
export type Middleware = RequestHandler | Handler;
export type ExpressRouter = {
    method: HttpMethod;
    path: string;
    middlewares: Middleware[];
}

export abstract class HttpServerException extends Error {
    abstract getHttpResponseStatusCode(): number;
}

export class WrongParameterException extends HttpServerException {
    getHttpResponseStatusCode(): number {
        return 400;
    }
}

export class NotFoundException extends HttpServerException {
    getHttpResponseStatusCode(): number {
        return 404;
    }
}

export class UnauthorizedException extends HttpServerException {
    getHttpResponseStatusCode(): number {
        return 401;
    }
}

export class NoPermissionException extends HttpServerException {
    getHttpResponseStatusCode(): number {
        return 403;
    }
}

export class ServerErrorException extends HttpServerException {
    getHttpResponseStatusCode(): number {
        return 500;
    }
}

export type ExceptionTransform = (error: Error) => HttpServerException | undefined;

const wrongParameterExceptionTransform: ExceptionTransform = function (error: Error) {
    if (error instanceof ValidationError) {
        return new WrongParameterException("ValidationError:" + JSON.stringify(error.details));
    }
    if (error instanceof MulterError) {
        return new WrongParameterException(error.message);
    }
};

export function exceptionTransformToMiddleware(transform?: ExceptionTransform): ErrorRequestHandler {
    return function (error: Error, _request: Request, _response: Response, next: NextFunction) {
        if (transform) {
            const httpServerException = transform(error);
            if (httpServerException) {
                next(httpServerException);
                return;
            }
        }
        next(error);
    };
}

type ExceptionHandler = (error: Error, response: Response) => void;

function partialErrorRequestHandler(exceptionHandler?: ExceptionHandler): ErrorRequestHandler {
    return function (error: Error, _request: Request, response: Response, next: NextFunction) {
        if (exceptionHandler) {
            exceptionHandler(error, response);
        }
        next(error);
    };
}

export const defaultExceptionHandler: ExceptionHandler = function (error, response) {
    if (error instanceof HttpServerException) {
        response
            .status(error.getHttpResponseStatusCode())
            .send({ message: error.message });
    } else {
        response
            .status(500)
            .send({
                message: `ServerError: ${error.message}, please make contact with backend developer!`,
            });
    }
}

export function asyncMiddleware(handler: (request: Request, response: Response) => Promise<void>): Middleware {
    return function (request, response, next) {
        handler(request, response).then(() => next()).catch(error => next(error));
    };
}

export function validParam(schema: Record<string, joi.AnySchema>): Middleware {
    return asyncMiddleware(async function (request, _response) {
        request.data.param = joi.attempt(request.params, joi.object(schema), { allowUnknown: true });
    });
}

export function validQuery(schema: Record<string, joi.AnySchema>): Middleware {
    return asyncMiddleware(async function (request, _response) {
        request.data.query = joi.attempt(request.query, joi.object(schema), { allowUnknown: true });
    });
}

export function validBody(schema: Record<string, joi.AnySchema>): Middleware {
    return asyncMiddleware(async function (request, _response) {
        request.data.body = joi.attempt(request.body, joi.object(schema), { allowUnknown: true });
    });
}

export function validResponseAndSend(schema: Record<string, joi.AnySchema>): Middleware {
    return asyncMiddleware(async function (_request, response) {
        try {
            response.data = joi.attempt(response.data, joi.object(schema));
            response.send(response.data);
        } catch (error) {
            throw new ServerErrorException(`ResponseValidationError: ${error.details}`);
        }
    });
}

export function dataInitialize(request: Request, response: Response, next: NextFunction) {
    Reflect.set(request, "data", {});
    Reflect.set(response, "data", undefined);
    next();
}

export const file = multer();
export const hasAuthorization: Middleware = passport.authenticate("jwt", { session: false });
export const PasswordEncryptor = {
    encrypt(password: string) {
        return hashSync(password, genSaltSync());
    },
    verify(password: string, encryptedPassword: string) {
        return compareSync(password, encryptedPassword);
    },
};

export function signToken(userId: string, infos: object, refreshToken?: string) {
    const now = Math.floor(date().tz().toDate().getTime() / 1000);
    const accessTokenPayload = {
        sub: userId,
        exp: Math.floor(date().tz().add(env.JWT_REFRESH, "millisecond").toDate().getTime() / 1000),
        iat: now,
        ...infos,
    };

    if (refreshToken) {
        const refreshTokenPayload = verify(refreshToken, env.JWT_SECRET) as JwtPayload;
        if (refreshTokenPayload.sub !== userId) {
            throw new WrongParameterException("Not the same user");
        }
        if (!refreshTokenPayload.exp) {
            throw new WrongParameterException("Wrong refresh token");
        }
        if (refreshTokenPayload.exp < now) {
            throw new WrongParameterException("Refresh token be overdue");
        }

        return {
            accessToken: sign(accessTokenPayload, env.JWT_SECRET),
            refreshToken,
        };
    }

    const refreshTokenPayload = {
        sub: userId,
        exp: Math.floor(date().tz().add(env.JWT_EXPIRES, "millisecond").toDate().getTime() / 1000),
        iat: now,
    };

    return {
        accessToken: sign(accessTokenPayload, env.JWT_SECRET),
        refreshToken: sign(refreshTokenPayload, env.JWT_SECRET),
    };
}

export interface StartupOptions {
    authenticationFindUserLogic?: (payload: JwtPayload) => Promise<unknown>;
    expandMiddlewares?: Middleware[];
    expandExceptionTransform?: ExceptionTransform;
    exceptionHandler?: ExceptionHandler;
    preSetting?: (app: express.Express) => void;
}

export function startup(routers: ExpressRouter[], options: StartupOptions) {
    const app = express();

    if (options.preSetting) {
        options.preSetting(app);
    }

    if (options.authenticationFindUserLogic) {
        const jwtStrategyOptions: StrategyOptions = {
            secretOrKey: env.JWT_SECRET,
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        };
        const strategy = new Strategy(jwtStrategyOptions, function (payload, next) {
            if (options.authenticationFindUserLogic) {
                options.authenticationFindUserLogic(payload)
                    .then(user => user || Promise.reject(new NotFoundException("User does not exist")))
                    .then(user => next(null, user))
                    .catch(err => next(err, false));
            }
        });
        passport.use(strategy);
    }

    const requestLogger = morgan(":method :url :status :res[content-length] - :response-time ms", {
        stream: {
            write: message => logger.http(message),
        },
    });

    app
        .use(rateLimit({ windowMs: 1000, limit: 20 }))
        .use(requestLogger)
        .use(compression())
        .use(urlencoded({ extended: true }))
        .use(json())
        .use(passport.initialize())
        .use(dataInitialize);

    options.expandMiddlewares?.forEach(middleware => app.use(middleware));

    const router = routers.reduce(
        (router, er) =>
            Reflect.get(router, er.method.toLowerCase()).bind(router)(er.path, ...er.middlewares),
        Router(),
    );

    return app.use(router)
        .use(exceptionTransformToMiddleware(wrongParameterExceptionTransform))
        .use(exceptionTransformToMiddleware(options.expandExceptionTransform))
        .use(partialErrorRequestHandler(options.exceptionHandler || defaultExceptionHandler))
        .listen(env.NODE_PORT, () => logger.info(`Success running on port ${env.NODE_PORT}`));
}