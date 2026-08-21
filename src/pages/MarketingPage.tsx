import {
  Activity,
  ArrowUpRight,
  BadgeDollarSign,
  BarChart3,
  Boxes,
  CircleDollarSign,
  Eye,
  Gauge,
  Layers3,
  Loader2,
  Megaphone,
  MousePointerClick,
  RefreshCw,
  ShoppingCart,
  Target,
  TrendingUp,
  UserRoundCheck,
  Users,
  WalletCards,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiFetch } from "../lib/api";

/* =========================================================
   TYPES
========================================================= */

type MarketingChannel = {
  id: string;
  name: string;
  nameFa: string;
  type: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type AdvertisingService = {
  id: string;
  platformId: string;
  name: string;
  nameFa: string;
  serviceType: string;
  format: string | null;
  enabled: boolean;
};

type MarketingPlatform = {
  id: string;
  channelId: string;
  name: string;
  nameFa: string;
  providerKey: string;
  enabled: boolean;
  services?: AdvertisingService[];
};

type MarketingStructureChannel =
  MarketingChannel & {
    platforms: MarketingPlatform[];
  };

type Campaign = {
  id: string;
  channelId: string;
  platformId: string;
  serviceId: string | null;
  name: string;
  strategy: string;
  objective: string | null;
  status: string;
  budget: number;
  currency: string;
  externalId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CampaignKpis = {
  spend: number;
  impressions: number;
  views: number;
  clicks: number;
  sessions: number;
  leads: number;
  orders: number;
  customers: number;
  conversions: number;
  revenue: number;

  cpm: number;
  cpv: number;
  cpc: number;
  cps: number;
  cpl: number;
  cpo: number;
  cac: number;
  cpa: number;

  ctr: number;
  viewRate: number;
  sessionRate: number;
  leadRate: number;
  orderRate: number;
  customerRate: number;
  conversionRate: number;
  roas: number;
};

type AttributedPerformance = {
  campaignId: string;

  attributionModel: string;

  attributed: {
    leads: number;
    customers: number;
    orders: number;
    revenue: number;
  };

  media: {
    spend: number;
    impressions: number;
    views: number;
    clicks: number;
    sessions: number;
  };

  kpis: {
    cpm: number;
    cpv: number;
    cpc: number;
    cps: number;
    cpl: number;
    cpo: number;
    cac: number;
    roas: number;
  };
};

type CampaignOverview = {
  campaign: Campaign;
  kpis: CampaignKpis;
  performance?: AttributedPerformance;
};

type OverviewResponse = {
  ok: boolean;

  data: {
    campaignsCount: number;
    totals?: CampaignKpis;
    campaigns: CampaignOverview[];
  };
};

type ChannelsResponse = {
  ok: boolean;
  count: number;
  data: MarketingChannel[];
};

type StructureResponse = {
  ok: boolean;
  count: number;
  data: MarketingStructureChannel[];
};

/* =========================================================
   CONFIG
========================================================= */

/* =========================================================
   HELPERS
========================================================= */

function faNumber(
  value: number,
  maximumFractionDigits = 0
) {
  return new Intl.NumberFormat(
    "fa-IR",
    {
      maximumFractionDigits,
    }
  ).format(
    Number(value) || 0
  );
}

function money(
  value: number
) {
  return `${faNumber(
    value
  )} ریال`;
}

function percent(
  value: number
) {
  return `${faNumber(
    value,
    2
  )}٪`;
}

function multiple(
  value: number
) {
  return `${faNumber(
    value,
    2
  )}x`;
}

function campaignStatusLabel(
  status: string
) {
  switch (status) {
    case "active":
      return "فعال";

    case "paused":
      return "متوقف";

    case "draft":
      return "پیش‌نویس";

    case "completed":
      return "پایان‌یافته";

    default:
      return status;
  }
}

function strategyLabel(
  strategy: string
) {
  switch (strategy) {
    case "acquisition":
      return "جذب";

    case "retargeting":
      return "ریتارگتینگ";

    case "re_engagement":
      return "بازگشت مجدد";

    case "awareness":
      return "آگاهی";

    default:
      return strategy;
  }
}

function channelIcon(
  channelId: string
) {
  switch (channelId) {
    case "google_ads":
      return Target;

    case "iranian_ads":
      return Megaphone;

    case "social_ads":
      return Users;

    case "app_ads":
      return Boxes;

    case "sms_marketing":
      return Activity;

    case "affiliate":
      return BadgeDollarSign;

    default:
      return Layers3;
  }
}

/* =========================================================
   SMALL COMPONENTS
========================================================= */

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 backdrop-blur-xl">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
          <Icon
            size={20}
            strokeWidth={1.8}
          />
        </div>

        <ArrowUpRight
          size={17}
          className="opacity-40"
        />
      </div>

      <div className="text-sm text-white/50">
        {title}
      </div>

      <div className="mt-2 text-2xl font-semibold tracking-tight">
        {value}
      </div>

      {description ? (
        <div className="mt-2 text-xs leading-6 text-white/35">
          {description}
        </div>
      ) : null}
    </div>
  );
}

