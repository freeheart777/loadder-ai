import express from "express";

export function createLegacyCrmRouter({ getCRMStats, getCustomers, getCustomerById, createCustomer, getCustomer360 }) {
  const router = express.Router();

  router.get("/crm/stats", (req, res) => res.json({ ok: true, data: getCRMStats() }));

  router.get("/customers/:id/360", (req, res) => {
    try {
      const data = getCustomer360(req.params.id);
      if (!data) return res.status(404).json({ ok: false, message: "مشتری پیدا نشد." });
      return res.json({ ok: true, data });
    } catch (error) {
      console.error("Customer 360 error:", error);
      return res.status(500).json({ ok: false, message: "خطا در دریافت پروفایل کامل مشتری." });
    }
  });

  router.get("/customers", (req, res) => {
    const data = getCustomers();
    res.json({ ok: true, count: data.length, data });
  });

  router.get("/customers/:id", (req, res) => {
    const customer = getCustomerById(req.params.id);
    if (!customer) return res.status(404).json({ ok: false, message: "مشتری پیدا نشد." });
    return res.json({ ok: true, data: customer });
  });

  router.post("/customers", (req, res) => {
    const { name, phone, email, company, source } = req.body;
    if (!name) return res.status(400).json({ ok: false, message: "نام مشتری الزامی است." });
    try {
      const customer = createCustomer({ name, phone, email, company, source });
      return res.status(201).json({ ok: true, data: customer });
    } catch (error) {
      console.error("Create customer error:", error);
      return res.status(500).json({ ok: false, message: "خطا در ساخت مشتری." });
    }
  });

  return router;
}
