import { Router } from "express";

const healthRoutes = Router();

healthRoutes.get("/", (req, res) => {
  res.send("Yjs TPN Server is running");
});

export default healthRoutes;
