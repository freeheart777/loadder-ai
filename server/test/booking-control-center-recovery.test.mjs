import assert from "node:assert/strict";
import test from "node:test";
import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { createBookingRepository } from "../app/repositories/booking-repository.mjs";
import { createControlCenterRepository } from "../app/repositories/control-center-repository.mjs";
import { createControlCenterService } from "../app/services/control-center-service.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";

test("booking operations are persistent, associated and tenant isolated", () => {
  const db=createSiteTestDb(), booking=createBookingRepository(db);
  const created=runWithWorkspace("ws-1",()=>{const service=booking.createService({name:"ویزیت",durationMinutes:30});const provider=booking.createProvider({name:"دکتر"});assert.equal(booking.associate(provider.id,service.id),true);const availability=booking.addAvailability({providerId:provider.id,weekday:1,startsAt:"09:00",endsAt:"12:00"});const appointment=booking.createAppointment({serviceId:service.id,providerId:provider.id,customerName:"مریم",startsAt:"2026-10-01T09:00:00Z"});return{service,provider,availability,appointment};});
  assert.ok(created.availability); assert.ok(created.appointment);
  runWithWorkspace("ws-2",()=>{assert.equal(booking.listServices().length,0);assert.equal(booking.associate(created.provider.id,created.service.id),false);assert.equal(booking.createAppointment({serviceId:created.service.id,providerId:created.provider.id,customerName:"x",startsAt:"x"}),null);}); db.close();
});

test("control center is truthful for empty and capability-enabled workspaces",()=>{
 const db=createSiteTestDb(), projects=createSiteProjectService({repository:createSiteProjectRepository(db),businessContextService:{getCurrent:()=>({activeContext:null,isStale:false})}}), service=createControlCenterService({repository:createControlCenterRepository(db),siteProjectService:projects});
 runWithWorkspace("ws-2",()=>{const s=service.summary();assert.deepEqual(s.counts,{projects:0,services:0,providers:0,appointments:0,leads:0,orders:0});assert.deepEqual(s.capabilities,[]);assert.deepEqual(s.actions,[]);});
 runWithWorkspace("ws-1",()=>{projects.create({name:"کلینیک",siteType:"MEDICAL"});projects.create({name:"فروشگاه",siteType:"STORE"});const s=service.summary();assert.ok(s.capabilities.includes("booking"));assert.deepEqual(s.actions.find(a=>a.id==="booking"),{id:"booking",href:"/dashboard/booking"});assert.deepEqual(s.actions.find(a=>a.id==="customers"),{id:"customers",href:"/dashboard/crm"});assert.deepEqual(s.actions.find(a=>a.id==="commerce"),{id:"commerce",href:"/dashboard/websites/commerce"});}); db.close();
});
