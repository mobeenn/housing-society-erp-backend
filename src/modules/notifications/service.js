const Notification = require("./model");
const User = require("../auth/user.model");
const Member = require("../members/member.model");
const ApiError = require("../../utils/ApiError");
const RbacService = require("../rbac/service");
const { dispatchNotification } = require("../../services/notificationChannels");

class NotificationService {
  static async activeUsers() {
    return User.find({ isActive: true });
  }

  static async usersWithPermission(permission) {
    const users = await this.activeUsers();
    const mapped = typeof permission === "string"
      ? RbacService.legacyPermissionToModuleAction(permission)
      : permission;
    const moduleKey = mapped?.module;
    const action = mapped?.action;
    const resolved = [];
    for (const user of users) {
      await User.populate(user, "roles");
      const allowed = permission === "system:admin"
        ? RbacService.isSuperAdmin(user)
        : moduleKey && action
          ? await RbacService.isAllowed(user, moduleKey, action)
          : false;
      if (allowed) resolved.push(user);
    }
    return resolved;
  }

  static async resolveMemberUserId(memberId) {
    if (!memberId) return null;
    const member = await Member.findById(memberId);
    if (!member) return null;
    if (member.userId || member.linkedUser) return member.userId || member.linkedUser;

    if (member.email) {
      const user = await User.findOne({ email: String(member.email).toLowerCase(), isActive: true });
      if (user) return user._id;
    }
    return null;
  }

  static async createForUser({
    userId,
    title,
    message,
    relatedEntityType = null,
    relatedEntityId = null,
    eventType = "general",
    eventKey = null,
    metadata = {},
    createdBy = null,
  }) {
    if (!userId || !title || !message) return null;
    if (eventKey) {
      const existing = await Notification.findByEventKey(userId, eventKey);
      if (existing) return existing;
    }
    return Notification.create({
      user: userId,
      title,
      message,
      relatedEntityType,
      relatedEntityId,
      eventType,
      eventKey,
      metadata,
      createdBy,
    });
  }

  static async emitForUsers(userIds, payload) {
    const uniqueIds = [...new Set((userIds || []).filter(Boolean))];
    const created = [];
    for (const userId of uniqueIds) {
      const notification = await this.createForUser({ ...payload, userId });
      if (notification) created.push(notification);
    }
    return created;
  }

  static async notifyMember(memberId, payload) {
    const userId = await this.resolveMemberUserId(memberId);
    if (!userId) return null;
    return this.createForUser({ ...payload, userId });
  }

  static async notifyPermission(permission, payload) {
    const users = await this.usersWithPermission(permission);
    return this.emitForUsers(users.map((user) => user._id), payload);
  }

  /** Business services call this so notification failures never roll back the domain action. */
  static async safeNotifyMember(memberId, payload) {
    try {
      return await this.notifyMember(memberId, payload);
    } catch (error) {
      console.error("Failed to create member notification:", error.message);
      return null;
    }
  }

  static async safeNotifyMembers(memberIds, payload) {
    const results = [];
    for (const memberId of [...new Set((memberIds || []).filter(Boolean))]) {
      results.push(await this.safeNotifyMember(memberId, payload));
    }
    return results.filter(Boolean);
  }

  static async safeNotifyUsers(userIds, payload) {
    try {
      return await this.emitForUsers(userIds, payload);
    } catch (error) {
      console.error("Failed to create user notifications:", error.message);
      return [];
    }
  }

  static async safeNotifyPermission(permission, payload) {
    try {
      return await this.notifyPermission(permission, payload);
    } catch (error) {
      console.error("Failed to create permission notifications:", error.message);
      return [];
    }
  }

  static async listForUser(userId, options = {}) {
    const page = await Notification.findForUser(userId, options);
    const unreadCount = await Notification.countUnread(userId);
    return { ...page, unreadCount };
  }

  static async markRead(id, userId) {
    const notification = await Notification.findById(id);
    if (!notification || notification.user !== userId) {
      throw new ApiError(404, "Notification not found");
    }
    await Notification.markRead(id, userId);
    return Notification.findById(id);
  }

  static async markAllRead(userId) {
    return Notification.markAllRead(userId);
  }

  /** Explicit provider boundary for future member email/SMS/WhatsApp delivery. */
  static async dispatchStubChannels({ recipient, subject, message, channels = [], metadata = {} }) {
    return Promise.all(
      channels.map((channel) =>
        dispatchNotification(channel, { recipient, subject, message, metadata })
      )
    );
  }
}

module.exports = NotificationService;
