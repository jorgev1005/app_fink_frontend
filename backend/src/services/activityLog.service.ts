import prisma from '../config/database';

export const logActivity = async (
  userId: string,
  action: string,
  entity: string,
  entityId: string,
  description: string,
  metadata?: any,
  ipAddress?: string,
  userAgent?: string
) => {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        description,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
        ipAddress,
        userAgent
      }
    });
  } catch (error) {
    console.error('Error creating activity log:', error);
    // Don't throw error to avoid blocking the main operation
  }
};
