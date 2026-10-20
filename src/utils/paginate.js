/**
 * Slice an in-memory array into a standard list payload.
 * Defaults: page 1, limit 20, max limit 100.
 */
function paginate(items, { page = 1, limit = 20 } = {}) {
  const list = Array.isArray(items) ? items : [];
  const p = Math.max(1, Number(page) || 1);
  let l = Number(limit) || 20;
  if (l < 1) l = 20;
  if (l > 100) l = 100;
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / l) || 1);
  const start = (p - 1) * l;
  return {
    data: list.slice(start, start + l),
    pagination: { page: p, limit: l, total, pages },
  };
}

module.exports = { paginate };
