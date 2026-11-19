import { rateLimit } from "express-rate-limit";

const commonConfig = {
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
};

export const readLimiter = rateLimit({
  ...commonConfig,
  windowMs: 60 * 1000, // 1 minute
  limit: 30,
});

export const writeLimiter = rateLimit({
  ...commonConfig,
  windowMs: 60 * 1000, // 1 minute
  limit: 3,
});
