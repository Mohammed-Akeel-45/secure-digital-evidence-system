import "dotenv/config";
import express from "express";
import caseRoutes from "./routes/caseRoutes.js";
import {
  deleteDepartmentCases,
  getDepartmentCasesInternal,
  getOrgCasesInternal,
  resolveCaseByPublicId,
  resolveCaseInternalIdToPublicId,
  resolveCaseInternalIdsToPublicIds,
} from "./controllers/caseController.js";
import authenticate from "./middleware/authMiddleware.js";

const app = express();

app.use(express.json());

// health check
app.get("/", (req, res) => {
  res.send("Case Service API running");
});

// Internal routes
// resolving public_id to internal_id
app.get(
  "/api/v1/internal/cases/resolve/:public_id",
  authenticate,
  async (req, res) => {
    const { public_id } = req.params;
    const tokenType = req.tokenClaims.token_type;

    if (tokenType !== "service") {
      return res.status(401).json({ error: "Invalid token type" });
    }

    const result = await resolveCaseByPublicId(public_id);
    const caseId = result ? result.id : null;
    res.json({ id: caseId });
  },
);

// resolve case internal id to public id
app.get(
  "api/v1/internal/cases/resolve-internal-id/:internal_id",
  authenticate,
  async (req, res) => {
    const { internal_id } = req.params;
    const tokenType = req.tokenClaims.token_type;

    if (tokenType !== "service") {
      return res.status(401).json({ error: "Invalid token type" });
    }

    const public_id = await resolveCaseInternalIdToPublicId(internal_id);
    res.json({ public_id });
  },
);

// resolve an array of internal case ids to public ids.
app.get(
  "/api/v1/internal/cases/resolve-multiple-internal-ids",
  authenticate,
  async (req, res) => {
    const tokenType = req.tokenClaims.token_type;

    if (tokenType !== "service") {
      return res.status(401).json({ error: "Invalid token type" });
    }

    let ids = [];
    if (req.query.ids) {
      if (Array.isArray(req.query.ids)) {
        ids = req.query.ids.map(Number);
      } else if (typeof req.query.ids === "string") {
        ids = req.query.ids.split(",").map(Number);
      } else {
        ids = [Number(req.query.ids)];
      }
    }

    try {
      const pairs = await resolveCaseInternalIdsToPublicIds(ids);
      res.json(pairs);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// deleting all department cases
app.delete(
  "/api/v1/internal/cases/delete-department-cases",
  authenticate,
  deleteDepartmentCases,
);

app.get(
  "/api/v1/internal/cases/get-org-cases/:org_id",
  authenticate,
  getOrgCasesInternal,
);

app.get(
  "/api/v1/internal/cases/get-department-cases/:department_id",
  authenticate,
  getDepartmentCasesInternal,
);

// mount case routes
app.use("/api/v1/cases", caseRoutes);

export default app;
