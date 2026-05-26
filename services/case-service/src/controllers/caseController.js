import pool from "../config/db.js";

// Helper: resolve case by public_id
async function resolveCaseByPublicId(publicId) {
  const result = await pool.query("SELECT * FROM cases WHERE public_id = $1", [
    publicId,
  ]);
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

async function resolveOrgByPublicId(publicId) {
  const result = await pool.query(
    "SELECT * FROM organizations WHERE public_id = $1",
    [publicId],
  );
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

async function resolveUserByPublicId(publicId) {
  const result = await pool.query("SELECT * FROM users WHERE public_id = $1", [
    publicId,
  ]);
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

// Valid case statuses
const VALID_STATUSES = ["OPEN", "CLOSED", "IN_PROGRESS", "ARCHIVED"];

// ✅ CREATE CASE
export const createCase = async (req, res) => {
  const { title, description } = req.body;
  const userPublicId = req.user.sub; // UUID from JWT
  const userOrgPublicId = req.user.org_id;

  if (!title || title.trim() === "") {
    return res.status(400).json({ error: "Title is required" });
  }
  if (!userOrgPublicId) {
    return res.status(400).json({ error: "Organization not found" });
  }

  try {
    // Resolve user public id to internal id
    const user = await resolveUserByPublicId(userPublicId);
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    // Resolve org public id to internal id
    const org = await resolveOrgByPublicId(userOrgPublicId);
    if (!org) {
      return res.status(400).json({ error: "Organization not found" });
    }

    const result = await pool.query(
      `INSERT INTO cases (org_id, title, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [org.id, title.trim(), description, user.id],
    );

    const newCase = result.rows[0];

    // Auto-assign creator to case_users
    await pool.query(
      `INSERT INTO case_users (case_id, user_id, assigned_role)
       VALUES ($1, $2, 'CREATOR')`,
      [newCase.id, user.id],
    );

    res.status(201).json(newCase);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ GET ALL CASES (scoped to user's assigned cases)
export const getAllCases = async (req, res) => {
  const userPublicId = req.user.sub;

  try {
    const result = await pool.query(
      `SELECT c.*
       FROM cases c
       INNER JOIN case_users cu ON cu.case_id = c.id
       INNER JOIN users u ON u.id = cu.user_id
       WHERE u.public_id = $1
       ORDER BY c.created_at DESC`,
      [userPublicId],
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ GET CASE BY PUBLIC_ID
export const getCaseById = async (req, res) => {
  const { id } = req.params;

  try {
    const caseData = await resolveCaseByPublicId(id);

    if (!caseData) {
      return res.status(404).json({ error: "Case not found" });
    }

    res.json(caseData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ UPDATE CASE STATUS (by public_id)
export const updateCaseStatus = async (req, res) => {
  const { id } = req.params; // public_id
  const { status } = req.body;
  const userPublicId = req.user.sub;

  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }

  if (!VALID_STATUSES.includes(status.toUpperCase())) {
    return res.status(400).json({
      error: `Invalid status. Allowed: ${VALID_STATUSES.join(", ")}`,
    });
  }

  try {
    // Resolve user public id to internal id
    const user = await resolveUserByPublicId(userPublicId);
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    // Resolve case public id to internal id
    const caseData = await resolveCaseByPublicId(id);
    if (!caseData) {
      return res.status(404).json({ error: "Case not found" });
    }

    const result = await pool.query(
      `UPDATE cases SET status = $1 WHERE id = $2 RETURNING *`,
      [status.toUpperCase(), caseData.id],
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ DELETE CASE (by public_id)
export const deleteCase = async (req, res) => {
  const { id } = req.params; // public_id
  const userPublicId = req.user.sub;

  try {
    // Resolve user public id to internal id
    const user = await resolveUserByPublicId(userPublicId);
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    // Resolve case public id to internal id
    const caseData = await resolveCaseByPublicId(id);
    if (!caseData) {
      return res.status(404).json({ error: "Case not found" });
    }

    await pool.query("DELETE FROM cases WHERE id = $1", [caseData.id]);

    res.json({ message: "Case deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ ASSIGN USER TO CASE
export const assignUserToCase = async (req, res) => {
  const { id } = req.params; // case public_id
  const { user_id, role } = req.body; // user public_id to assign
  const userPublicId = req.user.sub;

  if (!user_id) {
    return res.status(400).json({ error: "user_id is required" });
  }

  try {
    // Resolve user public id to internal id
    const user = await resolveUserByPublicId(userPublicId);
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    // Resolve case public id to internal id
    const caseData = await resolveCaseByPublicId(id);
    if (!caseData) {
      return res.status(404).json({ error: "Case not found" });
    }

    // Resolve the target user's internal id
    const targetUser = await pool.query(
      "SELECT id FROM users WHERE public_id = $1",
      [user_id],
    );
    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: "Target user not found" });
    }

    await pool.query(
      `INSERT INTO case_users (case_id, user_id, assigned_role)
       VALUES ($1, $2, $3)
       ON CONFLICT (case_id, user_id) DO NOTHING`,
      [caseData.id, targetUser.rows[0].id, role || "MEMBER"],
    );

    res.status(201).json({ message: "User assigned to case" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ GET USERS ASSIGNED TO A CASE
export const getCaseUsers = async (req, res) => {
  const { id } = req.params; // case public_id

  try {
    const caseData = await resolveCaseByPublicId(id);
    if (!caseData) {
      return res.status(404).json({ error: "Case not found" });
    }

    const result = await pool.query(
      `SELECT u.public_id, u.name, u.email, cu.assigned_role, cu.assigned_at
       FROM case_users cu
       INNER JOIN users u ON u.id = cu.user_id
       WHERE cu.case_id = $1`,
      [caseData.id],
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ REMOVE USER FROM CASE
export const removeUserFromCase = async (req, res) => {
  const { id, userId } = req.params; // case public_id, user public_id
  const userPublicId = req.user.sub;

  try {
    // Resolve user public id to internal id
    const user = await resolveUserByPublicId(userPublicId);
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    // Resolve case public id to internal id
    const caseData = await resolveCaseByPublicId(id);
    if (!caseData) {
      return res.status(404).json({ error: "Case not found" });
    }

    // Resolve target user internal id
    const targetUser = await pool.query(
      "SELECT id FROM users WHERE public_id = $1",
      [userId],
    );
    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: "Target user not found" });
    }

    await pool.query(
      "DELETE FROM case_users WHERE case_id = $1 AND user_id = $2",
      [caseData.id, targetUser.rows[0].id],
    );

    res.json({ message: "User removed from case" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
