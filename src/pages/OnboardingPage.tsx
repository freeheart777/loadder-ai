import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AudienceStep } from "../components/onboarding/AudienceStep";
import { BrandVoiceStep } from "../components/onboarding/BrandVoiceStep";
import { BusinessStep } from "../components/onboarding/BusinessStep";
import { OfferingStep } from "../components/onboarding/OfferingStep";
import { OnboardingProgress } from "../components/onboarding/OnboardingProgress";
import { ReviewStep } from "../components/onboarding/ReviewStep";
import type { BrandForm, BusinessForm, DnaForm, OnboardingStatus, StepId } from "../components/onboarding/types";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";
import { fetchOnboardingStatus } from "../lib/onboarding";

const titles = {
  BUSINESS: ["کسب‌وکار شما", "چند اطلاعات کوتاه برای شناخت بهتر کسب‌وکارتان وارد کنید."],
  OFFERING: ["محصولات و خدمات", "بگویید چه چیزی ارائه می‌دهید و چرا برای مشتری ارزشمند است."],
  AUDIENCE: ["مشتریان شما", "مشتری اصلی‌تان کیست و چه مسئله‌ای را برای او حل می‌کنید؟"],
  BRAND: ["لحن برند", "انتخاب کنید محتوای برندتان چه حس و لحنی داشته باشد."],
  REVIEW: ["مرور و آماده‌سازی", "اطلاعات را بررسی کنید؛ سپس شناخت کسب‌وکارتان را آماده می‌کنیم."],
} as const;
const sequence: Array<Exclude<StepId, "COMPLETE">> = ["BUSINESS", "OFFERING", "AUDIENCE", "BRAND", "REVIEW"];
const emptyBusiness: BusinessForm = { name: "", industry: "", description: "", website: "", country: "", primaryLanguage: "فارسی" };
const emptyDna: DnaForm = { offerings: [""], valueProposition: "", differentiators: [""], targetAudience: "", goals: [] };
const emptyBrand: BrandForm = { audienceProblem: "", personality: [], tone: "", keyPhrases: [], prohibitedPatterns: [] };

type DnaVersion = Record<string, unknown> & { id: string; status: string; offerings: string[]; valueProposition: string | null; differentiators: string[]; targetAudiences: string[]; goals: string[] };
type BrandVersion = Record<string, unknown> & { id: string; status: string; brandIdentity: Record<string, string>; brandPersonality: string[]; toneOfVoice: string | null; keyPhrases: string[]; prohibitedPatterns: string[] };

