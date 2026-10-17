const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const routes = require('./routes');
const originCheck = require('./middleware/originCheck');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimit');
const { AppError } = require('./utils/http');

const app = express();
if (env.isProduction) app.set('trust proxy', 1); // correct client IPs behind a reverse proxy

app.use(helmet()); // security headers
app.use(cors({ origin: env.clientOrigin, credentials: true })); // only our frontend may call the API
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
if (!env.isProduction) app.use(morgan('dev'));

app.use('/api', apiLimiter, originCheck, routes);

app.use((req, res, next) => next(new AppError(404, 'Route not found')));
app.use(errorHandler);

module.exports = app;
