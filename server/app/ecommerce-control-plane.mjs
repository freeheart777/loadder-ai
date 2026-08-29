import { createEcommerceService } from "./services/ecommerce-service.mjs";
import { createEcommerceRouter } from "./routes/ecommerce.mjs";

export function mountEcommerceControlPlane({ app, db, basePath = "/api" }) {
  const service = createEcommerceService({ db });
  app.use(basePath || "/", createEcommerceRouter({ service }));
  return Object.freeze({ service });
}
