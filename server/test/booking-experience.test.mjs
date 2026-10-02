import test from "node:test";
import assert from "node:assert/strict";
import { bookingExperienceFor } from "../../src/lib/bookingExperience.ts";
import { bookingScopeForSite } from "../app/services/booking-scope.mjs";

const EDUCATION_TERMS = ["رزرو کلاس", "دوره", "مدرس", "هنرجو", "کلاس"];
const strings = (x) => [x.title, ...x.stepLabels, x.pickService, x.pickProvider, x.pickMode, x.pickSlot, x.detailsRequired, x.nameField, x.unavailableSlot, x.submitFailed, x.confirmedEyebrow, x.emptyTitle, x.emptyBody, x.noProviders];

test("MEDICAL vocabulary is medical and never uses Education terms", () => {
  const x = bookingExperienceFor("MEDICAL");
  assert.equal(x.kind, "MEDICAL");
  assert.equal(x.title, "رزرو نوبت");
  assert.deepEqual(x.stepLabels, ["خدمت / تخصص", "پزشک", "شیوه مراجعه", "تاریخ و ساعت", "اطلاعات بیمار", "بازبینی", "تأیید نوبت"]);
  for (const text of strings(x)) for (const term of EDUCATION_TERMS) assert.ok(!text.includes(term), `"${text}" contains "${term}"`);
});

test("EDUCATION and unknown site types keep the class/course vocabulary", () => {
  for (const type of ["EDUCATION", "education", "STORE", "", null, undefined]) {
    const x = bookingExperienceFor(type);
    assert.equal(x.kind, "EDUCATION");
    assert.equal(x.title, "رزرو کلاس");
    assert.deepEqual(x.stepLabels, ["دوره", "مدرس", "نوع کلاس", "زمان", "اطلاعات هنرجو", "بازبینی", "تأیید"]);
  }
  assert.equal(bookingExperienceFor("medical").kind, "MEDICAL");
});

test("the presentation contract does not change Booking scoping: MEDICAL stays strict, others compat", () => {
  assert.equal(bookingScopeForSite({ id: "s1", siteType: "MEDICAL" }).kind, "strict");
  assert.equal(bookingScopeForSite({ id: "s2", siteType: "EDUCATION" }).kind, "compat");
});
