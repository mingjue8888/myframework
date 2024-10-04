"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordEncryptor = exports.hasAuthorization = exports.file = exports.defaultExceptionHandler = exports.ServerErrorException = exports.NoPermissionException = exports.UnauthorizedException = exports.NotFoundException = exports.WrongParameterException = exports.HttpServerException = exports.env = void 0;
exports.exceptionTransformToMiddleware = exceptionTransformToMiddleware;
exports.asyncMiddleware = asyncMiddleware;
exports.validParam = validParam;
exports.validQuery = validQuery;
exports.validBody = validBody;
exports.validResponseAndSend = validResponseAndSend;
exports.dataInitialize = dataInitialize;
exports.signToken = signToken;
exports.startup = startup;
const joi_1 = __importStar(require("joi"));
const express_1 = __importStar(require("express"));
const multer_1 = __importStar(require("multer"));
const passport_1 = __importDefault(require("passport"));
const bcrypt_1 = require("bcrypt");
const date_1 = require("./date");
const jsonwebtoken_1 = require("jsonwebtoken");
const passport_jwt_1 = require("passport-jwt");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const morgan_1 = __importDefault(require("morgan"));
const logger_1 = require("./logger");
const compression_1 = __importDefault(require("compression"));
const envSchema = joi_1.default.object({
    NODE_PORT: joi_1.default.number().integer().default(1234),
    JWT_SECRET: joi_1.default.string().default("HelloWorld!"),
    JWT_REFRESH: joi_1.default
        .number()
        .integer()
        .default(1000 * 60 * 60),
    JWT_EXPIRES: joi_1.default
        .number()
        .integer()
        .default(1000 * 60 * 60 * 48),
});
exports.env = joi_1.default.attempt(process.env, envSchema, { allowUnknown: true });
class HttpServerException extends Error {
}
exports.HttpServerException = HttpServerException;
class WrongParameterException extends HttpServerException {
    getHttpResponseStatusCode() {
        return 400;
    }
}
exports.WrongParameterException = WrongParameterException;
class NotFoundException extends HttpServerException {
    getHttpResponseStatusCode() {
        return 404;
    }
}
exports.NotFoundException = NotFoundException;
class UnauthorizedException extends HttpServerException {
    getHttpResponseStatusCode() {
        return 401;
    }
}
exports.UnauthorizedException = UnauthorizedException;
class NoPermissionException extends HttpServerException {
    getHttpResponseStatusCode() {
        return 403;
    }
}
exports.NoPermissionException = NoPermissionException;
class ServerErrorException extends HttpServerException {
    getHttpResponseStatusCode() {
        return 500;
    }
}
exports.ServerErrorException = ServerErrorException;
const wrongParameterExceptionTransform = function (error) {
    if (error instanceof joi_1.ValidationError) {
        return new WrongParameterException("ValidationError:" + JSON.stringify(error.details));
    }
    if (error instanceof multer_1.MulterError) {
        return new WrongParameterException(error.message);
    }
};
function exceptionTransformToMiddleware(transform) {
    return function (error, _request, _response, next) {
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
function partialErrorRequestHandler(exceptionHandler) {
    return function (error, _request, response, next) {
        if (exceptionHandler) {
            exceptionHandler(error, response);
        }
        next(error);
    };
}
const defaultExceptionHandler = function (error, response) {
    if (error instanceof HttpServerException) {
        response
            .status(error.getHttpResponseStatusCode())
            .send({ message: error.message });
    }
    else {
        response
            .status(500)
            .send({
            message: `ServerError: ${error.message}, please make contact with backend developer!`,
        });
    }
};
exports.defaultExceptionHandler = defaultExceptionHandler;
function asyncMiddleware(handler) {
    return function (request, response, next) {
        handler(request, response).then(() => next()).catch(error => next(error));
    };
}
function validParam(schema) {
    return asyncMiddleware(async function (request, _response) {
        request.data.param = joi_1.default.attempt(request.params, joi_1.default.object(schema), { allowUnknown: true });
    });
}
function validQuery(schema) {
    return asyncMiddleware(async function (request, _response) {
        request.data.query = joi_1.default.attempt(request.query, joi_1.default.object(schema), { allowUnknown: true });
    });
}
function validBody(schema) {
    return asyncMiddleware(async function (request, _response) {
        request.data.body = joi_1.default.attempt(request.body, joi_1.default.object(schema), { allowUnknown: true });
    });
}
function validResponseAndSend(schema) {
    return asyncMiddleware(async function (_request, response) {
        try {
            response.data = joi_1.default.attempt(response.data, joi_1.default.object(schema));
            response.send(response.data);
        }
        catch (error) {
            throw new ServerErrorException(`ResponseValidationError: ${error.details}`);
        }
    });
}
function dataInitialize(request, response, next) {
    Reflect.set(request, "data", {});
    Reflect.set(response, "data", undefined);
    next();
}
exports.file = (0, multer_1.default)();
exports.hasAuthorization = passport_1.default.authenticate("jwt", { session: false });
exports.PasswordEncryptor = {
    encrypt(password) {
        return (0, bcrypt_1.hashSync)(password, (0, bcrypt_1.genSaltSync)());
    },
    verify(password, encryptedPassword) {
        return (0, bcrypt_1.compareSync)(password, encryptedPassword);
    },
};
function signToken(userId, roles, permissions, refreshToken) {
    const now = Math.floor((0, date_1.date)().tz().toDate().getTime() / 1000);
    const accessTokenPayload = {
        sub: userId,
        exp: Math.floor((0, date_1.date)().tz().add(exports.env.JWT_REFRESH, "millisecond").toDate().getTime() / 1000),
        iat: now,
        rle: roles,
        prm: permissions,
    };
    if (refreshToken) {
        const refreshTokenPayload = (0, jsonwebtoken_1.verify)(refreshToken, exports.env.JWT_SECRET);
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
            accessToken: (0, jsonwebtoken_1.sign)(accessTokenPayload, exports.env.JWT_SECRET),
            refreshToken,
        };
    }
    const refreshTokenPayload = {
        sub: userId,
        exp: Math.floor((0, date_1.date)().tz().add(exports.env.JWT_EXPIRES, "millisecond").toDate().getTime() / 1000),
        iat: now,
    };
    return {
        accessToken: (0, jsonwebtoken_1.sign)(accessTokenPayload, exports.env.JWT_SECRET),
        refreshToken: (0, jsonwebtoken_1.sign)(refreshTokenPayload, exports.env.JWT_SECRET),
    };
}
function startup(routers, options) {
    const app = (0, express_1.default)();
    if (options?.preSetting) {
        options.preSetting(app);
    }
    if (options?.authenticationFindUserLogic) {
        const jwtStrategyOptions = {
            secretOrKey: exports.env.JWT_SECRET,
            jwtFromRequest: passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
        };
        const strategy = new passport_jwt_1.Strategy(jwtStrategyOptions, function (payload, next) {
            if (options.authenticationFindUserLogic) {
                options.authenticationFindUserLogic(payload)
                    .then(user => user || Promise.reject(new NotFoundException("User does not exist")))
                    .then(user => next(null, user))
                    .catch(err => next(err, false));
            }
        });
        passport_1.default.use(strategy);
    }
    const requestLogger = (0, morgan_1.default)(":method :url :status :res[content-length] - :response-time ms", {
        stream: {
            write: message => logger_1.logger.http(message),
        },
    });
    app
        .use((0, express_rate_limit_1.default)({ windowMs: 1000, limit: 20 }))
        .use(requestLogger)
        .use((0, compression_1.default)())
        .use((0, express_1.urlencoded)({ extended: true }))
        .use((0, express_1.json)())
        .use(passport_1.default.initialize())
        .use(dataInitialize);
    options?.expandMiddlewares?.forEach(middleware => app.use(middleware));
    const router = routers.reduce((router, er) => Reflect.get(router, er.method.toLowerCase()).bind(router)(er.path, ...er.middlewares), (0, express_1.Router)());
    return app.use(router)
        .use(exceptionTransformToMiddleware(wrongParameterExceptionTransform))
        .use(exceptionTransformToMiddleware(options?.expandExceptionTransform))
        .use(partialErrorRequestHandler(options?.exceptionHandler || exports.defaultExceptionHandler))
        .listen(exports.env.NODE_PORT, () => logger_1.logger.info(`Success running on port ${exports.env.NODE_PORT}`));
}
