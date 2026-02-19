import { Router } from "express";

import { requireAuth } from "../auth/requireAuth.js";

const authRoutes = Router();

authRoutes.get("/me", requireAuth, (req, res) => {
  res.json({
    ok: true,
    user: req.user,
  });
});

export default authRoutes;
