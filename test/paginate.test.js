const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { paginate } = require("../src/utils/paginate");

describe("paginate helper", () => {
  test("pages an array with defaults", () => {
    const items = Array.from({ length: 25 }, (_, i) => i + 1);
    const page1 = paginate(items, {});
    assert.equal(page1.data.length, 20);
    assert.equal(page1.pagination.total, 25);
    assert.equal(page1.pagination.pages, 2);
    const page2 = paginate(items, { page: 2 });
    assert.deepEqual(page2.data, [21, 22, 23, 24, 25]);
  });

  test("caps limit at 100", () => {
    const items = Array.from({ length: 150 }, (_, i) => i);
    const result = paginate(items, { limit: 500 });
    assert.equal(result.pagination.limit, 100);
    assert.equal(result.data.length, 100);
  });
});
