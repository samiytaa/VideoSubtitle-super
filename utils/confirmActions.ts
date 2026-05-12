import { Notifier } from '../components/Notifications';

const normalizeType = (type: string) => (type.endsWith('图片') ? type : `${type}图片`);

export const confirmDelete = (
  count: number,
  type: string,
  notifier: Notifier
): Promise<boolean> => {
  const targetType = normalizeType(type);
  return notifier.showConfirm({
    title: '确认删除',
    message: `确定要删除这 ${count} 张${targetType}吗？`,
  });
};
