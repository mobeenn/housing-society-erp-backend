const { prisma } = require("../config/prisma");

/**
 * Transaction helper with retry on serialization failure/deadlock.
 * 
 * Every multi-table financial/ownership/stock operation MUST use this.
 * 
 * @param {Function} fn - Async function that receives a Prisma transaction client
 * @param {Object} [options] - Transaction options
 * @param {number} [options.maxRetries=3] - Max retry attempts on P2034
 * @param {number} [options.timeout=10000] - Transaction timeout in ms
 * @param {number} [options.maxWait=5000] - Max wait for transaction in ms
 * @param {number} [options.isolationLevel] - Prisma isolation level
 * @returns {Promise<*>} Result of fn
 */
async function withTransaction(fn, options = {}) {
  const {
    maxRetries = 3,
    timeout = 10000,
    maxWait = 5000,
    isolationLevel,
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          return await fn(tx);
        },
        {
          timeout,
          maxWait,
          isolationLevel,
        }
      );
    } catch (error) {
      lastError = error;

      // Retry on serialization failure / deadlock (Prisma P2034)
      if (error.code === "P2034" && attempt < maxRetries) {
        // Exponential backoff: 100ms, 200ms, 400ms
        const delay = 100 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Don't retry other errors
      throw error;
    }
  }

  throw lastError;
}

module.exports = { withTransaction };
