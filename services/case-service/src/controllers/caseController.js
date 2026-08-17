import pool from "../config/db.js";
import { getServiceToken } from "../utils/serviceTokenManager.js";

// Helper: resolve case by public_id
export async function resolveCaseByPublicId(publicId) {
  const result = await pool.query("SELECT * FROM cases WHERE public_id = $1", [
    publicId,
  ]);
  if (result.rows.length === 0) return null;
  const c = result.rows[0];
  return {
    ...c,
    id: Number(c.id),
    org_id: Number(c.org_id),
    dept_id: Number(c.dept_id),
  };
}

// Helper: resolve case by internal id
export const resolveCaseInternalIdToPublicId = async (id) => {
  const result = await pool.queryRow(
    "SELECT public_id FROM cases WHERE id = $1",
    [id],
  );
  if (result) return result.public_id;
  return null;
};

// Helper: resolve multiple case internal ids to public ids
export async function resolveCaseInternalIdsToPublicIds(internalIds) {
  if (!internalIds || internalIds.length === 0) return [];
  const result = await pool.query(
    "SELECT id, public_id, title FROM cases WHERE id = ANY($1::bigint[])",
    [internalIds],
  );
  result.rows.forEach((row) => (row.id = Number(row.id)));
  return result.rows;
}

async function resolveOrgByPublicId(publicId) {
  try {
    const serviceToken = await getServiceToken();
    const response = await fetch(
      `http://sdes_auth:3001/api/v1/auth/internal/org/resolve/${publicId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${serviceToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to resolve org ID: ${response.statusText}`);
    }
    const result = await response.json();
    return result.id;
  } catch (err) {
    console.error("Failed to resolve org ID:", err);
    throw err;
  }
}

async function resolveDepartmentByPublicId(publicId) {
  try {
    const serviceToken = await getServiceToken();
    const response = await fetch(
      `http://sdes_auth:3001/api/v1/auth/internal/org/department/resolve/${publicId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${serviceToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to resolve department ID: ${response.statusText}`,
      );
    }
    const result = await response.json();
    return result.id;
  } catch (err) {
    console.error("Failed to resolve department ID:", err);
    throw err;
  }
}

async function resolveUserByPublicId(publicId) {
  try {
    const serviceToken = await getServiceToken();
    const response = await fetch(
      `http://sdes_auth:3001/api/v1/auth/internal/user/resolve/${publicId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${serviceToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to resolve user ID: ${response.statusText}`);
    }
    const result = await response.json();
    return result.id;
  } catch (err) {
    console.error("Failed to resolve user ID:", err);
    throw err;
  }
}

async function resolveDepartmentPublicId(internalId) {
  try {
    const serviceToken = await getServiceToken();
    const response = await fetch(
      `http://sdes_auth:3001/api/v1/auth/internal/org/department/resolve-internal-id/${internalId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${serviceToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to resolve department public ID: ${response.statusText}`,
      );
    }
    const result = await response.json();
    return result.public_id;
  } catch (err) {
    console.error("Failed to resolve department public ID:", err);
    throw err;
  }
}

async function checkPermission(
  userPublicId,
  permission,
  scopeType,
  scopePublicId,
) {
  try {
    const serviceToken = await getServiceToken();
    const response = await fetch(
      `http://sdes_auth:3001/api/v1/auth/internal/check-permissions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_public_id: userPublicId,
          permissions: [permission],
          scope: {
            type: scopeType,
            public_id: scopePublicId,
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Permission check failed: ${response.statusText}`);
    }
    const result = await response.json();
    return result.allowed;
  } catch (err) {
    console.error("Permission check request failed:", err);
    return false;
  }
}

// Valid case statuses
const VALID_STATUSES = ["OPEN", "CLOSED", "IN_PROGRESS", "ARCHIVED"];

