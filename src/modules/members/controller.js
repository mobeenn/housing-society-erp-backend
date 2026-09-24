const MemberService = require("./service");
const ApiResponse = require("../../utils/apiResponse");
const { PaymentService } = require("../payments/service");

/**
 * GET /api/members
 * Get all members with search and pagination
 */
exports.getMembers = async (req, res) => {
  const { search, status, page = 1, limit = 20 } = req.query;

  const result = await MemberService.getMembers({
    search,
    status,
    page: parseInt(page),
    limit: parseInt(limit),
  });

  ApiResponse.success(res, 200, result);
};

/**
 * GET /api/members/:id
 * Get a single member by ID
 */
exports.getMemberById = async (req, res) => {
  const member = await MemberService.getMemberById(req.params.id);
  ApiResponse.success(res, 200, member);
};

/**
 * GET /api/members/:id/360
 * Get member 360 view with aggregated data
 */
exports.getMember360 = async (req, res) => {
  const data = await MemberService.getMember360(req.params.id);
  ApiResponse.success(res, 200, data);
};

exports.getMemberStatement = async (req, res) => {
  const statement = await PaymentService.statement(req.params.id);
  ApiResponse.success(res, 200, statement);
};

/**
 * POST /api/members/check-duplicate
 * Check for duplicate members by CNIC or phone
 */
exports.checkDuplicates = async (req, res) => {
  const { cnic, phone, excludeId } = req.body;

  const result = await MemberService.checkDuplicates({ cnic, phone, excludeId });

  ApiResponse.success(res, 200, result);
};

/**
 * POST /api/members
 * Create a new member
 */
exports.createMember = async (req, res) => {
  const result = await MemberService.createMember(req.body, req.user._id);

  ApiResponse.success(res, 201, result, "Member created successfully");
};

/**
 * PUT /api/members/:id
 * Update a member
 */
exports.updateMember = async (req, res) => {
  const result = await MemberService.updateMember(req.params.id, req.body, req.user._id);

  if (!result.success) {
    return ApiResponse.error(res, 409, "Duplicate member detected", [
      result.duplicateWarning,
    ]);
  }

  ApiResponse.success(res, 200, result.member, "Member updated successfully");
};

/**
 * PATCH /api/members/:id/status
 * Update member status
 */
exports.updateMemberStatus = async (req, res) => {
  const { status } = req.body;

  const member = await MemberService.updateMemberStatus(req.params.id, status, req.user._id);

  ApiResponse.success(res, 200, member, "Member status updated successfully");
};

/**
 * DELETE /api/members/:id
 * Delete a member (soft delete)
 */
exports.deleteMember = async (req, res) => {
  const result = await MemberService.deleteMember(req.params.id, req.user._id);

  ApiResponse.success(res, 200, result);
};

/**
 * GET /api/members/stats
 * Get member statistics
 */
exports.getStatistics = async (req, res) => {
  const stats = await MemberService.getStatistics();
  ApiResponse.success(res, 200, stats);
};
