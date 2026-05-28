import "dotenv/config";
import express from "express";
import caseRoutes from "./routes/caseRoutes.js";
import { resolveCaseByPublicId } from "./controllers/caseController.js";

const app = express();

app.use(express.json());

// health check
app.get("/", (req, res) => {
  res.send("Case Service API running");
});

// Internal routes for resolving public_id to internal_id
app.get("/internal/cases/resolve/:public_id", async (req, res) => {
  const { public_id } = req.params;
  const tokenType = req.tokenClaims.token_type;

  if (tokenType !== "service") {
    return res.status(401).json({ error: "Invalid token type" });
  }

  const result = await resolveCaseByPublicId(public_id);
  const caseId = result ? result.id : null;
  res.json({ id: caseId });
});

// mount case routes
app.use("/cases", caseRoutes);

export default app;
