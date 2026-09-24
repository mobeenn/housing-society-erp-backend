const RecoveryService = require("./service");

module.exports = {
  daysOverdue: RecoveryService.daysOverdue,
  isOverdueInstallment: RecoveryService.isOverdueInstallment,
};
