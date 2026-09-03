import rateLimit from "express-rate-limit";

export const LOADDER_BUILDER_RATE_LIMITS=Object.freeze({
  read:{windowMs:60_000,limit:240},
  write:{windowMs:60_000,limit:60},
  operator:{windowMs:60_000,limit:30}
});

export function createBusinessBuilderRateLimiter(kind="write",overrides={}){
  const base=LOADDER_BUILDER_RATE_LIMITS[kind]||LOADDER_BUILDER_RATE_LIMITS.write;
  return rateLimit({
    windowMs:overrides.windowMs??base.windowMs,
    limit:overrides.limit??base.limit,
    standardHeaders:"draft-8",
    legacyHeaders:false,
    ...(overrides.store?{store:overrides.store}:{}),
    keyGenerator:req=>`${req.user?.id||req.ip||"anonymous"}:${req.headers["x-workspace-id"]||"no-workspace"}:${kind}`,
    handler:(req,res)=>res.status(429).json({success:false,code:"RATE_LIMITED",message:"Too many requests. Please retry shortly."})
  });
}
