import express from "express";

export function createLegacyAutomationsRouter({ getAutomations, getAutomationById, createAutomation, updateAutomation, deleteAutomation }) {
  const router = express.Router();
  router.get("/automations", (req, res) => { const data=getAutomations();res.json({ok:true,count:data.length,data}); });
  router.get("/automations/:id", (req, res) => { const automation=getAutomationById(req.params.id);if(!automation)return res.status(404).json({ok:false,message:"اتوماسیون پیدا نشد."});return res.json({ok:true,data:automation}); });
  router.post("/automations", (req, res) => { const{title,trigger,enabled=true,delayMinutes=0,conditions=[],actions=[]}=req.body;if(!title||!trigger)return res.status(400).json({ok:false,message:"title و trigger الزامی هستند."});try{return res.status(201).json({ok:true,data:createAutomation({title,trigger,enabled,delayMinutes,conditions,actions})});}catch(error){console.error("Create automation error:",error);return res.status(500).json({ok:false,message:"خطا در ساخت اتوماسیون."});} });
  router.patch("/automations/:id", (req, res) => { try{const automation=updateAutomation(req.params.id,req.body);if(!automation)return res.status(404).json({ok:false,message:"اتوماسیون پیدا نشد."});return res.json({ok:true,data:automation});}catch(error){console.error("Update automation error:",error);return res.status(500).json({ok:false,message:"خطا در ویرایش اتوماسیون."});} });
  router.delete("/automations/:id", (req, res) => { try{if(!deleteAutomation(req.params.id))return res.status(404).json({ok:false,message:"اتوماسیون پیدا نشد."});return res.json({ok:true});}catch(error){console.error("Delete automation error:",error);return res.status(500).json({ok:false,message:"خطا در حذف اتوماسیون."});} });
  return router;
}
