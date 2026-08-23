export const migration061PaymentOrderLifecycle={version:61,name:"payment_order_lifecycle",up(db){db.exec(`
CREATE TABLE IF NOT EXISTS commerce_payment_attempts(id TEXT PRIMARY KEY,public_id TEXT NOT NULL,workspace_id TEXT NOT NULL REFERENCES workspaces(id),pending_order_id TEXT NOT NULL REFERENCES commerce_pending_orders(id),provider TEXT NOT NULL CHECK(length(provider) BETWEEN 1 AND 40),provider_binding_version INTEGER NOT NULL CHECK(provider_binding_version>0),status TEXT NOT NULL CHECK(status IN('CREATED','AUTHORIZATION_PENDING','REDIRECT_READY','RETURNED','VERIFYING','VERIFIED','FAILED','EXPIRED','CANCELLED')),requested_amount INTEGER NOT NULL CHECK(requested_amount>=0),currency TEXT NOT NULL CHECK(currency IN('IRR','USD','EUR')),provider_attempt_reference TEXT,provider_transaction_reference TEXT,redirect_url TEXT CHECK(redirect_url IS NULL OR length(redirect_url)<=2000),redirect_expires_at TEXT,idempotency_key TEXT NOT NULL,request_hash TEXT NOT NULL CHECK(length(request_hash)=64),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,verification_started_at TEXT,verified_at TEXT,failed_at TEXT,failure_code TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_attempt_public ON commerce_payment_attempts(public_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_attempt_create ON commerce_payment_attempts(workspace_id,pending_order_id,idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_provider_attempt ON commerce_payment_attempts(provider,provider_attempt_reference) WHERE provider_attempt_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_order_attempts ON commerce_payment_attempts(workspace_id,pending_order_id,created_at DESC,id);
CREATE INDEX IF NOT EXISTS idx_payment_attempt_state ON commerce_payment_attempts(workspace_id,status,updated_at,id);

CREATE TABLE IF NOT EXISTS commerce_verified_payments(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),payment_attempt_id TEXT NOT NULL REFERENCES commerce_payment_attempts(id),pending_order_id TEXT NOT NULL REFERENCES commerce_pending_orders(id),provider TEXT NOT NULL,provider_transaction_reference TEXT NOT NULL,verified_amount INTEGER NOT NULL CHECK(verified_amount>=0),currency TEXT NOT NULL,verified_at TEXT NOT NULL,verification_method TEXT NOT NULL,verification_version INTEGER NOT NULL,evidence_fingerprint TEXT NOT NULL CHECK(length(evidence_fingerprint)=64),provider_result_code TEXT,created_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS uq_verified_payment_attempt ON commerce_verified_payments(workspace_id,payment_attempt_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_verified_payment_order ON commerce_verified_payments(workspace_id,pending_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_verified_provider_transaction ON commerce_verified_payments(provider,provider_transaction_reference);
CREATE INDEX IF NOT EXISTS idx_verified_payment_order ON commerce_verified_payments(workspace_id,pending_order_id,verified_at,id);

CREATE TABLE IF NOT EXISTS commerce_orders(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),catalog_id TEXT NOT NULL REFERENCES commerce_catalogs(id),pending_order_id TEXT NOT NULL REFERENCES commerce_pending_orders(id),verified_payment_id TEXT NOT NULL REFERENCES commerce_verified_payments(id),public_reference TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN('CONFIRMED','CANCELLED')),contact_name TEXT NOT NULL,contact_mobile TEXT NOT NULL,contact_email TEXT,fulfillment_mode TEXT NOT NULL,shipping_method TEXT NOT NULL,recipient_name TEXT,recipient_mobile TEXT,province TEXT,city TEXT,postal_address TEXT,postal_code TEXT,subtotal INTEGER NOT NULL,shipping_amount INTEGER NOT NULL,discount_amount INTEGER NOT NULL,tax_amount INTEGER NOT NULL,grand_total INTEGER NOT NULL,currency TEXT NOT NULL,confirmed_at TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_order_pending ON commerce_orders(workspace_id,pending_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_order_payment ON commerce_orders(workspace_id,verified_payment_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_confirmed_public ON commerce_orders(public_reference);
CREATE INDEX IF NOT EXISTS idx_commerce_confirmed_history ON commerce_orders(workspace_id,confirmed_at DESC,id DESC);

CREATE TABLE IF NOT EXISTS commerce_order_items(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),order_id TEXT NOT NULL REFERENCES commerce_orders(id),source_pending_order_item_id TEXT NOT NULL REFERENCES commerce_pending_order_items(id),source_product_id TEXT NOT NULL,source_variant_id TEXT,product_name TEXT NOT NULL,variant_title TEXT,sku TEXT,variant_attributes_json TEXT NOT NULL CHECK(json_valid(variant_attributes_json)),unit_price INTEGER NOT NULL,compare_at_price INTEGER,quantity INTEGER NOT NULL,line_total INTEGER NOT NULL,asset_id TEXT,currency TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_commerce_confirmed_items ON commerce_order_items(workspace_id,order_id,id);

CREATE TRIGGER IF NOT EXISTS trg_payment_attempt_delete BEFORE DELETE ON commerce_payment_attempts BEGIN SELECT RAISE(ABORT,'payment attempt immutable identity');
END;
CREATE TRIGGER IF NOT EXISTS trg_payment_attempt_identity BEFORE UPDATE ON commerce_payment_attempts WHEN NEW.id<>OLD.id OR NEW.public_id<>OLD.public_id OR NEW.workspace_id<>OLD.workspace_id OR NEW.pending_order_id<>OLD.pending_order_id OR NEW.provider<>OLD.provider OR NEW.provider_binding_version<>OLD.provider_binding_version OR NEW.requested_amount<>OLD.requested_amount OR NEW.currency<>OLD.currency OR NEW.idempotency_key<>OLD.idempotency_key OR NEW.request_hash<>OLD.request_hash BEGIN SELECT RAISE(ABORT,'payment attempt identity immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_payment_attempt_workspace BEFORE INSERT ON commerce_payment_attempts WHEN NOT EXISTS(SELECT 1 FROM commerce_pending_orders o WHERE o.id=NEW.pending_order_id AND o.workspace_id=NEW.workspace_id AND o.grand_total=NEW.requested_amount AND o.currency=NEW.currency AND o.status='AWAITING_PAYMENT') BEGIN SELECT RAISE(ABORT,'payment attempt order mismatch');
END;
CREATE TRIGGER IF NOT EXISTS trg_payment_attempt_transition BEFORE UPDATE ON commerce_payment_attempts WHEN NEW.status<>OLD.status AND NOT((OLD.status='CREATED' AND NEW.status IN('AUTHORIZATION_PENDING','FAILED','CANCELLED')) OR (OLD.status='AUTHORIZATION_PENDING' AND NEW.status IN('REDIRECT_READY','FAILED','CANCELLED')) OR (OLD.status='REDIRECT_READY' AND NEW.status IN('RETURNED','VERIFYING','EXPIRED','CANCELLED')) OR (OLD.status='RETURNED' AND NEW.status IN('VERIFYING','FAILED','CANCELLED')) OR (OLD.status='VERIFYING' AND NEW.status IN('RETURNED','VERIFIED','FAILED')) OR (OLD.status='EXPIRED' AND NEW.status='VERIFYING')) BEGIN SELECT RAISE(ABORT,'illegal payment attempt transition');
END;
CREATE TRIGGER IF NOT EXISTS trg_payment_verified_terminal BEFORE UPDATE ON commerce_payment_attempts WHEN OLD.status='VERIFIED' BEGIN SELECT RAISE(ABORT,'verified attempt terminal');
END;

CREATE TRIGGER IF NOT EXISTS trg_verified_payment_guard BEFORE INSERT ON commerce_verified_payments WHEN NOT EXISTS(SELECT 1 FROM commerce_payment_attempts a WHERE a.id=NEW.payment_attempt_id AND a.workspace_id=NEW.workspace_id AND a.pending_order_id=NEW.pending_order_id AND a.provider=NEW.provider AND a.requested_amount=NEW.verified_amount AND a.currency=NEW.currency AND a.status='VERIFYING') BEGIN SELECT RAISE(ABORT,'verified payment mismatch');
END;
CREATE TRIGGER IF NOT EXISTS trg_verified_payment_update BEFORE UPDATE ON commerce_verified_payments BEGIN SELECT RAISE(ABORT,'verified payment immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_verified_payment_delete BEFORE DELETE ON commerce_verified_payments BEGIN SELECT RAISE(ABORT,'verified payment immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_confirmed_order_update BEFORE UPDATE ON commerce_orders BEGIN SELECT RAISE(ABORT,'confirmed order immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_confirmed_order_delete BEFORE DELETE ON commerce_orders BEGIN SELECT RAISE(ABORT,'confirmed order immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_confirmed_order_guard BEFORE INSERT ON commerce_orders WHEN NOT EXISTS(SELECT 1 FROM commerce_pending_orders p JOIN commerce_verified_payments v ON v.pending_order_id=p.id WHERE p.id=NEW.pending_order_id AND p.workspace_id=NEW.workspace_id AND p.catalog_id=NEW.catalog_id AND p.public_reference=NEW.public_reference AND p.grand_total=NEW.grand_total AND p.currency=NEW.currency AND v.id=NEW.verified_payment_id AND v.workspace_id=NEW.workspace_id) BEGIN SELECT RAISE(ABORT,'confirmed order mismatch');
END;
CREATE TRIGGER IF NOT EXISTS trg_confirmed_item_update BEFORE UPDATE ON commerce_order_items BEGIN SELECT RAISE(ABORT,'confirmed item immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_confirmed_item_delete BEFORE DELETE ON commerce_order_items BEGIN SELECT RAISE(ABORT,'confirmed item immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_confirmed_item_guard BEFORE INSERT ON commerce_order_items WHEN NOT EXISTS(SELECT 1 FROM commerce_orders o JOIN commerce_pending_order_items i ON i.id=NEW.source_pending_order_item_id AND i.pending_order_id=o.pending_order_id WHERE o.id=NEW.order_id AND o.workspace_id=NEW.workspace_id AND i.workspace_id=NEW.workspace_id AND i.source_product_id=NEW.source_product_id AND i.quantity=NEW.quantity AND i.unit_price=NEW.unit_price AND i.line_total=NEW.line_total AND i.currency=NEW.currency) BEGIN SELECT RAISE(ABORT,'confirmed item mismatch');
END;

`);
}};
