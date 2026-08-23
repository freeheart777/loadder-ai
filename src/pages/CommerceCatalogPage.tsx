import { useEffect, useState } from "react";

import { Link } from "react-router-dom";

import { ArrowRight, Plus, ShoppingCart, Storefront } from "@phosphor-icons/react";

import { apiFetch } from "../lib/api";


type Catalog={id:string;
name:string;
slug:string;
archetype:string;
currency:string};

type Category={id:string;
name:string};

type Product={id:string;
name:string;
shortDescription:string|null;
basePrice:number;
compareAtPrice:number|null;
currency:string;
availabilityStatus:string;
status:string};

type Archetype={archetype:string;
label:string;
recommendedAttributes:Array<{key:string;
label:string}>};

const json=async(path:string,init?:RequestInit)=>{const r=await apiFetch(path,init);
const body=await r.json();
if(!r.ok)throw new Error(body.code||"خطا در عملیات کاتالوگ");
return body;
};

const post=(path:string,body:unknown)=>json(path,{method:"POST",headers:{"content-type":"application/json","Idempotency-Key":crypto.randomUUID()},body:JSON.stringify(body)});


export default function CommerceCatalogPage(){
 const[catalogs,setCatalogs]=useState<Catalog[]>([]),[archetypes,setArchetypes]=useState<Archetype[]>([]),[catalogId,setCatalogId]=useState(""),[categories,setCategories]=useState<Category[]>([]),[products,setProducts]=useState<Product[]>([]),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[catalogName,setCatalogName]=useState("فروشگاه من"),[catalogSlug,setCatalogSlug]=useState("my-store"),[archetype,setArchetype]=useState("GENERAL_COMMERCE"),[categoryName,setCategoryName]=useState("محصولات"),[categorySlug,setCategorySlug]=useState("products"),[productName,setProductName]=useState(""),[productSlug,setProductSlug]=useState(""),[price,setPrice]=useState("0"),[query,setQuery]=useState("");

 const load=async()=>{const[a,c]=await Promise.all([json("/api/commerce/archetypes"),json("/api/commerce/catalogs")]);
setArchetypes(a.archetypes);
setCatalogs(c.catalogs);
setCatalogId(x=>x||c.catalogs[0]?.id||"");
};

 useEffect(()=>{void load().catch(e=>setMessage(e.message));
},[]);

 useEffect(()=>{if(!catalogId){setCategories([]);
setProducts([]);
return;
}void Promise.all([json(`/api/commerce/catalogs/${catalogId}/categories`),json(`/api/commerce/catalogs/${catalogId}/products?q=${encodeURIComponent(query)}&limit=50`)]).then(([c,p])=>{setCategories(c.categories);
setProducts(p.products);
}).catch(e=>setMessage(e.message));
},[catalogId,query]);

 const act=async(fn:()=>Promise<void>)=>{setBusy(true);
setMessage("");
try{await fn();
}catch(e){setMessage(e instanceof Error?e.message:"خطا");
}finally{setBusy(false);
}};

 const createCatalog=()=>act(async()=>{const x=await post("/api/commerce/catalogs",{name:catalogName,slug:catalogSlug,archetype,currency:"IRR"});
await load();
setCatalogId(x.catalog.id);
setMessage("کاتالوگ ایجاد شد.");
});

 const createCategory=()=>act(async()=>{await post(`/api/commerce/catalogs/${catalogId}/categories`,{parentCategoryId:null,name:categoryName,slug:categorySlug,displayOrder:categories.length});
setCategories((await json(`/api/commerce/catalogs/${catalogId}/categories`)).categories);
setMessage("دسته‌بندی ایجاد شد.");
});

 const createProduct=()=>act(async()=>{await post(`/api/commerce/catalogs/${catalogId}/products`,{primaryCategoryId:categories[0]?.id||null,brandId:null,name:productName,slug:productSlug,shortDescription:null,description:null,basePrice:Number(price),compareAtPrice:null,availabilityStatus:"IN_STOCK",primaryAssetId:null,seoTitle:null,seoDescription:null,warrantySummary:null,returnsSummary:null,shippingSummary:null});
setProducts((await json(`/api/commerce/catalogs/${catalogId}/products?limit=50`)).products);
setProductName("");
setMessage("محصول ساختاریافته ایجاد شد.");
});

 const addToCart=(product:Product)=>act(async()=>{let cartToken=localStorage.getItem("loadder-commerce-cart");
let cart;
if(cartToken){const r=await json("/api/public/commerce/cart",{headers:{"X-Cart-Token":cartToken}}).catch(()=>null);
cart=r?.cart;
}if(!cartToken||!cart){const r=await json("/api/public/commerce/cart",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({catalogId,customerScopeKey:null})});
cartToken=String(r.cartToken);
cart=r.cart;
localStorage.setItem("loadder-commerce-cart",cartToken);
}if(!cartToken)throw new Error("CART_NOT_FOUND");
await json("/api/public/commerce/cart/items",{method:"POST",headers:{"content-type":"application/json","X-Cart-Token":cartToken},body:JSON.stringify({revision:cart.revision,productId:product.id,variantId:null,quantity:1})});
setMessage("به سبد خرید اضافه شد.");
});

 const active=catalogs.find(x=>x.id===catalogId),preset=archetypes.find(x=>x.archetype===(active?.archetype||archetype));

 return <main dir="rtl" className="min-h-screen bg-[#050507] p-5 text-white"><div className="mx-auto max-w-7xl space-y-5"><header className="flex flex-wrap items-center gap-3"><Link to="/dashboard" className="rounded-xl border border-white/10 p-3"><ArrowRight/></Link><Storefront size={30}/><div><h1 className="text-2xl font-bold">کاتالوگ تجاری</h1><p className="text-sm text-white/50">هویت محصول، تنوع، مشخصات و رسانه — بدون سبد خرید و پرداخت</p></div></header>
 {!catalogs.length?<section className="rounded-3xl border border-white/10 bg-white/[.03] p-6"><h2 className="mb-4 text-lg font-semibold">ایجاد کاتالوگ</h2><div className="grid gap-3 md:grid-cols-2"><input value={catalogName} onChange={e=>setCatalogName(e.target.value)} className="rounded-xl bg-black/30 p-3" placeholder="نام کاتالوگ"/><input dir="ltr" value={catalogSlug} onChange={e=>setCatalogSlug(e.target.value)} className="rounded-xl bg-black/30 p-3" placeholder="slug"/><select value={archetype} onChange={e=>setArchetype(e.target.value)} className="rounded-xl bg-[#101018] p-3">{archetypes.map(x=><option key={x.archetype} value={x.archetype}>{x.label}</option>)}</select><button disabled={busy} onClick={()=>void createCatalog()} className="rounded-xl bg-violet-600 p-3">ایجاد</button></div></section>:
 <><section className="grid gap-4 rounded-3xl border border-white/10 bg-white/[.03] p-5 lg:grid-cols-[260px_1fr]"><div><label className="text-sm text-white/55">کاتالوگ فعال</label><select value={catalogId} onChange={e=>setCatalogId(e.target.value)} className="mt-2 w-full rounded-xl bg-[#101018] p-3">{catalogs.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><p className="mt-3 text-xs text-white/45">الگو: {preset?.label||active?.archetype}</p></div><div><h2 className="font-semibold">پیشنهاد ساختار</h2><div className="mt-2 flex flex-wrap gap-2">{preset?.recommendedAttributes.map(x=><span key={x.key} className="rounded-full bg-white/5 px-3 py-1 text-xs">{x.label}</span>)}</div></div></section>
 <section className="grid gap-5 lg:grid-cols-2"><form onSubmit={e=>{e.preventDefault();
void createCategory();
}} className="rounded-3xl border border-white/10 bg-white/[.03] p-5"><h2 className="mb-4 font-semibold">دسته‌بندی</h2><input value={categoryName} onChange={e=>setCategoryName(e.target.value)} className="mb-3 w-full rounded-xl bg-black/30 p-3"/><input dir="ltr" value={categorySlug} onChange={e=>setCategorySlug(e.target.value)} className="mb-3 w-full rounded-xl bg-black/30 p-3"/><button disabled={busy} className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3"><Plus/>افزودن دسته</button><div className="mt-4 flex flex-wrap gap-2">{categories.map(x=><span key={x.id} className="rounded-full bg-white/5 px-3 py-1 text-sm">{x.name}</span>)}</div></form>
 <form onSubmit={e=>{e.preventDefault();
void createProduct();
}} className="rounded-3xl border border-white/10 bg-white/[.03] p-5"><h2 className="mb-4 font-semibold">محصول جدید</h2><input required value={productName} onChange={e=>setProductName(e.target.value)} className="mb-3 w-full rounded-xl bg-black/30 p-3" placeholder="نام فارسی محصول"/><input required dir="ltr" value={productSlug} onChange={e=>setProductSlug(e.target.value)} className="mb-3 w-full rounded-xl bg-black/30 p-3" placeholder="product-slug"/><input type="number" min="0" value={price} onChange={e=>setPrice(e.target.value)} className="mb-3 w-full rounded-xl bg-black/30 p-3" placeholder="قیمت (ریال)"/><button disabled={busy} className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3"><Plus/>افزودن محصول</button></form></section>
 <section className="rounded-3xl border border-white/10 bg-white/[.03] p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">پیش‌نمایش فروشگاه</h2><div className="flex gap-2"><input value={query} onChange={e=>setQuery(e.target.value)} className="rounded-xl bg-black/30 p-3" placeholder="جست‌وجوی محصول"/><Link to="/store/cart" className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4"><ShoppingCart/>سبد خرید</Link></div></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{products.map(p=><article key={p.id} className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="mb-4 aspect-[4/3] rounded-xl bg-gradient-to-br from-violet-500/15 to-cyan-500/10"/><h3 className="font-semibold">{p.name}</h3><p className="mt-2 text-sm text-white/55">{p.basePrice.toLocaleString("fa-IR")} {p.currency}</p><p className="mt-2 text-xs text-emerald-300">{p.availabilityStatus}</p><button disabled={busy||p.status!=="ACTIVE"||!["IN_STOCK","PREORDER"].includes(p.availabilityStatus)} onClick={()=>void addToCart(p)} className="mt-4 min-h-11 w-full rounded-xl bg-violet-600 disabled:bg-white/10">افزودن به سبد خرید</button></article>)}</div></section></>}{message&&<p className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-200">{message}</p>}<p className="text-xs text-white/40">قیمت و موجودی هنگام افزودن و ثبت سفارش دوباره در سرور اعتبارسنجی می‌شوند. پرداخت آنلاین و رزرو موجودی هنوز فعال نیست.</p></div></main>;

}
