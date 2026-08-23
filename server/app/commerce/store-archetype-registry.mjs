const entries=[
 ["FASHION",["size","color","material","fit"],["size","color"],true,false,["PRODUCT_GRID","COLLECTION_RAIL","PRODUCT_GALLERY","VARIANT_SELECTOR","PRICE_BLOCK","COMMERCE_TRUST"]],
 ["ELECTRONICS",["brand","storage","ram","battery","power","connectivity"],["storage","color"],true,true,["CATEGORY_GRID","PRODUCT_GRID","PRODUCT_INFO","SPECIFICATION_TABLE","PRICE_BLOCK","COMMERCE_TRUST"]],
 ["BEAUTY",["brand","skin_type","volume","ingredients"],["volume","shade"],true,true,["CATEGORY_GRID","PRODUCT_GRID","PRODUCT_GALLERY","VARIANT_SELECTOR","COMMERCE_TRUST"]],
 ["HOME",["brand","material","dimensions","color"],["color","size"],true,true,["CATEGORY_GRID","PRODUCT_GRID","PRODUCT_INFO","SPECIFICATION_TABLE","COMMERCE_TRUST"]],
 ["GENERAL_COMMERCE",["brand","model","material"],["option"],true,false,["CATEGORY_GRID","PRODUCT_GRID","PRODUCT_INFO","PRICE_BLOCK","COMMERCE_TRUST"]]
].map(([archetype,recommendedAttributes,recommendedVariantAxes,filteringEnabled,comparisonEnabled,storefrontComponents])=>Object.freeze({archetype,version:1,recommendedAttributes:Object.freeze(recommendedAttributes),recommendedVariantAxes:Object.freeze(recommendedVariantAxes),filteringEnabled,comparisonEnabled,storefrontComponents:Object.freeze(storefrontComponents)}));
export const storeArchetypeRegistry=Object.freeze({version:1,get:id=>entries.find(x=>x.archetype===id)||null,list:()=>Object.freeze(entries)});
