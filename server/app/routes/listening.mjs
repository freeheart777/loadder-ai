import express from "express";
import { ListeningError } from "../services/listening-service.mjs";
import { ListeningMappingError } from "../services/listening-event-mapper-service.mjs";
export function createListeningRouter({service,mapper}){const r=express.Router(),handle=(e,res)=>e instanceof ListeningError||e instanceof ListeningMappingError?res.status(e.status).json({success:false,code:e.code,message:e.message}):res.status(500).json({success:false,message:"Listening operation failed."});
  r.get("/listening-sources",(q,s)=>{try{return s.json({success:true,sources:service.sourceDefinitions(q.query.region)});}catch(e){return handle(e,s);}});
  r.post("/listening-monitors",(q,s)=>{try{return s.status(201).json({success:true,...service.createMonitor(q.body||{},q.user.id)});}catch(e){return handle(e,s);}});
  r.get("/listening-monitors",(q,s)=>s.json({success:true,monitors:service.monitors()}));
  r.post("/listening-monitors/:id/versions",(q,s)=>{try{return s.status(201).json({success:true,version:service.createVersion(q.params.id,q.body||{},q.user.id)});}catch(e){return handle(e,s);}});
  r.get("/listening-monitors/:id/versions",(q,s)=>{try{return s.json({success:true,versions:service.versions(q.params.id)});}catch(e){return handle(e,s);}});
  r.post("/listening-collections",(q,s)=>{try{return s.status(201).json({success:true,...service.collect(q.body||{},q.user.id)});}catch(e){return handle(e,s);}});
  r.get("/listening-collections",(q,s)=>{try{return s.json({success:true,runs:service.runs(q.query)});}catch(e){return handle(e,s);}});
  r.get("/listening-collections/:id",(q,s)=>{try{return s.json({success:true,run:service.run(q.params.id)});}catch(e){return handle(e,s);}});
  r.get("/listening-records",(q,s)=>{try{return s.json({success:true,records:service.records(q.query)});}catch(e){return handle(e,s);}});
  r.get("/listening-records/aggregates",(q,s)=>s.json({success:true,aggregates:service.aggregates()}));
  r.get("/listening-records/:id",(q,s)=>{try{return s.json({success:true,record:service.record(q.params.id)});}catch(e){return handle(e,s);}});
  r.get("/listening-event-mappings",(q,s)=>s.json({success:true,mappings:mapper.definitions()}));
  r.post("/listening-records/:id/map-event",(q,s)=>{try{return s.status(201).json({success:true,...mapper.map(q.params.id,q.user.id)});}catch(e){return handle(e,s);}});
  return r;
}