function cleanList(values: string[]) { return values.map((item) => item.trim()).filter(Boolean); }

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { activeWorkspace } = useAuth();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [step, setStep] = useState<Exclude<StepId, "COMPLETE">>("BUSINESS");
  const [business, setBusiness] = useState(emptyBusiness);
  const [profileExists, setProfileExists] = useState(false);
  const [dna, setDna] = useState(emptyDna);
  const [dnaVersion, setDnaVersion] = useState<DnaVersion | null>(null);
  const [brand, setBrand] = useState(emptyBrand);
  const [brandVersion, setBrandVersion] = useState<BrandVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState("");

  const loadProfile = useCallback(async (signal?: AbortSignal) => {
    const response = await apiFetch("/api/business-profile", { signal }); const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    const p = data.profile; setProfileExists(Boolean(p));
    setBusiness(p ? { name: p.name || "", industry: p.industry || "", description: p.description || "", website: p.website || "", country: p.country || "", primaryLanguage: p.primaryLanguage || "فارسی" } : emptyBusiness);
  }, []);
  const loadDna = useCallback(async (signal?: AbortSignal) => {
    const response = await apiFetch("/api/business-dna", { signal }); const data = await response.json();
    if (!response.ok) throw new Error(data.message); const version: DnaVersion | null = data.latestDraft || data.activeVersion || null;
    setDnaVersion(version); setDna(version ? { offerings: version.offerings.length ? version.offerings : [""], valueProposition: version.valueProposition || "", differentiators: version.differentiators.length ? version.differentiators : [""], targetAudience: version.targetAudiences[0] || "", goals: version.goals || [] } : emptyDna);
  }, []);
  const loadBrand = useCallback(async (signal?: AbortSignal) => {
    const response = await apiFetch("/api/brand-book", { signal }); const data = await response.json();
    if (!response.ok) throw new Error(data.message); const version: BrandVersion | null = data.latestDraft || data.activeVersion || null;
    setBrandVersion(version); setBrand(version ? { audienceProblem: version.brandIdentity?.audienceProblem || "", personality: version.brandPersonality || [], tone: version.toneOfVoice || "", keyPhrases: version.keyPhrases || [], prohibitedPatterns: version.prohibitedPatterns || [] } : emptyBrand);
  }, []);

  const loadDetails = useCallback(async (target: Exclude<StepId, "COMPLETE">, signal?: AbortSignal) => {
    if (target === "BUSINESS") await loadProfile(signal);
    if (target === "OFFERING") await loadDna(signal);
    if (target === "AUDIENCE") await Promise.all([loadDna(signal), loadBrand(signal)]);
    if (target === "BRAND") await loadBrand(signal);
    if (target === "REVIEW") await Promise.all([loadProfile(signal), loadDna(signal), loadBrand(signal)]);
  }, [loadBrand, loadDna, loadProfile]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setRequestError(""); setErrors({}); setSaved(false);
    setBusiness(emptyBusiness); setDna(emptyDna); setBrand(emptyBrand); setDnaVersion(null); setBrandVersion(null);
    void fetchOnboardingStatus(controller.signal).then(async (next) => {
      if (next.complete) { navigate("/dashboard", { replace: true }); return; }
      const target = next.currentStep === "COMPLETE" ? "REVIEW" : next.currentStep;
      setStatus(next); setStep(target); await loadDetails(target, controller.signal);
    }).catch((error) => { if (error.name !== "AbortError") setRequestError(error.message); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [activeWorkspace?.id, loadDetails, navigate]);

  useEffect(() => { if (!loading) { headingRef.current?.focus(); window.scrollTo({ top: 0, behavior: "smooth" }); } }, [step, loading]);

  const validate = () => {
    const next: Record<string, string> = {};
    if (step === "BUSINESS") {
      if (business.name.trim().length < 2 || business.name.trim().length > 120) next.name = "نام باید بین ۲ تا ۱۲۰ نویسه باشد.";
      if (business.industry.trim().length < 2 || business.industry.trim().length > 120) next.industry = "حوزه فعالیت را وارد کنید.";
      if (business.description.trim().length < 20 || business.description.trim().length > 1000) next.description = "توضیح باید بین ۲۰ تا ۱۰۰۰ نویسه باشد.";
      if (business.website) { try { const url = new URL(business.website); if (!["http:", "https:"].includes(url.protocol)) throw new Error(); } catch { next.website = "نشانی وب‌سایت باید با http یا https شروع شود."; } }
    }
    if (step === "OFFERING") {
      const offerings = cleanList(dna.offerings), differentiators = cleanList(dna.differentiators);
      if (!offerings.length || offerings.length > 10 || offerings.some((item) => item.length > 200)) next.offerings = "۱ تا ۱۰ مورد، هرکدام حداکثر ۲۰۰ نویسه وارد کنید.";
      if (dna.valueProposition.trim().length < 20 || dna.valueProposition.trim().length > 500) next.valueProposition = "ارزش پیشنهادی باید بین ۲۰ تا ۵۰۰ نویسه باشد.";
      if (!differentiators.length || differentiators.length > 5 || differentiators.some((item) => item.length > 300)) next.differentiators = "۱ تا ۵ دلیل، هرکدام حداکثر ۳۰۰ نویسه وارد کنید.";
    }
    if (step === "AUDIENCE") {
      if (!dna.targetAudience.trim() || dna.targetAudience.trim().length > 1000) next.targetAudience = "مخاطب اصلی را در حداکثر ۱۰۰۰ نویسه توضیح دهید.";
      if (!brand.audienceProblem.trim() || brand.audienceProblem.trim().length > 1000) next.audienceProblem = "مسئله مشتری را در حداکثر ۱۰۰۰ نویسه توضیح دهید.";
    }
    if (step === "BRAND") {
      if (brand.personality.length < 2 || brand.personality.length > 4 || brand.personality.some((item) => item.length > 100)) next.personality = "۲ تا ۴ ویژگی انتخاب کنید.";
      if (!brand.tone.trim()) next.tone = "لحن و سبک بیان برند را انتخاب یا وارد کنید.";
      if (cleanList(brand.prohibitedPatterns).some((item) => item.length > 300)) next.prohibitedPatterns = "هر ادعا حداکثر ۳۰۰ نویسه باشد.";
    }
    setErrors(next); return Object.keys(next).length === 0;
  };

  const saveDna = async (fields: Record<string, unknown>) => {
    const isDraft = dnaVersion?.status === "draft";
    const path = isDraft && dnaVersion ? `/api/business-dna/versions/${dnaVersion.id}` : "/api/business-dna/versions";
    const response = await apiFetch(path, { method: isDraft ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(isDraft ? fields : { ...(dnaVersion || {}), ...fields, id: undefined, status: undefined, versionNumber: undefined, businessProfileId: undefined, createdByUserId: undefined, createdAt: undefined, updatedAt: undefined, activatedAt: undefined, archivedAt: undefined }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.message); setDnaVersion(data.version);
  };
  const saveBrand = async (fields: Record<string, unknown>) => {
    const isDraft = brandVersion?.status === "draft";
    const path = isDraft && brandVersion ? `/api/brand-book/versions/${brandVersion.id}` : "/api/brand-book/versions";
    const response = await apiFetch(path, { method: isDraft ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(isDraft ? fields : { ...(brandVersion || {}), ...fields, id: undefined, status: undefined, versionNumber: undefined, businessProfileId: undefined, createdByUserId: undefined, createdAt: undefined, updatedAt: undefined, activatedAt: undefined, archivedAt: undefined }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.message); setBrandVersion(data.version);
  };

  const continueStep = async () => {
    if (!validate()) {
      setTimeout(() => {
        const alert = document.querySelector<HTMLElement>("[role='alert']");
        const field = alert?.previousElementSibling;
        if (field instanceof HTMLElement) field.focus();
      }, 0);
      return;
    }
    setSaving(true); setSaved(false); setRequestError("");
    try {
      if (step === "BUSINESS") {
        const response = await apiFetch("/api/business-profile", { method: profileExists ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...business, website: business.website || null, country: business.country || null, primaryLanguage: business.primaryLanguage || "فارسی" }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.message); setProfileExists(true);
      }
      if (step === "OFFERING") await saveDna({ offerings: cleanList(dna.offerings), valueProposition: dna.valueProposition.trim(), differentiators: cleanList(dna.differentiators) });
      if (step === "AUDIENCE") await Promise.all([
        saveDna({ targetAudiences: [dna.targetAudience.trim()], goals: cleanList(dna.goals).slice(0, 3) }),
        saveBrand({ brandIdentity: { ...(brandVersion?.brandIdentity || {}), audienceProblem: brand.audienceProblem.trim() } }),
      ]);
      if (step === "BRAND") await saveBrand({ brandPersonality: brand.personality, toneOfVoice: brand.tone.trim(), keyPhrases: cleanList(brand.keyPhrases), prohibitedPatterns: cleanList(brand.prohibitedPatterns) });
      setSaved(true); const next = sequence[Math.min(sequence.indexOf(step) + 1, 4)]; setStep(next); await loadDetails(next);
    } catch (error) { setRequestError(error instanceof Error ? error.message : "ذخیره اطلاعات انجام نشد."); }
    finally { setSaving(false); }
  };

  const finalize = async () => {
    setSaving(true); setRequestError("");
    try { const response = await apiFetch("/api/onboarding/finalize", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); const data = await response.json(); if (!response.ok) throw new Error(data.message); setStatus(data.onboarding); navigate(data.nextDestination || "/dashboard/content?template=instagram"); }
    catch (error) { setRequestError(error instanceof Error ? error.message : "تکمیل راه‌اندازی انجام نشد."); }
    finally { setSaving(false); }
  };

  if (loading) return <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#050507] text-white/60">در حال آماده‌سازی راه‌اندازی…</main>;
  if (!status || requestError && !profileExists && !dnaVersion && !brandVersion) return <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#050507] px-6 text-red-300">{requestError || "وضعیت راه‌اندازی در دسترس نیست."}</main>;
  return <main dir="rtl" className="min-h-screen bg-[#050507] px-4 py-8 text-white sm:px-6">
    <div className="mx-auto max-w-3xl rounded-[28px] border border-white/10 bg-[#0b0c12] p-5 shadow-2xl sm:p-9">
      <OnboardingProgress current={step} />
      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none sm:text-3xl">{titles[step][0]}</h1>
      <p className="mt-2 leading-8 text-white/55">{titles[step][1]}</p>
      <div className="mt-7">
        {step === "BUSINESS" && <BusinessStep value={business} onChange={setBusiness} errors={errors} />}
        {step === "OFFERING" && <OfferingStep value={dna} onChange={setDna} errors={errors} />}
        {step === "AUDIENCE" && <AudienceStep dna={dna} brand={brand} onDnaChange={setDna} onBrandChange={setBrand} errors={errors} />}
        {step === "BRAND" && <BrandVoiceStep value={brand} onChange={setBrand} errors={errors} />}
        {step === "REVIEW" && <ReviewStep business={business} dna={dna} brand={brand} onEdit={async (target) => { setStep(target); await loadDetails(target); }} />}
      </div>
      {requestError && <p role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{requestError}</p>}
      {saved && <p role="status" className="mt-5 text-sm text-emerald-300">اطلاعات ذخیره شد.</p>}
      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button type="button" disabled={saving || sequence.indexOf(step) === 0} onClick={() => setStep(sequence[sequence.indexOf(step) - 1])} className="min-h-11 rounded-xl border border-white/10 px-5 disabled:opacity-30">بازگشت</button>
        <button type="button" disabled={saving} onClick={() => void (step === "REVIEW" ? finalize() : continueStep())} className="min-h-12 rounded-xl bg-gradient-to-l from-violet-500 to-fuchsia-500 px-7 font-semibold disabled:opacity-50">{saving ? "در حال ذخیره…" : step === "REVIEW" ? status.contextStale ? "به‌روزرسانی شناخت کسب‌وکار" : "تکمیل راه‌اندازی" : "ادامه"}</button>
      </div>
      {step === "REVIEW" && <p className="mt-5 text-center text-sm text-white/40">در این مرحله محتوایی تولید نمی‌شود. فقط شناخت کسب‌وکار شما آماده خواهد شد.</p>}
    </div>
  </main>;
}
