/**
 * P4-6: CSV member import preview validates CNIC and duplicates without writing.
 */
const { test, mock, describe } = require("node:test");
const assert = require("node:assert/strict");
const CsvImportService = require("../src/modules/administration/csvImport.service");
const Member = require("../src/modules/members/member.model");

describe("csv import preview", () => {
  test("flags invalid CNIC and accepts a valid row", async () => {
    mock.method(Member, "find", async () => [{ cnic: "35202-9999999-9" }]);

    const csv = [
      "name,cnic,phone,email,address,status",
      "Bad Row,123,0300,,,Active",
      "Good Row,35202-1234567-1,03001234567,,,Active",
      "Dup Row,35202-9999999-9,,,,Active",
    ].join("\n");

    const result = await CsvImportService.previewMembers(csv);
    assert.equal(result.total, 3);
    assert.equal(result.validCount, 1);
    assert.equal(result.valid[0].data.name, "Good Row");
    assert.ok(result.errors.some((e) => e.row === 2));
    assert.ok(result.duplicates.some((e) => e.row === 4));
    mock.restoreAll();
  });

  test("member template includes header columns", () => {
    const csv = CsvImportService.memberTemplate();
    assert.match(csv, /^name,cnic,phone,email,address,status/);
  });
});
