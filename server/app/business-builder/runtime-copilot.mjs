export class LoadderRuntimeCopilot {
  constructor({ dataAdapter, executor = null } = {}) {
    if (!dataAdapter) throw new TypeError("dataAdapter is required");
    this.dataAdapter = dataAdapter;
    this.executor = executor;
  }

  async summarize({ definition, projectId, message = "", context = {} }) {
    const entityCounts = [];
    for (const entity of definition.entities || []) {
      const total = await this.dataAdapter.count({ appId: definition.id, entityId: entity.id, query: {} });
      entityCounts.push({ entityId: entity.id, name: entity.name, total });
    }
    const snapshot = {
      appId: definition.id,
      projectId,
      vertical: definition.vertical,
      entities: entityCounts,
      workflows: (definition.workflows || []).map((w) => ({ id: w.id, name: w.name })),
    };
    if (this.executor) {
      return this.executor({ definition, message, snapshot, context });
    }
    const top = [...entityCounts].sort((a,b)=>b.total-a.total).slice(0,3);
    const totalRecords = entityCounts.reduce((sum,item)=>sum+item.total,0);
    const lines = [
      `این اپ ${entityCounts.length} موجودیت، ${definition.workflows?.length || 0} گردش‌کار و ${totalRecords} رکورد عملیاتی دارد.`,
      top.length ? `بیشترین داده فعلاً مربوط به ${top.map((x)=>`${x.name} (${x.total})`).join("، ")} است.` : "هنوز داده عملیاتی کافی برای تحلیل وجود ندارد.",
      message ? `درخواست شما: ${String(message).slice(0,240)}` : "می‌توانی درباره فروش، موجودی، مشتریان یا گردش‌کارها سؤال بپرسی.",
    ];
    return { mode: "owned-fallback", answer: lines.join(" "), snapshot };
  }
}
