import prisma from '../config/database';

export const createNotification = async (
  title: string,
  message: string,
  type: string = 'INFO',
  userId: string | null = null,
  data: any = {}
) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        type,
        channel: 'IN_APP',
        userId,
        data: JSON.stringify(data),
      },
    });
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};
