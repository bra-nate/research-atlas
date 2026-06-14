import cors from "cors";
import express from "express";
import { env } from "./env.js";
import { errorMiddleware, notFound } from "./http.js";
import { api } from "./routes/index.js";

const app = express();

app.use(cors({ origin: env.webOrigins }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", api);

app.use(notFound);
app.use(errorMiddleware);

app.listen(env.port, () => {
  console.log(`[api] research-directory listening on http://localhost:${env.port}`);
});
