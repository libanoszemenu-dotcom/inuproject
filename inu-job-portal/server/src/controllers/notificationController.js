const { query, pool } = require('../config/db');
const { AppError, asyncHandler, ok, pageMeta } = require('../utils/http');

exports.list = asyncHandler(async (req, res) => {
  const { page, page_size, unread } = req.valid.query;
  const where = ['user_id = ?'];
  const params = [req.user.id];
  if (unread === 'true') where.push('is_read = 0');
  const w = where.join(' AND ');

  const total = (await query(`SELECT COUNT(*) AS c FROM notifications WHERE ${w}`, params))[0].c;
  const unreadCount = (await query('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]))[0].c;
  const items = await query(
    `SELECT id, application_id, title, message, is_read, created_at FROM notifications
      WHERE ${w} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, page_size, (page - 1) * page_size]
  );
  ok(res, items, { ...pageMeta(page, page_size, total), unread_count: unreadCount });
});

exports.markRead = asyncHandler(async (req, res) => {
  const [r] = await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.valid.params.id, req.user.id]);
  if (r.affectedRows === 0) throw new AppError(404, 'Notification not found');
  ok(res, { id: req.valid.params.id, is_read: true });
});

exports.markAllRead = asyncHandler(async (req, res) => {
  await query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user.id]);
  ok(res, { message: 'All notifications marked as read' });
});
