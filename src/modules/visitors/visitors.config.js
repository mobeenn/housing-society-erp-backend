/**
 * Configuration constants for Visitor & Pass Management module
 */

const PASS_TYPES = ["Visitor", "Contractor", "Temporary"];
const PASS_STATUSES = ["Active", "Expired", "Revoked"];

const BLACKLIST_ACTIONS = ["Warn", "Block"]; // configurable per society

module.exports = {
  PASS_TYPES,
  PASS_STATUSES,
  BLACKLIST_ACTIONS,
};
