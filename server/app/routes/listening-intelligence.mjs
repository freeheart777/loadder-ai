import express from "express";
import { ListeningIntelligenceError } from "../services/listening-intelligence-service.mjs";
export function createListeningIntelligenceRouter({ service }) {
  const r=express.Router();
  const h=(e,s)=>e instanceof ListeningIntelligenceError?s.status(e.status).json({success:false,code:e.code,message:e.message}):s.status(500).json({success:false,message:"Listening intelligence operation failed.",developmentDetail:process.env.NODE_ENV==="test"?e.message:undefined});
  r.get("/listening/intelligence/definitions",(q,s)=>s.json({success:true,...service.definitions()}));
  r.post("/listening/intelligence/calculate",(q,s)=>{try{return s.status(201).json({success:true,...service.calculate(q.body||{},q.user.id)})}catch(e){return h(e,s)}});
  for(const [path,key] of [["/listening/aggregates","aggregates"],["/listening/trends","trends"],["/listening/anomalies","anomalies"],["/listening/topics","topics"]])r.get(path,(q,s)=>{try{return s.json({success:true,[key]:service[key](q.query)})}catch(e){return h(e,s)}});
  r.get("/listening/aggregates/:id",(q,s)=>{try{return s.json({success:true,aggregate:service.aggregate(q.params.id)})}catch(e){return h(e,s)}});
  r.get("/listening/intelligence/summary",(q,s)=>{try{return s.json({success:true,summary:service.summary(q.query)})}catch(e){return h(e,s)}});
  return r;
}
