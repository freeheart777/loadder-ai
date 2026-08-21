import { performance } from "node:perf_hooks";

import { requireWorkspaceId } from "../tenant-context.mjs";
import {
  audienceMeetsOnboardingMinimum,
  brandMeetsOnboardingMinimum,
  deriveOnboardingStatus,
  offeringMeetsOnboardingMinimum,
  profileMeetsOnboardingMinimum,
} from "../onboarding/onboarding-status.mjs";

export class OnboardingError extends Error {
  constructor(message, status = 400, code = "ONBOARDING_FINALIZATION_FAILED") {
    super(message);
    this.name = "OnboardingError";
    this.status = status;
    this.code = code;
  }
}

export function createOnboardingService({
  businessProfileService,
  businessDnaService,
  brandBookService,
  businessContextService,
  operationMetrics,
}) {
  function readState() {
    return {
      profile: businessProfileService.getBusinessProfile(),
      dnaState: businessDnaService.getCurrent(),
      brandState: brandBookService.getCurrent(),
      contextState: businessContextService.getCurrent(),
    };
  }

  function status() {
    const started = performance.now();
    const onboarding = deriveOnboardingStatus(readState());
    operationMetrics?.record({
      operation: "onboarding.status",
      workspaceId: requireWorkspaceId(),
      durationMs: performance.now() - started,
      rowsRead: 4,
      resultCount: 1,
    });
    return onboarding;
  }

  function finalize(payload, userId) {
    const started = performance.now();
    let errorCode = null;
    try {
      if (payload && (typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload).length)) {
        throw new OnboardingError("Onboarding finalization does not accept business data.", 400, "ONBOARDING_FIELDS_FORBIDDEN");
      }
      let state = readState();
      if (!profileMeetsOnboardingMinimum(state.profile)) {
        throw new OnboardingError("Business information is incomplete.", 409, "ONBOARDING_PROFILE_INCOMPLETE");
      }
      const dna = state.dnaState.latestDraft || state.dnaState.activeVersion;
      if (!offeringMeetsOnboardingMinimum(dna)) {
        throw new OnboardingError("Offering information is incomplete.", 409, "ONBOARDING_OFFERING_INCOMPLETE");
      }
      const brand = state.brandState.latestDraft || state.brandState.activeVersion;
      if (!audienceMeetsOnboardingMinimum(dna, brand)) {
        throw new OnboardingError("Audience information is incomplete.", 409, "ONBOARDING_AUDIENCE_INCOMPLETE");
      }
      if (!brandMeetsOnboardingMinimum(brand)) {
        throw new OnboardingError("Brand information is incomplete.", 409, "ONBOARDING_BRAND_INCOMPLETE");
      }

      if (state.dnaState.latestDraft) businessDnaService.activateVersion(state.dnaState.latestDraft.id, userId);
      if (state.brandState.latestDraft) brandBookService.activateVersion(state.brandState.latestDraft.id, userId);
      state = readState();

      const activeContext = state.contextState.activeContext;
      const currentSources = state.contextState.currentSources;
      const exactSources = activeContext &&
        activeContext.sourceManifest?.businessProfile?.id === currentSources.businessProfile?.id &&
        activeContext.sourceManifest?.businessProfile?.updatedAt === currentSources.businessProfile?.updatedAt &&
        activeContext.sourceManifest?.businessDna?.id === currentSources.businessDna?.id &&
        activeContext.sourceManifest?.brandBook?.id === currentSources.brandBook?.id;
      let reusedContext = Boolean(
        exactSources && !state.contextState.isStale && activeContext.contextSchemaVersion === "1.0"
      );
      if (!reusedContext) {
        const existingDraft = state.contextState.latestDraft;
        const exactDraftSources = existingDraft &&
          existingDraft.contextSchemaVersion === "1.0" &&
          existingDraft.sourceManifest?.businessProfile?.id === currentSources.businessProfile?.id &&
          existingDraft.sourceManifest?.businessProfile?.updatedAt === currentSources.businessProfile?.updatedAt &&
          existingDraft.sourceManifest?.businessDna?.id === currentSources.businessDna?.id &&
          existingDraft.sourceManifest?.brandBook?.id === currentSources.brandBook?.id;
        let draft = exactDraftSources ? existingDraft : null;
        if (!draft) {
          try {
            draft = businessContextService.createDraft({}, userId);
          } catch {
            throw new OnboardingError("Unable to prepare business context.", 500, "ONBOARDING_CONTEXT_CREATE_FAILED");
          }
        }
        try {
          businessContextService.activateVersion(draft.id, userId);
        } catch {
          throw new OnboardingError("Unable to activate business context.", 500, "ONBOARDING_CONTEXT_ACTIVATE_FAILED");
        }
      }
      const onboarding = deriveOnboardingStatus(readState());
      if (!onboarding.complete) {
        throw new OnboardingError("Onboarding could not be completed.", 500, "ONBOARDING_FINALIZATION_FAILED");
      }
      return { onboarding, nextDestination: "/dashboard/content?template=instagram", reusedContext };
    } catch (error) {
      errorCode = error.code || "ONBOARDING_FINALIZATION_FAILED";
      if (error instanceof OnboardingError) throw error;
      throw new OnboardingError("Unable to complete onboarding.", 500, "ONBOARDING_FINALIZATION_FAILED");
    } finally {
      operationMetrics?.record({
        operation: "onboarding.finalize",
        workspaceId: requireWorkspaceId(),
        durationMs: performance.now() - started,
        rowsRead: 4,
        resultCount: errorCode ? 0 : 1,
        errorCode,
      });
    }
  }

  return Object.freeze({ status, finalize });
}