function FunnelItem({
  label,
  value,
  percentage,
  icon: Icon,
}: {
  label: string;
  value: number;
  percentage: number;
  icon: React.ElementType;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06]">
            <Icon
              size={18}
              strokeWidth={1.8}
            />
          </div>

          <div>
            <div className="text-sm font-medium">
              {label}
            </div>

            <div className="mt-1 text-xs text-white/40">
              {percent(
                percentage
              )}
            </div>
          </div>
        </div>

        <div className="text-xl font-semibold">
          {faNumber(value)}
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className="h-full rounded-full bg-white/60 transition-all duration-500"
          style={{
            width: `${Math.min(
              Math.max(
                percentage,
                3
              ),
              100
            )}%`,
          }}
        />
      </div>
    </div>
  );
}

function KpiRow({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] py-3 last:border-b-0">
      <span className="text-sm text-white/45">
        {title}
      </span>

      <span className="text-sm font-semibold">
        {value}
      </span>
    </div>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function MarketingPage() {
  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    channels,
    setChannels,
  ] = useState<
    MarketingChannel[]
  >([]);

  const [
    structure,
    setStructure,
  ] = useState<
    MarketingStructureChannel[]
  >([]);

  const [
    campaigns,
    setCampaigns,
  ] = useState<
    CampaignOverview[]
  >([]);

  const [
    selectedChannel,
    setSelectedChannel,
  ] = useState(
    "all"
  );

  const [
    selectedCampaignId,
    setSelectedCampaignId,
  ] = useState<
    string | null
  >(null);

  /* =======================================================
     FETCH
  ======================================================= */

  const fetchData =
    useCallback(
      async (
        isRefresh = false
      ) => {
        try {
          if (isRefresh) {
            setRefreshing(
              true
            );
          } else {
            setLoading(
              true
            );
          }

          setError(null);

          const [
            channelsResponse,
            structureResponse,
            overviewResponse,
          ] =
            await Promise.all([
              apiFetch("/api/marketing/channels"),

              apiFetch("/api/marketing/structure"),

              apiFetch("/api/marketing/overview"),
            ]);

          if (
            !channelsResponse.ok ||
            !structureResponse.ok ||
            !overviewResponse.ok
          ) {
            throw new Error(
              "Marketing API request failed"
            );
          }

          const channelsJson: ChannelsResponse =
            await channelsResponse.json();

          const structureJson: StructureResponse =
            await structureResponse.json();

          const overviewJson: OverviewResponse =
            await overviewResponse.json();

          setChannels(
            channelsJson.data ||
              []
          );

          setStructure(
            structureJson.data ||
              []
          );

          setCampaigns(
            overviewJson.data
              ?.campaigns ||
              []
          );

          setSelectedCampaignId(
            (current) => {
              if (
                current
              ) {
                return current;
              }

              return (
                overviewJson
                  .data
                  ?.campaigns?.[0]
                  ?.campaign
                  ?.id ||
                null
              );
            }
          );
        } catch (err) {
          console.error(
            err
          );

          setError(
            "اتصال به Marketing Backend برقرار نشد."
          );
        } finally {
          setLoading(
            false
          );

          setRefreshing(
            false
          );
        }
      },
      []
    );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* =======================================================
     FILTERS
  ======================================================= */

  const filteredCampaigns =
    useMemo(() => {
      if (
        selectedChannel ===
        "all"
      ) {
        return campaigns;
      }

      return campaigns.filter(
        (item) =>
          item.campaign
            .channelId ===
          selectedChannel
      );
    }, [
      campaigns,
      selectedChannel,
    ]);

  useEffect(() => {
    if (
      filteredCampaigns
        .length === 0
    ) {
      setSelectedCampaignId(
        null
      );

      return;
    }

    const exists =
      filteredCampaigns.some(
        (item) =>
          item.campaign.id ===
          selectedCampaignId
      );

    if (!exists) {
      setSelectedCampaignId(
        filteredCampaigns[0]
          .campaign.id
      );
    }
  }, [
    filteredCampaigns,
    selectedCampaignId,
  ]);

  const selectedCampaign =
    useMemo(
      () =>
        campaigns.find(
          (item) =>
            item.campaign.id ===
            selectedCampaignId
        ) || null,
      [
        campaigns,
        selectedCampaignId,
      ]
    );

  /* =======================================================
     TOTALS
  ======================================================= */

  const totals =
    useMemo(() => {
      const result = {
        spend: 0,
        impressions: 0,
        views: 0,
        clicks: 0,
        sessions: 0,
        leads: 0,
        customers: 0,
        orders: 0,
        revenue: 0,
      };

      campaigns.forEach(
        (item) => {
          const p =
            item.performance;

          if (p) {
            result.spend +=
              p.media.spend;

            result.impressions +=
              p.media
                .impressions;

            result.views +=
              p.media.views;

            result.clicks +=
              p.media.clicks;

            result.sessions +=
              p.media.sessions;

            result.leads +=
              p.attributed
                .leads;

            result.customers +=
              p.attributed
                .customers;

            result.orders +=
              p.attributed
                .orders;

            result.revenue +=
              p.attributed
                .revenue;

            return;
          }

          result.spend +=
            item.kpis.spend;

          result.impressions +=
            item.kpis
              .impressions;

          result.views +=
            item.kpis.views;

          result.clicks +=
            item.kpis.clicks;

          result.sessions +=
            item.kpis
              .sessions;

          result.leads +=
            item.kpis.leads;

          result.customers +=
            item.kpis
              .customers;

          result.orders +=
            item.kpis.orders;

          result.revenue +=
            item.kpis.revenue;
        }
      );

      return result;
    }, [campaigns]);

  const globalKpis =
    useMemo(() => {
      const divide = (
        a: number,
        b: number
      ) =>
        b > 0
          ? a / b
          : 0;

      return {
        cpc: divide(
          totals.spend,
          totals.clicks
        ),

        cps: divide(
          totals.spend,
          totals.sessions
        ),

        cpl: divide(
          totals.spend,
          totals.leads
        ),

        cpo: divide(
          totals.spend,
          totals.orders
        ),

        cac: divide(
          totals.spend,
          totals.customers
        ),

        roas: divide(
          totals.revenue,
          totals.spend
        ),

        ctr:
          divide(
            totals.clicks,
            totals.impressions
          ) * 100,
      };
    }, [totals]);

  /* =======================================================
     FUNNEL
  ======================================================= */

  const funnel =
    useMemo(() => {
      const base =
        Math.max(
          totals.impressions,
          1
        );

      return [
        {
          label:
            "نمایش",
          value:
            totals.impressions,
          percentage:
            100,
          icon: Eye,
        },

        {
          label:
            "کلیک",
          value:
            totals.clicks,
          percentage:
            (totals.clicks /
              base) *
            100,
          icon:
            MousePointerClick,
        },

        {
          label:
            "Session",
          value:
            totals.sessions,
          percentage:
            (totals.sessions /
              base) *
            100,
          icon:
            Activity,
        },

        {
          label:
            "لید",
          value:
            totals.leads,
          percentage:
            (totals.leads /
              base) *
            100,
          icon:
            Users,
        },

        {
          label:
            "مشتری",
          value:
            totals.customers,
          percentage:
            (totals.customers /
              base) *
            100,
          icon:
            UserRoundCheck,
        },

        {
          label:
            "سفارش",
          value:
            totals.orders,
          percentage:
            (totals.orders /
              base) *
            100,
          icon:
            ShoppingCart,
        },
      ];
    }, [totals]);

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#070709] text-white"
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2
            className="animate-spin"
            size={28}
          />

          <div className="text-sm text-white/50">
            در حال دریافت داده‌های مارکتینگ...
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#070709] text-white"
    >
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {/* HEADER */}

        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-white/40">
              <Gauge
                size={17}
              />

              Loadder Marketing Intelligence
            </div>

            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              مرکز فرماندهی مارکتینگ
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/45">
              مشاهده یکپارچه عملکرد تبلیغات،
              لیدها، مشتریان، سفارش‌ها و
              درآمد منتسب‌شده به کمپین‌ها.
            </p>
          </div>

          <button
            onClick={() =>
              fetchData(true)
            }
            disabled={
              refreshing
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />

            بروزرسانی
          </button>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {/* CHANNELS */}

        <div className="mb-7 flex gap-3 overflow-x-auto pb-2">
          <button
            onClick={() =>
              setSelectedChannel(
                "all"
              )
            }
            className={`shrink-0 rounded-2xl border px-4 py-3 text-sm transition ${
              selectedChannel ===
              "all"
                ? "border-white/30 bg-white text-black"
                : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"
            }`}
          >
            همه کانال‌ها
          </button>

          {channels.map(
            (channel) => {
              const Icon =
                channelIcon(
                  channel.id
                );

              return (
                <button
                  key={
                    channel.id
                  }
                  onClick={() =>
                    setSelectedChannel(
                      channel.id
                    )
                  }
                  className={`flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-3 text-sm transition ${
                    selectedChannel ===
                    channel.id
                      ? "border-white/30 bg-white text-black"
                      : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"
                  }`}
                >
                  <Icon
                    size={16}
                  />

                  {
                    channel.nameFa
                  }
                </button>
              );
            }
          )}
        </div>

        {/* MAIN METRICS */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="هزینه تبلیغات"
            value={money(
              totals.spend
            )}
            description="کل Media Spend ثبت‌شده"
            icon={
              WalletCards
            }
          />

          <MetricCard
            title="درآمد منتسب"
            value={money(
              totals.revenue
            )}
            description="Revenue متصل به CRM و Attribution"
            icon={
              CircleDollarSign
            }
          />

          <MetricCard
            title="ROAS واقعی"
            value={multiple(
              globalKpis.roas
            )}
            description="Attributed Revenue ÷ Ad Spend"
            icon={
              TrendingUp
            }
          />

          <MetricCard
            title="لید منتسب"
            value={faNumber(
              totals.leads
            )}
            description="لیدهایی که منبع تبلیغاتی دارند"
            icon={Users}
          />
        </div>

        {/* COST KPIs */}

        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard
            title="CPC"
            value={money(
              globalKpis.cpc
            )}
            icon={
              MousePointerClick
            }
          />

          <MetricCard
            title="CPS"
            value={money(
              globalKpis.cps
            )}
            description="Cost Per Session"
            icon={Activity}
          />

          <MetricCard
            title="CPL"
            value={money(
              globalKpis.cpl
            )}
            icon={Users}
          />

          <MetricCard
            title="CPO"
            value={money(
              globalKpis.cpo
            )}
            icon={
              ShoppingCart
            }
          />

          <MetricCard
            title="CAC"
            value={money(
              globalKpis.cac
            )}
            icon={
              UserRoundCheck
            }
          />

          <MetricCard
            title="CTR"
            value={percent(
              globalKpis.ctr
            )}
            icon={
              MousePointerClick
            }
          />
        </div>

        {/* FUNNEL + CHANNEL STRUCTURE */}

        <div className="mt-7 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
            <div className="mb-6">
              <div className="flex items-center gap-2">
                <BarChart3
                  size={19}
                />

                <h2 className="font-semibold">
                  قیف جذب تا فروش
                </h2>
              </div>

              <p className="mt-2 text-xs leading-6 text-white/40">
                حرکت واقعی از نمایش تبلیغ تا
                Session، لید، مشتری و سفارش
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {funnel.map(
                (item) => (
                  <FunnelItem
                    key={
                      item.label
                    }
                    {...item}
                  />
                )
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-2">
              <Layers3
                size={19}
              />

              <h2 className="font-semibold">
                ساختار کانال‌ها
              </h2>
            </div>

            <div className="space-y-3">
              {structure.map(
                (channel) => {
                  const Icon =
                    channelIcon(
                      channel.id
                    );

                  return (
                    <div
                      key={
                        channel.id
                      }
                      className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06]">
                          <Icon
                            size={
                              17
                            }
                          />
                        </div>

                        <div className="flex-1">
                          <div className="text-sm font-medium">
                            {
                              channel.nameFa
                            }
                          </div>

                          <div className="mt-1 text-xs text-white/35">
                            {faNumber(
                              channel
                                .platforms
                                .length
                            )}{" "}
                            پلتفرم
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {channel.platforms.map(
                          (
                            platform
                          ) => (
                            <span
                              key={
                                platform.id
                              }
                              className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-white/45"
                            >
                              {
                                platform.nameFa
                              }
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </section>
        </div>

        {/* CAMPAIGNS */}

        <section className="mt-7 rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Megaphone
                  size={19}
                />

                <h2 className="font-semibold">
                  کمپین‌ها
                </h2>
              </div>

              <p className="mt-2 text-xs text-white/40">
                عملکرد Media + داده واقعی
                Attribution و CRM
              </p>
            </div>

            <div className="text-xs text-white/35">
              {faNumber(
                filteredCampaigns.length
              )}{" "}
              کمپین
            </div>
          </div>

          {filteredCampaigns.length ===
          0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center text-sm text-white/35">
              هنوز برای این کانال کمپینی
              ثبت نشده است.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] border-collapse text-right">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-white/35">
                    <th className="px-3 py-4 font-normal">
                      کمپین
                    </th>

                    <th className="px-3 py-4 font-normal">
                      وضعیت
                    </th>

                    <th className="px-3 py-4 font-normal">
                      Spend
                    </th>

                    <th className="px-3 py-4 font-normal">
                      Session
                    </th>

                    <th className="px-3 py-4 font-normal">
                      Lead
                    </th>

                    <th className="px-3 py-4 font-normal">
                      Order
                    </th>

                    <th className="px-3 py-4 font-normal">
                      Revenue
                    </th>

                    <th className="px-3 py-4 font-normal">
                      CPL
                    </th>

                    <th className="px-3 py-4 font-normal">
                      CAC
                    </th>

                    <th className="px-3 py-4 font-normal">
                      ROAS
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCampaigns.map(
                    (item) => {
                      const campaign =
                        item.campaign;

                      const p =
                        item.performance;

                      const media =
                        p?.media;

                      const attributed =
                        p?.attributed;

                      const kpi =
                        p?.kpis ||
                        item.kpis;

                      const selected =
                        selectedCampaignId ===
                        campaign.id;

                      return (
                        <tr
                          key={
                            campaign.id
                          }
                          onClick={() =>
                            setSelectedCampaignId(
                              campaign.id
                            )
                          }
                          className={`cursor-pointer border-b border-white/[0.05] text-sm transition ${
                            selected
                              ? "bg-white/[0.06]"
                              : "hover:bg-white/[0.025]"
                          }`}
                        >
                          <td className="px-3 py-4">
                            <div className="font-medium">
                              {
                                campaign.name
                              }
                            </div>

                            <div className="mt-1 text-[11px] text-white/35">
                              {strategyLabel(
                                campaign.strategy
                              )}
                            </div>
                          </td>

                          <td className="px-3 py-4">
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs">
                              {campaignStatusLabel(
                                campaign.status
                              )}
                            </span>
                          </td>

                          <td className="px-3 py-4">
                            {money(
                              media?.spend ??
                                item
                                  .kpis
                                  .spend
                            )}
                          </td>

                          <td className="px-3 py-4">
                            {faNumber(
                              media?.sessions ??
                                item
                                  .kpis
                                  .sessions
                            )}
                          </td>

                          <td className="px-3 py-4">
                            {faNumber(
                              attributed?.leads ??
                                item
                                  .kpis
                                  .leads
                            )}
                          </td>

                          <td className="px-3 py-4">
                            {faNumber(
                              attributed?.orders ??
                                item
                                  .kpis
                                  .orders
                            )}
                          </td>

                          <td className="px-3 py-4">
                            {money(
                              attributed?.revenue ??
                                item
                                  .kpis
                                  .revenue
                            )}
                          </td>

                          <td className="px-3 py-4">
                            {money(
                              kpi.cpl
                            )}
                          </td>

                          <td className="px-3 py-4">
                            {money(
                              kpi.cac
                            )}
                          </td>

                          <td className="px-3 py-4 font-semibold">
                            {multiple(
                              kpi.roas
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* CAMPAIGN DETAIL */}

        {selectedCampaign ? (
          <section className="mt-7 grid gap-6 xl:grid-cols-[1fr_.7fr]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-white/35">
                    Campaign Intelligence
                  </div>

                  <h3 className="mt-2 text-xl font-semibold">
                    {
                      selectedCampaign
                        .campaign
                        .name
                    }
                  </h3>

                  <div className="mt-2 text-xs text-white/40">
                    {strategyLabel(
                      selectedCampaign
                        .campaign
                        .strategy
                    )}
                    {" • "}
                    {campaignStatusLabel(
                      selectedCampaign
                        .campaign
                        .status
                    )}
                  </div>
                </div>

                <Target
                  size={24}
                  className="opacity-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-white/[0.03] p-4">
                  <div className="text-xs text-white/35">
                    Spend
                  </div>

                  <div className="mt-2 font-semibold">
                    {money(
                      selectedCampaign
                        .performance
                        ?.media
                        .spend ??
                        selectedCampaign
                          .kpis
                          .spend
                    )}
                  </div>
                </div>

                <div className="rounded-2xl bg-white/[0.03] p-4">
                  <div className="text-xs text-white/35">
                    Revenue
                  </div>

                  <div className="mt-2 font-semibold">
                    {money(
                      selectedCampaign
                        .performance
                        ?.attributed
                        .revenue ??
                        selectedCampaign
                          .kpis
                          .revenue
                    )}
                  </div>
                </div>

                <div className="rounded-2xl bg-white/[0.03] p-4">
                  <div className="text-xs text-white/35">
                    Orders
                  </div>

                  <div className="mt-2 font-semibold">
                    {faNumber(
                      selectedCampaign
                        .performance
                        ?.attributed
                        .orders ??
                        selectedCampaign
                          .kpis
                          .orders
                    )}
                  </div>
                </div>

                <div className="rounded-2xl bg-white/[0.03] p-4">
                  <div className="text-xs text-white/35">
                    ROAS
                  </div>

                  <div className="mt-2 font-semibold">
                    {multiple(
                      selectedCampaign
                        .performance
                        ?.kpis
                        .roas ??
                        selectedCampaign
                          .kpis
                          .roas
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
              <div className="mb-3 flex items-center gap-2">
                <Gauge
                  size={18}
                />

                <h3 className="font-semibold">
                  KPIهای کمپین
                </h3>
              </div>

              <KpiRow
                title="CPC"
                value={money(
                  selectedCampaign
                    .performance
                    ?.kpis.cpc ??
                    selectedCampaign
                      .kpis.cpc
                )}
              />

              <KpiRow
                title="CPS — Cost Per Session"
                value={money(
                  selectedCampaign
                    .performance
                    ?.kpis.cps ??
                    selectedCampaign
                      .kpis.cps
                )}
              />

              <KpiRow
                title="CPL"
                value={money(
                  selectedCampaign
                    .performance
                    ?.kpis.cpl ??
                    selectedCampaign
                      .kpis.cpl
                )}
              />

              <KpiRow
                title="CPO"
                value={money(
                  selectedCampaign
                    .performance
                    ?.kpis.cpo ??
                    selectedCampaign
                      .kpis.cpo
                )}
              />

              <KpiRow
                title="CAC"
                value={money(
                  selectedCampaign
                    .performance
                    ?.kpis.cac ??
                    selectedCampaign
                      .kpis.cac
                )}
              />

              <KpiRow
                title="ROAS"
                value={multiple(
                  selectedCampaign
                    .performance
                    ?.kpis.roas ??
                    selectedCampaign
                      .kpis.roas
                )}
              />
            </div>
          </section>
        ) : null}

        {/* FOOTER STATUS */}

        <div className="mt-7 rounded-3xl border border-white/10 bg-white/[0.025] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-medium">
                Marketing Intelligence فعال است
              </div>

              <div className="mt-1 text-xs leading-6 text-white/40">
                Media Metrics، Lead Attribution،
                Customer Conversion، Order و
                Revenue Attribution از Backend
                Loadder دریافت می‌شوند.
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-white/40">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />

              Backend متصل
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