// CREATE CASE
export const createCase = async (req, res) => {
  const { title, description, priority, dept_id } = req.body;
  const userPublicId = req.tokenClaims.sub; // UUID from JWT
  const userOrgPublicId = req.tokenClaims.org_id;

  if (!title || title.trim() === "") {
    return res.status(400).json({ error: "Title is required" });
  }
  if (!userOrgPublicId) {
    return res.status(400).json({ error: "Organization not found" });
  }

  try {
    // Resolve user public id to internal id
    const userId = await resolveUserByPublicId(userPublicId);
    if (!userId) {
      return res.status(400).json({ error: "User not found" });
    }

    // Resolve org public id to internal id
    const orgId = await resolveOrgByPublicId(userOrgPublicId);
    if (!orgId) {
      return res.status(400).json({ error: "Organization not found" });
    }

    // Resolve department public id to internal id if provided
    let departmentId = null;
    if (dept_id) {
      departmentId = await resolveDepartmentByPublicId(dept_id);
    }

    const result = await pool.query(
      `INSERT INTO cases (org_id, title, description, priority, created_by, dept_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [orgId, title.trim(), description, priority, userId, departmentId],
    );

    const newCase = result.rows[0];

    // Auto-assign creator to case_users
    await pool.query(
      `INSERT INTO case_users (case_id, user_id)
       VALUES ($1, $2)`,
      [newCase.id, userId],
    );

    console.log("case created");

    res.status(201).json(newCase);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getOrgCasesInternal = async (req, res) => {
  const { org_id } = req.params;
  const token = req.tokenClaims;
  if (token.token_type !== "service") {
    return res.status(401).json({ error: "Invalid token type" });
  }

  try {
    const query = `
        SELECT id
        FROM cases
        WHERE org_id = $1
      `;

    const cases = await pool.query(query, [org_id]);
    let ids = [];
    for (let i = 0; i < cases.rowCount; i++) {
      ids.push(Number(cases.rows[i].id));
    }
    res.status(200).json({ ids });
  } catch (err) {
    res.status(500).json({ error: "Failed to get org cases", err });
  }
};

export const getDepartmentCasesInternal = async (req, res) => {
  const { department_id } = req.params;
  const token = req.tokenClaims;
  if (token.token_type !== "service") {
    return res.status(401).json({ error: "Invalid token type" });
  }

  try {
    const query = `
        SELECT id
        FROM cases
        WHERE dept_id = $1
      `;

    const cases = await pool.query(query, [department_id]);
    let ids = [];
    for (let i = 0; i < cases.rowCount; i++) {
      ids.push(Number(cases.rows[i].id));
    }
    res.status(200).json({ ids });
  } catch (err) {
    res.status(500).json({ error: "Failed to get department cases", err });
  }
};

// GET ALL CASES (scoped to user's assigned cases)
export const getAllCases = async (req, res) => {
  const { department_id, user_id } = req.query;
  const userPublicId = user_id || req.tokenClaims.sub;

  try {
    let query = `
      SELECT c.*
      FROM cases c
      INNER JOIN case_users cu ON cu.case_id = c.id
      INNER JOIN auth_schema.users u ON u.id = cu.user_id
      WHERE u.public_id = $1
    `;
    const params = [userPublicId];

    if (department_id) {
      const internalDeptId = await resolveDepartmentByPublicId(department_id);
      query += ` AND c.dept_id = $2`;
      params.push(internalDeptId);
    }

    query += ` ORDER BY c.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET CASE BY PUBLIC_ID
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

// UPDATE CASE STATUS (by public_id)
export const updateCaseStatus = async (req, res) => {
  const { id } = req.params; // public_id
  const { status } = req.body;
  const userPublicId = req.tokenClaims.sub;

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
    const userId = await resolveUserByPublicId(userPublicId);
    if (!userId) {
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

// DELETE CASE (by public_id)
export const deleteCase = async (req, res) => {
  const { id } = req.params; // public_id
  const userPublicId = req.tokenClaims.sub;

  try {
    // Resolve user public id to internal id
    const userId = await resolveUserByPublicId(userPublicId);
    if (!userId) {
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

export const deleteDepartmentCases = async (req, res) => {
  const { org_id, department_id: dept_id } = req.query;
  const token = req.tokenClaims;

  if (token.token_type !== "service") {
    return res.status(401).json({ error: "invalid token type" });
  }
  if (isNaN(dept_id)) {
    return res
      .status(400)
      .json({ error: "department internal id needs to be provided" });
  }

  try {
    await pool.query(
      `
            DELETE FROM cases
            WHERE org_id = $1 AND dept_id = $2
        `,
      [org_id, dept_id],
    );
    res.status(200).json({ message: "department cases deleted" });
  } catch (err) {
    res.status(500).json({ error: "Error deleting department cases" });
  }
};

// ASSIGN USER TO CASE
export const assignUserToCase = async (req, res) => {
  const { id } = req.params; // case public_id
  const { user_id } = req.body; // user public_id to assign
  const userPublicId = req.tokenClaims.sub;

  if (!user_id) {
    return res.status(400).json({ error: "user_id is required" });
  }

  try {
    // Resolve user public id to internal id
    const userId = await resolveUserByPublicId(userPublicId);
    if (!userId) {
      return res.status(400).json({ error: "User not found" });
    }

    // Resolve case public id to internal id
    const caseData = await resolveCaseByPublicId(id);
    if (!caseData) {
      return res.status(404).json({ error: "Case not found" });
    }

    // Verify permission at department level
    const deptPublicId = await resolveDepartmentPublicId(caseData.dept_id);
    const allowed = await checkPermission(
      userPublicId,
      "CASE_ASSIGN",
      "DEPARTMENT",
      deptPublicId,
    );
    if (!allowed) {
      return res.status(403).json({
        error: "User doesn't have permission to assign a user to case",
      });
    }

    // Resolve the target user's internal id
    const targetUserId = await resolveUserByPublicId(user_id);
    if (!targetUserId) {
      return res.status(404).json({ error: "Target user not found" });
    }

    // Verify user belongs to same department as case
    const userDeptResult = await pool.query(
      "SELECT dept_id FROM auth_schema.users WHERE id = $1",
      [targetUserId],
    );
    const userDeptId = userDeptResult.rows[0]?.dept_id;
    if (!userDeptId || userDeptId != caseData.dept_id) {
      return res
        .status(400)
        .json({ error: "User must belong to the same department as the case" });
    }

    await pool.query(
      `INSERT INTO case_users (case_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (case_id, user_id) DO NOTHING`,
      [caseData.id, targetUserId],
    );

    res.status(201).json({ message: "User assigned to case" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET USERS ASSIGNED TO A CASE
export const getCaseUsers = async (req, res) => {
  const { id } = req.params; // case public_id

  try {
    const caseData = await resolveCaseByPublicId(id);
    if (!caseData) {
      return res.status(404).json({ error: "Case not found" });
    }

    const result = await pool.query(
      `SELECT u.public_id, u.name, u.email, cu.assigned_at
       FROM case_users cu
       INNER JOIN auth_schema.users u ON u.id = cu.user_id
       WHERE cu.case_id = $1`,
      [caseData.id],
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// REMOVE USER FROM CASE
export const removeUserFromCase = async (req, res) => {
  const { id, userId } = req.params; // case public_id, user public_id
  const userPublicId = req.tokenClaims.sub;

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

    // Verify permission at department level
    const deptPublicId = await resolveDepartmentPublicId(caseData.dept_id);
    const allowed = await checkPermission(
      userPublicId,
      "CASE_ASSIGN",
      "DEPARTMENT",
      deptPublicId,
    );
    if (!allowed) {
      return res.status(403).json({
        error: "User doesn't have permission to remove a user from case",
      });
    }

    // Resolve target user internal id
    const targetUser = await pool.query(
      "SELECT id FROM auth_schema.users WHERE public_id = $1",
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
