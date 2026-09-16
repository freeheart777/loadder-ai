const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const string = (value) => typeof value === "string" ? value : undefined;
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : undefined;
const boolean = (value) => typeof value === "boolean" ? value : undefined;
const compact = (value) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));

const projectDesign = (value) => { const source = object(value); return compact({
  fontFamily:string(source.fontFamily),primaryColor:string(source.primaryColor),secondaryColor:string(source.secondaryColor),textColor:string(source.textColor),mutedTextColor:string(source.mutedTextColor),backgroundColor:string(source.backgroundColor),surfaceColor:string(source.surfaceColor),containerWidth:number(source.containerWidth),sectionSpacing:number(source.sectionSpacing),globalRadius:number(source.globalRadius),borderRadius:number(source.borderRadius),cardRadius:number(source.cardRadius),buttonRadius:number(source.buttonRadius),headingScale:number(source.headingScale),bodyScale:number(source.bodyScale),typographyScale:number(source.typographyScale),cardShadowStrength:number(source.cardShadowStrength),borderStrength:number(source.borderStrength),
}); };
const projectHeader = (value) => { const source = object(value); return compact({
  logoUrl:string(source.logoUrl),storeName:string(source.storeName),showSearch:boolean(source.showSearch),showAccount:boolean(source.showAccount),showCart:boolean(source.showCart),sticky:boolean(source.sticky),height:number(source.height),backgroundColor:string(source.backgroundColor),textColor:string(source.textColor),
}); };
const projectHero = (value) => { const source = object(value); return compact({
  enabled:boolean(source.enabled),layout:string(source.layout),eyebrow:string(source.eyebrow),title:string(source.title),subtitle:string(source.subtitle),ctaLabel:string(source.ctaLabel),ctaHref:string(source.ctaHref),imageUrl:string(source.imageUrl),backgroundColor:string(source.backgroundColor),textColor:string(source.textColor),overlayOpacity:number(source.overlayOpacity),height:number(source.height),alignment:string(source.alignment),
}); };
const projectProductSettings = (value) => { const source = object(value); return compact({
  source:string(source.source),productIds:Array.isArray(source.productIds)?source.productIds.filter((item)=>typeof item==="string").slice(0,100):undefined,columnsDesktop:number(source.columnsDesktop),columnsTablet:number(source.columnsTablet),columnsMobile:number(source.columnsMobile),imageRatio:string(source.imageRatio),cardStyle:string(source.cardStyle),showBrand:boolean(source.showBrand),showPrice:boolean(source.showPrice),showCompareAt:boolean(source.showCompareAt),showStock:boolean(source.showStock),showPromotionBadge:boolean(source.showPromotionBadge),showCartButton:boolean(source.showCartButton),
}); };
const projectSectionItems = (value) => Array.isArray(value) ? value.slice(0,60).map((entry,index)=>{const source=object(entry);return compact({
  id:string(source.id)||`public-item-${index+1}`,title:string(source.title),subtitle:string(source.subtitle),body:string(source.body),imageUrl:string(source.imageUrl),meta:string(source.meta),href:string(source.href),
});}) : undefined;
const projectContact = (value) => { const source=object(value); return compact({
  formEnabled:boolean(source.formEnabled),submitLabel:string(source.submitLabel),successMessage:string(source.successMessage),phone:string(source.phone),email:string(source.email),address:string(source.address),mapUrl:string(source.mapUrl),
}); };
const projectNav = (value) => { const source=object(value); return compact({enabled:boolean(source.enabled),ctaLabel:string(source.ctaLabel),ctaHref:string(source.ctaHref)}); };
const projectFooter = (value) => { const source=object(value); return compact({enabled:boolean(source.enabled),text:string(source.text),backgroundColor:string(source.backgroundColor),textColor:string(source.textColor)}); };
const projectSeo = (value) => { const source=object(value); return compact({title:string(source.title),description:string(source.description)}); };
const projectSections = (value, preserveSectionIds = false) => Array.isArray(value) ? value.slice(0,100).map((item,index)=>{const source=object(item);return compact({
  id:(preserveSectionIds && string(source.id)) || `public-section-${index+1}`,type:string(source.type),enabled:boolean(source.enabled),title:string(source.title),subtitle:string(source.subtitle),body:string(source.body),imageUrl:string(source.imageUrl),ctaLabel:string(source.ctaLabel),ctaHref:string(source.ctaHref),anchor:string(source.anchor),navLabel:string(source.navLabel),showInNav:boolean(source.showInNav),columns:number(source.columns),mediaPosition:string(source.mediaPosition),items:projectSectionItems(source.items),contact:source.contact?projectContact(source.contact):undefined,backgroundColor:string(source.backgroundColor),textColor:string(source.textColor),spacingTop:number(source.spacingTop),spacingBottom:number(source.spacingBottom),productSettings:source.productSettings?projectProductSettings(source.productSettings):undefined,
});}) : undefined;
const projectProductOverrides = (value) => Object.fromEntries(Object.entries(object(value)).slice(0,100).map(([productId,item])=>{const source=object(item);return[productId,compact({
  promotionBadge:boolean(source.promotionBadge),promotionBadgeText:string(source.promotionBadgeText),showDiscountPercentage:boolean(source.showDiscountPercentage),showStock:boolean(source.showStock),ctaLabel:string(source.ctaLabel),ctaStyle:string(source.ctaStyle),imageRatio:string(source.imageRatio),textAlign:string(source.textAlign),cardRadius:number(source.cardRadius),cardShadowStrength:number(source.cardShadowStrength),borderStrength:number(source.borderStrength),cardPadding:number(source.cardPadding),
})];}));
const projectCommerce = (value) => { const source=object(value); return compact({cartButtonLabel:string(source.cartButtonLabel),productOverrides:projectProductOverrides(source.productOverrides)}); };
const projectLegacyDesign = (value) => { const source=object(value); return compact({font:string(source.font),primary:string(source.primary),text:string(source.text),surface:string(source.surface),radius:number(source.radius),sectionGap:number(source.sectionGap),textScale:number(source.textScale)}); };

export function projectPublicStorePresentation(content, { preserveSectionIds = false, includeCommerce = true } = {}) {
  const result={};
  const v11=object(content?.storeBuilderV11),v13=object(content?.storeBuilderV13),v14=object(content?.storeBuilderV14),v15=object(content?.storeBuilderV15),v16=object(content?.storeBuilderV16);
  if(Object.keys(v11).length)result.storeBuilderV11=compact({design:projectLegacyDesign(v11.design),sections:projectSections(v11.sections)});
  if(Object.keys(v13).length)result.storeBuilderV13=compact({design:projectDesign(v13.design)});
  if(Object.keys(v14).length)result.storeBuilderV14=compact({commerce:projectCommerce(v14.commerce)});
  if(Object.keys(v15).length)result.storeBuilderV15=compact({design:projectDesign(v15.design),sections:projectSections(v15.sections),commerce:projectCommerce(v15.commerce)});
  if(Object.keys(v16).length)result.storeBuilderV16=compact({version:16,design:projectDesign(v16.design),header:projectHeader(v16.header),hero:projectHero(v16.hero),nav:projectNav(v16.nav),footer:projectFooter(v16.footer),seo:projectSeo(v16.seo),sections:projectSections(v16.sections,preserveSectionIds),commerce:includeCommerce?projectCommerce(v16.commerce):undefined});
  return result;
}
