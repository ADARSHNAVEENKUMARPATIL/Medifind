// Memory-based Rate Limiter Middleware
const rateLimitStore = {};

module.exports = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
    return (req, res, next) => {
        // Extract client IP address securely (preventing X-Forwarded-For header spoofing)
        const ip = req.ip || req.socket.remoteAddress;
        const now = Date.now();

        if (!rateLimitStore[ip]) {
            rateLimitStore[ip] = [];
        }

        // Filter and discard attempts older than the window
        rateLimitStore[ip] = rateLimitStore[ip].filter(timestamp => now - timestamp < windowMs);

        // Check if rate limit threshold is exceeded
        if (rateLimitStore[ip].length >= maxAttempts) {
            return res.status(429).json({
                success: false,
                message: "Too Many Requests. Please try again later."
            });
        }

        // Log the current valid request timestamp
        rateLimitStore[ip].push(now);
        next();
    };
};
