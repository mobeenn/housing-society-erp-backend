const ApiError = require("./ApiError");
const RbacService = require("../modules/rbac/service");
const SocietySettings = require("../modules/administration/societySettings.model");

/**
 * When SocietySettings.enforceSeparationOfDuties is true, the same non–Super-Admin
 * user cannot approve a document they created.
 */
async function assertSeparationOfDuties(req, creatorId, documentLabel = "this record") {
  if (!req?.user) return;
  if (RbacService.isSuperAdmin(req.user)) return;

  const settings = await SocietySettings.get();
  const enforce = settings?.enforceSeparationOfDuties !== false;
  if (!enforce) return;

  const actorId = req.user.id || req.user._id;
  if (!creatorId || !actorId) return;
  if (String(creatorId) === String(actorId)) {
    throw new ApiError(
      403,
      `You cannot approve ${documentLabel} that you created. Ask another authorised user to approve it.`
    );
  }
}

module.exports = { assertSeparationOfDuties };
