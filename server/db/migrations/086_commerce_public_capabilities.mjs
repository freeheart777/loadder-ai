export const migration086CommercePublicCapabilities = {
  version: 86,
  name: "commerce_public_capabilities",
  up(db) {
    db.exec(`
ALTER TABLE ecommerce_carts ADD COLUMN public_capability_hash TEXT;
ALTER TABLE ecommerce_orders ADD COLUMN receipt_capability_hash TEXT;
`);
  },
};
