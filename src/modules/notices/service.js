const Notice = require("./model");
const User = require("../auth/user.model");
const RbacService = require("../rbac/service");
const Member = require("../members/member.model");
const NotificationService = require("../notifications/service");
const ApiError = require("../../utils/ApiError");

class NoticeService {
  static isLive(notice, now = new Date()) {
    const publishAt = new Date(notice.publishDate);
    const expiryAt = notice.expiryDate ? new Date(notice.expiryDate) : null;
    return (
      notice.status === "Published" &&
      publishAt <= now &&
      (!expiryAt || expiryAt >= now)
    );
  }

  static async memberUserId(memberId) {
    const member = await Member.findById(memberId);
    if (!member) return null;
    if (member.userId || member.linkedUser) return member.userId || member.linkedUser;
    if (member.email) {
      const user = await User.findOne({ email: String(member.email).toLowerCase(), isActive: true });
      return user?._id || null;
    }
    return null;
  }

  static async audienceUserIds(notice) {
    if (notice.targetAudience === "All") {
      const users = await User.find({ isActive: true });
      return users.map((user) => user._id);
    }

    if (notice.targetAudience === "Role-based") {
      const users = await User.find({ isActive: true });
      const ids = [];
      for (const user of users) {
        const roleIds = (user.roles || []).map((role) => (typeof role === "object" ? role._id : role));
        if (notice.targetRoleIds.some((roleId) => roleIds.includes(roleId))) ids.push(user._id);
      }
      return ids;
    }

    const ids = [];
    for (const memberId of notice.targetMemberIds || []) {
      const userId = await this.memberUserId(memberId);
      if (userId) ids.push(userId);
    }
    return [...new Set(ids)];
  }

  static async create(data, createdBy) {
    const notice = await Notice.create({ ...data, createdBy });
    if (notice.status === "Published") return this.publish(notice._id);
    return notice;
  }

  static async update(id, patch) {
    const existing = await Notice.findById(id);
    if (!existing) throw new ApiError(404, "Notice not found");
    await Notice.update(id, patch);
    const updated = await Notice.findById(id);
    if (updated.status === "Published" && existing.status !== "Published") {
      return this.publish(id);
    }
    return updated;
  }

  static async publish(id) {
    const notice = await Notice.findById(id);
    if (!notice) throw new ApiError(404, "Notice not found");
    if (notice.expiryDate && new Date(notice.expiryDate) <= new Date()) {
      throw new ApiError(400, "An expired notice cannot be published");
    }

    if (notice.status !== "Published") {
      await Notice.update(id, {
        status: "Published",
        publishedAt: new Date().toISOString(),
      });
    }

    const userIds = await this.audienceUserIds(notice);
    await NotificationService.safeNotifyUsers(userIds, {
      title: notice.title,
      message: notice.body,
      relatedEntityType: "Notice",
      relatedEntityId: notice._id,
      eventType: "notice.published",
      eventKey: `notice-published:${notice._id}`,
      createdBy: notice.createdBy,
    });
    return Notice.findById(id);
  }

  static async listForUser(user, { includeExpired = false } = {}) {
    const now = new Date();
    const all = await Notice.find({}, { sort: { publishDate: -1 } });
    const canManage = await RbacService.isAllowed(user, "notices", "edit");
    const userRoleIds = (user.roles || []).map((role) => (typeof role === "object" ? role._id : role));
    const specificAudienceIds = new Map();
    for (const notice of all.filter((item) => item.targetAudience === "Specific members")) {
      specificAudienceIds.set(notice._id, await this.audienceUserIds(notice));
    }

    const visible = all.filter((notice) => {
      if (canManage && includeExpired) return true;
      if (!this.isLive(notice, now)) return false;
      if (notice.targetAudience === "All") return true;
      if (notice.targetAudience === "Role-based") {
        return (notice.targetRoleIds || []).some((roleId) => userRoleIds.includes(roleId));
      }
      return (specificAudienceIds.get(notice._id) || []).includes(user._id);
    });

    return { data: visible, pagination: { total: visible.length } };
  }

  static async remove(id) {
    const notice = await Notice.findById(id);
    if (!notice) throw new ApiError(404, "Notice not found");
    await Notice.delete(id);
    return true;
  }
}

module.exports = NoticeService;
