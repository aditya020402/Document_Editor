// controllers/documentController.js
const pool = require('../config/database');

class DocumentController {
  async getAllDocuments(userId) {
    const query = `
      SELECT d.*, f.name as folder_name
      FROM documents d
      LEFT JOIN folders f ON d.folder_id = f.id
      WHERE d.user_id = $1
      ORDER BY d.updated_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  async getDocument(documentId) {
    const query = `
      SELECT d.*, f.name as folder_name, u.name as user_name, u.email as user_email
      FROM documents d
      LEFT JOIN folders f ON d.folder_id = f.id
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.id = $1
    `;
    const result = await pool.query(query, [documentId]);
    return result.rows[0];
  }

  async createDocument(name, content, userId, folderId = null) {
    const query = `
      INSERT INTO documents (name, content, user_id, folder_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await pool.query(query, [name, content, userId, folderId]);
    return result.rows[0];
  }

  async updateDocument(documentId, updates) {
    const { name, content, folderId } = updates;
    const query = `
      UPDATE documents
      SET name = COALESCE($1, name),
          content = COALESCE($2, content),
          folder_id = COALESCE($3, folder_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;
    const result = await pool.query(query, [name, content, folderId, documentId]);
    return result.rows[0];
  }

  async deleteDocument(documentId) {
    const query = 'DELETE FROM documents WHERE id = $1';
    await pool.query(query, [documentId]);
    return true;
  }

  async saveVersion(documentId, content) {
    const query = `
      INSERT INTO document_versions (document_id, content)
      VALUES ($1, $2)
      RETURNING *
    `;
    const result = await pool.query(query, [documentId, content]);
    return result.rows[0];
  }

  async getVersions(documentId, limit = 50) {
    const query = `
      SELECT * FROM document_versions
      WHERE document_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    const result = await pool.query(query, [documentId, limit]);
    return result.rows;
  }

  async restoreVersion(documentId, versionId) {
    const versionQuery = 'SELECT content FROM document_versions WHERE id = $1 AND document_id = $2';
    const versionResult = await pool.query(versionQuery, [versionId, documentId]);
    
    if (versionResult.rows.length === 0) {
      throw new Error('Version not found');
    }

    const updateQuery = `
      UPDATE documents
      SET content = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(updateQuery, [versionResult.rows[0].content, documentId]);
    return result.rows[0];
  }
}

module.exports = new DocumentController();
