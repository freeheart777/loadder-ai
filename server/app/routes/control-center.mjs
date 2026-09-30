import express from "express";
export function createControlCenterRouter({service}) { const r=express.Router(); r.get("/control-center/summary",(_q,res)=>res.json({success:true,...service.summary()})); return r; }
