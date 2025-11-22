// controllers/folderController.js
const pool = require('../config/database');

class FolderController {
  async getAllFolders(userId) {
    const query = `
      SELECT f.*, 
             (SELECT COUNT(*) FROM documents WHERE folder_id = f.id) as document_count
      FROM folders f
      WHERE f.user_id = $1
      ORDER BY f.name ASC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  async createFolder(name, userId, parentId = null) {
    const query = `
      INSERT INTO folders (name, user_id, parent_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await pool.query(query, [name, userId, parentId]);
    return result.rows[0];
  }

  async updateFolder(folderId, updates) {
    const { name, parentId } = updates;
    const query = `
      UPDATE folders
      SET name = COALESCE($1, name),
          parent_id = COALESCE($2, parent_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;
    const result = await pool.query(query, [name, parentId, folderId]);
    return result.rows[0];
  }

  async deleteFolder(folderId) {
    // This will cascade delete all child folders and set documents folder_id to NULL
    const query = 'DELETE FROM folders WHERE id = $1';
    await pool.query(query, [folderId]);
    return true;
  }

  async getDocumentsByFolder(folderId) {
    const query = `
      SELECT id, name, updated_at, created_at
      FROM documents
      WHERE folder_id = $1
      ORDER BY updated_at DESC
    `;
    const result = await pool.query(query, [folderId]);
    return result.rows;
  }
}

module.exports = new FolderController();
