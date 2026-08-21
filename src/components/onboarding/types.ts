export type StepId = "BUSINESS" | "OFFERING" | "AUDIENCE" | "BRAND" | "REVIEW" | "COMPLETE";

export type OnboardingStatus = {
  complete: boolean;
  currentStep: StepId;
  profileComplete: boolean;
  offeringComplete: boolean;
  audienceComplete: boolean;
  brandComplete: boolean;
  contextReady: boolean;
  contextStale: boolean;
  dnaDraftId: string | null;
  brandDraftId: string | null;
};

export type BusinessForm = {
  name: string; industry: string; description: string; website: string;
  country: string; primaryLanguage: string;
};
export type DnaForm = {
  offerings: string[]; valueProposition: string; differentiators: string[];
  targetAudience: string; goals: string[];
};
export type BrandForm = {
  audienceProblem: string; personality: string[]; tone: string;
  keyPhrases: string[]; prohibitedPatterns: string[];
};

export type StepProps<T> = {
  value: T;
  onChange: (value: T) => void;
  errors: Record<string, string>;
};
