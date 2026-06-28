import { useState, useMemo, useEffect, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ── DESIGN TOKENS ──────────────────────────────────────────────────────────
const C = {
  bg:"#09090B", sf:"#0F0F12", card:"#141417", el:"#1C1C21", brd:"#28282E",
  gold:"#C9A84C", goldBg:"rgba(201,168,76,0.07)",
  text:"#DEDEE2", sub:"#9A9AA8", dim:"#52525C",
  ok:"#4ADE80", warn:"#F59E0B", err:"#F87171",
};

// ── FORMATTERS ─────────────────────────────────────────────────────────────
const sol = (n, d = 2) =>
  `S/ ${new Intl.NumberFormat("es-PE",{minimumFractionDigits:d,maximumFractionDigits:d}).format(n||0)}`;
const num = (n, d = 0) =>
  new Intl.NumberFormat("es-PE",{minimumFractionDigits:d,maximumFractionDigits:d}).format(n||0);

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const todayLabel = (d=new Date()) => `${d.getDate()} ${MESES[d.getMonth()]}`;
const todayFull  = (d=new Date()) => `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
const addDaysLabel = (days, d=new Date()) => {
  const nd = new Date(d); nd.setDate(nd.getDate()+(parseInt(days,10)||0));
  return todayFull(nd);
};

// ── SHARED STYLE HELPERS ────────────────────────────────────────────────────
const btnGhost = {padding:"7px 14px",background:"transparent",border:`1px solid ${C.brd}`,
  borderRadius:3,color:C.dim,fontSize:10,letterSpacing:"0.05em",cursor:"pointer",fontFamily:"inherit"};
const btnGold = {padding:"7px 14px",background:C.goldBg,border:`1px solid ${C.gold}55`,
  borderRadius:3,color:C.gold,fontSize:10,letterSpacing:"0.05em",fontWeight:600,cursor:"pointer",fontFamily:"inherit"};
const kpiLabelStyle = {fontSize:8,letterSpacing:"0.22em",color:C.dim,marginBottom:10,fontWeight:600};
const kpiInputStyle = {fontSize:24,fontWeight:200,letterSpacing:"-0.02em",background:"transparent",
  border:"none",color:C.text,width:"100%",outline:"none",fontFamily:"inherit",padding:0};

// ── DEFAULT / SEED DATA ─────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  tc: 3.72,
  splitDefault: 65,
  partnerA: "Estéfano",
  partnerB: "Miguel",
  businessName: "Eleganzza",
  contactPhone: "+51 999 999 999",
  contactInstagram: "@eleganzza.pe",
  paymentMethods: "Yape / Plin / Transferencia BCP — cuenta a nombre de Eleganzza.",
  deliveryInfo: "Entrega en Trujillo: 24–48h. Envío a provincia vía Shalom / Olva Courier (costo a cargo del cliente).",
  quoteValidityDays: 3,
  quoteTerms: "Precios sujetos a disponibilidad de stock al momento de confirmar el pedido. Los decants se entregan en frascos sellados con spray o roll-on, según disponibilidad.",
  minMarginPct: 30,
  monthlyRevenue: 48320,
  monthlyMargin: 12840,
  nextSettlementDate: "30 Jun 2026",
  yearAccumulated: 68400,
};

const DEFAULT_INVENTORY = [
  {id:1,name:"Creed Aventus",ml:100,stock:3,decantMl:850,decantSold:150,cost:420,splitE:65,ownership:"negocio",ownerName:""},
  {id:2,name:"Tom Ford Black Orchid",ml:50,stock:1,decantMl:200,decantSold:0,cost:380,splitE:60,ownership:"negocio",ownerName:""},
  {id:3,name:"Maison Margiela Replica",ml:100,stock:5,decantMl:0,decantSold:0,cost:290,splitE:65,ownership:"negocio",ownerName:""},
  {id:4,name:"Initio Oud for Greatness",ml:90,stock:2,decantMl:450,decantSold:0,cost:520,splitE:70,ownership:"negocio",ownerName:""},
  {id:5,name:"Byredo Bal d'Afrique",ml:50,stock:0,decantMl:120,decantSold:30,cost:310,splitE:65,ownership:"socio",ownerName:"Miguel"},
];

const DEFAULT_SALES = [];

const EMPTY_IMPORT_DRAFT = {
  name:"",priceUSD:0,units:1,
  discount:0,tax:8,tc:3.72,ship:0,customs:0,
  repack:0,local:0,travel:0,splitE:65,
};

const DEFAULT_IMPORT = [
  {
    id:1,
    createdAt:"1 Ene 2025",
    name:"Creed Aventus 100ml",priceUSD:120,units:5,
    discount:0,tax:8,tc:3.72,ship:150,customs:80,
    repack:20,local:15,travel:0,splitE:65,
  },
];

const TREND = [
  {m:"Ene",v:8200},{m:"Feb",v:11400},{m:"Mar",v:9800},
  {m:"Abr",v:14200},{m:"May",v:12100},{m:"Jun",v:15600},
];
const HIST = [
  {mes:"Abr",es:1820,mi:980},
  {mes:"May",es:2340,mi:1260},
  {mes:"Jun",es:2860,mi:1540},
];

const NAV = [
  {id:"dash",icon:"◈",label:"Dashboard"},
  {id:"import",icon:"⊕",label:"Importación"},
  {id:"inventory",icon:"◫",label:"Inventario"},
  {id:"quotes",icon:"✎",label:"Cotizaciones"},
  {id:"payments",icon:"⇄",label:"Pagos a Socio"},
  {id:"profits",icon:"◎",label:"Ganancias"},
  {id:"settings",icon:"⚙",label:"Configuración"},
];

const FORMATS = ["Decant 5ml","Decant 10ml","Frasco 50ml","Botella sellada","Kit / Promoción","Personalizado"];

// ── PERSISTENT SHARED STORAGE ───────────────────────────────────────────────
const STORE_KEY = "eleganzza-store-v1";

function buildDefaults(){
  return {
    settings: {...DEFAULT_SETTINGS},
    inventory: DEFAULT_INVENTORY.map(i=>({...i})),
    sales: DEFAULT_SALES.map(s=>({...s})),
    quotes: [],
    settlements: [],
    imp: DEFAULT_IMPORT.map(i=>({...i})),
  };
}

async function loadStore(){
  const defaults = buildDefaults()
  try{
    const { data } = await supabase
      .from('store').select('data')
      .eq('key', STORE_KEY).single()
    if(data){
      const parsed = JSON.parse(data.data);
      // ── MIGRATION: imp was a single object, now it's an array ──
      if(parsed.imp && !Array.isArray(parsed.imp)){
        parsed.imp = [{ ...parsed.imp, id: Date.now(), createdAt: todayFull() }];
      }
      return { ...defaults, ...parsed };
    }
  }catch(e){}
  await saveStore(defaults)
  return defaults
}

async function saveStore(state){
  const { error } = await supabase.from('store').upsert({
    key: STORE_KEY,
    data: JSON.stringify(state),
    updated_at: new Date().toISOString()
  })
  return !error
}

// ── MICRO COMPONENTS ────────────────────────────────────────────────────────
function ChartTip({active,payload,label}){
  if(!active||!payload?.length) return null;
  return(
    <div style={{background:C.el,border:`1px solid ${C.brd}`,borderRadius:3,padding:"7px 12px"}}>
      <div style={{fontSize:9,color:C.dim,marginBottom:3}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{fontSize:11,color:p.color||C.text}}>
          {p.name?`${p.name}: `:""}{sol(p.value,0)}
        </div>
      ))}
    </div>
  );
}

function Field({label,prefix,value,onChange,type="number",step="0.01",readOnly}){
  const isNum = type==="number";
  const [draft,setDraft] = useState(isNum ? String(value ?? "") : value);

  useEffect(()=>{ if(isNum) setDraft(String(value ?? "")); }, [value, isNum]);

  const handleChange = (e) => {
    if(!isNum){ onChange(e); return; }
    const raw = e.target.value;
    setDraft(raw);
    // allow the box to sit empty/mid-typing without forcing it back to a number
    if(raw===""||raw==="-"||raw==="."||raw==="-.") return;
    if(!isNaN(parseFloat(raw))) onChange(e);
  };
  const handleBlur = () => {
    if(!isNum) return;
    if(draft===""||isNaN(parseFloat(draft))) setDraft(String(value ?? 0));
  };

  return(
    <div>
      <div style={{fontSize:8,letterSpacing:"0.18em",color:C.dim,marginBottom:4,fontWeight:600}}>{label}</div>
      <div style={{display:"flex",background:C.el,border:`1px solid ${C.brd}`,borderRadius:3,overflow:"hidden"}}>
        {prefix&&(
          <div style={{padding:"0 9px",display:"flex",alignItems:"center",fontSize:10.5,
            color:C.dim,borderRight:`1px solid ${C.brd}`,whiteSpace:"nowrap"}}>{prefix}</div>
        )}
        <input type={type} step={step} value={isNum?draft:value} onChange={handleChange} onBlur={handleBlur} readOnly={readOnly}
          onFocus={e=>{ if(parseFloat(e.target.value)===0) e.target.select(); }}
          style={{flex:1,minWidth:0,padding:"8px 10px",background:"transparent",border:"none",
            color:readOnly?C.dim:C.text,fontSize:12.5,outline:"none",fontFamily:"inherit"}}/>
      </div>
    </div>
  );
}

function NumberInput({value,onChange,style,min,max}){
  const [draft,setDraft] = useState(String(value ?? ""));
  useEffect(()=>{ setDraft(String(value ?? "")); }, [value]);

  const handleChange = (e) => {
    const raw = e.target.value;
    setDraft(raw);
    if(raw===""||raw==="-"||raw==="."||raw==="-.") return;
    const n = parseFloat(raw);
    if(!isNaN(n)) onChange(n);
  };
  const handleBlur = () => {
    if(draft===""||isNaN(parseFloat(draft))) setDraft(String(value ?? 0));
  };

  return <input type="number" min={min} max={max} value={draft} onChange={handleChange} onBlur={handleBlur}
    onFocus={e=>{ if(parseFloat(e.target.value)===0) e.target.select(); }}
    style={style}/>;
}

function Select({label,value,onChange,options}){
  return(
    <div>
      {label&&<div style={{fontSize:8,letterSpacing:"0.18em",color:C.dim,marginBottom:4,fontWeight:600}}>{label}</div>}
      <select value={value} onChange={onChange} style={{width:"100%",padding:"8px 10px",
        background:C.el,border:`1px solid ${C.brd}`,borderRadius:3,color:C.text,fontSize:12.5,
        outline:"none",fontFamily:"inherit"}}>
        {options.map(o=> typeof o === "string"
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>
        )}
      </select>
    </div>
  );
}

function TextArea({label,value,onChange,rows=3}){
  return(
    <div>
      <div style={{fontSize:8,letterSpacing:"0.18em",color:C.dim,marginBottom:4,fontWeight:600}}>{label}</div>
      <textarea value={value} onChange={onChange} rows={rows}
        style={{width:"100%",padding:"9px 10px",background:C.el,border:`1px solid ${C.brd}`,
          borderRadius:3,color:C.text,fontSize:12,outline:"none",fontFamily:"inherit",resize:"vertical"}}/>
    </div>
  );
}

function Badge({status}){
  const m = {paid:[C.ok,"PAGADO"],pending:[C.warn,"PENDIENTE"],reserved:[C.gold,"SEPARADO"]};
  const [color,label] = m[status]||[C.dim,status];
  return(
    <span style={{fontSize:8,letterSpacing:"0.1em",fontWeight:700,color,
      background:`${color}18`,padding:"3px 7px",borderRadius:2,whiteSpace:"nowrap"}}>
      {label}
    </span>
  );
}

function PayToggle({checked,onClick}){
  return(
    <button onClick={onClick} style={{
      display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"5px 9px",
      background:checked?`${C.ok}18`:C.el, border:`1px solid ${checked?C.ok:C.brd}`,
      borderRadius:3,fontSize:8.5,letterSpacing:"0.04em",fontWeight:700,
      color:checked?C.ok:C.dim, cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
      {checked?"✓ PAGADO":"○ PENDIENTE"}
    </button>
  );
}

function LoadingScreen(){
  return(
    <div style={{height:"100vh",display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"center",background:C.bg,color:C.dim,gap:10}}>
      <div style={{fontSize:11,letterSpacing:"0.42em",fontWeight:700,color:C.gold}}>ELEGANZZA</div>
      <div style={{fontSize:10,letterSpacing:"0.2em"}}>Sincronizando datos compartidos…</div>
    </div>
  );
}

// ── QUICK SALE FORM (Dashboard) ─────────────────────────────────────────────
function QuickSaleForm({inventory,settings,initial,submitLabel,onSubmit,onCancel}){
  const todayISO = () => new Date().toISOString().slice(0,10);
  const isoToLabel = (iso) => {
    if(!iso) return todayLabel();
    const [y,m,d] = iso.split("-");
    return `${parseInt(d)} ${MESES[parseInt(m)-1]} ${y}`;
  };
  const [f,setF] = useState(()=>{
    if(!initial) return {client:"",itemId:"",custom:"",amount:"",cost:"",kind:"sellada",status:"pending",dateISO:todayISO()};
    // parse existing date label back to ISO best-effort, fall back to today
    let dateISO = todayISO();
    if(initial.dateISO) dateISO = initial.dateISO;
    return {
      client: initial.client||"",
      itemId: initial.itemId!=null ? String(initial.itemId) : "",
      custom: initial.itemId!=null ? "" : (initial.product||""),
      amount: String(initial.amount??""),
      cost: String(initial.cost??""),
      kind: initial.kind==="otro" ? "otro" : "sellada",
      status: initial.status||"pending",
      dateISO,
    };
  });
  const item = inventory.find(i=>String(i.id)===String(f.itemId));

  const pickItem = (id) => {
    const inv = inventory.find(i=>String(i.id)===String(id));
    setF(prev=>({...prev, itemId:id, cost: inv ? String(inv.cost) : prev.cost}));
  };

  const submit = () => {
    if(!f.client.trim() || !(parseFloat(f.amount)>0)) return;
    const amount = parseFloat(f.amount)||0;
    const cost = parseFloat(f.cost)||0;
    const product = item ? `${item.name} (${f.kind==="sellada"?"Sellado":"Otro"})` : (f.custom.trim() || "Producto personalizado");
    onSubmit({
      client:f.client.trim(), product, amount, status:f.status, kind:f.kind,
      itemId: item?item.id:null, cost,
      splitE: item?item.splitE:settings.splitDefault,
      dateISO: f.dateISO,
      date: isoToLabel(f.dateISO),
    });
  };

  return(
    <div style={{background:C.el,borderRadius:3,padding:"12px 14px",marginBottom:10,
      display:"flex",flexDirection:"column",gap:8}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <Field label="CLIENTE" type="text" value={f.client} onChange={e=>setF({...f,client:e.target.value})}/>
        <Select label="TIPO DE VENTA" value={f.kind} onChange={e=>setF({...f,kind:e.target.value})}
          options={[{value:"sellada",label:"Botella sellada"},{value:"otro",label:"Otro / promoción"}]}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <Select label="PERFUME (OPCIONAL)" value={f.itemId}
          onChange={e=>pickItem(e.target.value)}
          options={[{value:"",label:"— Producto personalizado —"},...inventory.map(i=>({value:String(i.id),label:i.name}))]}/>
        <Select label="ESTADO" value={f.status} onChange={e=>setF({...f,status:e.target.value})}
          options={[{value:"pending",label:"Pendiente"},{value:"paid",label:"Pagado"},{value:"reserved",label:"Separado"}]}/>
      </div>
      {!f.itemId && (
        <Field label="DESCRIPCIÓN DEL PRODUCTO" type="text" value={f.custom} onChange={e=>setF({...f,custom:e.target.value})}/>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        <Field label="MONTO (VENTA)" prefix="S/" value={f.amount} onChange={e=>setF({...f,amount:e.target.value})}/>
        <Field label="COSTO" prefix="S/" value={f.cost} onChange={e=>setF({...f,cost:e.target.value})}/>
        <div>
          <div style={{fontSize:8,letterSpacing:"0.18em",color:C.dim,marginBottom:4,fontWeight:600}}>FECHA DE VENTA</div>
          <div style={{display:"flex",background:C.el,border:`1px solid ${C.brd}`,borderRadius:3,overflow:"hidden",alignItems:"center"}}>
            <input type="date" value={f.dateISO} onChange={e=>setF({...f,dateISO:e.target.value})}
              style={{flex:1,minWidth:0,padding:"8px 10px",background:"transparent",border:"none",
                color:C.text,fontSize:12,outline:"none",fontFamily:"inherit",
                colorScheme:"dark"}}/>
          </div>
          {f.dateISO !== todayISO() && (
            <div style={{fontSize:8,color:C.warn,marginTop:3,letterSpacing:"0.04em"}}>
              ⚠ Venta pasada · {isoToLabel(f.dateISO)}
            </div>
          )}
        </div>
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <button onClick={onCancel} style={btnGhost}>Cancelar</button>
        <button onClick={submit} style={btnGold}>{submitLabel||"Registrar venta"}</button>
      </div>
    </div>
  );
}

// ── DASHBOARD ───────────────────────────────────────────────────────────────
function DashView({sim,setSim,inventory,sales,setSales,settings,setSettings}){
  const [formMode,setFormMode] = useState(null); // null | {type:"add"} | {type:"edit", sale}
  const up = (f,v) => setSim(p=>({...p,[f]:v}));
  const mg = useMemo(()=>{
    const g = sim.sale - sim.cost;
    const pct = sim.sale>0 ? (g/sim.sale)*100 : 0;
    return {gross:g, pct, shareE:g*(sim.splitE/100), shareM:g*((100-sim.splitE)/100)};
  },[sim]);
  const critical = inventory.filter(i=>i.stock<=1);
  const valorInventario = inventory.reduce((a,i)=>a+i.cost*i.stock,0);
  const refsActivas = inventory.filter(i=>i.stock>0||i.decantMl>0).length;
  const pendientes = sales.filter(s=>s.status!=="paid");
  const cuentasXCobrar = pendientes.reduce((a,s)=>a+s.amount,0);

  const currentMonthAbbr = MESES[new Date().getMonth()];
  const isThisMonth = (dateStr) => (dateStr||"").trim().split(" ")[1]===currentMonthAbbr;
  const paidThisMonth = useMemo(()=> sales.filter(s=>s.status==="paid" && isThisMonth(s.date)), [sales, currentMonthAbbr]);
  const ingresosNetos = paidThisMonth.reduce((a,s)=>a+s.amount,0);
  const margenMensual = paidThisMonth.reduce((a,s)=>a+(s.amount-(s.cost||0)),0);

  const handleSubmitForm = (payload) => {
    if(formMode?.type==="edit"){
      setSales(prev=>prev.map(s=>s.id===formMode.sale.id ? {...s, ...payload} : s));
    } else {
      setSales(prev=>[{
        id:Date.now(), ml:null,
        paidToSocio:false, paidDate:null, settlementId:null,
        date: payload.date || todayLabel(),
        dateISO: payload.dateISO || new Date().toISOString().slice(0,10),
        ...payload,
      }, ...prev]);
    }
    setFormMode(null);
  };

  return(
    <div style={{height:"100vh",overflowY:"auto",padding:28}}>
      <div style={{marginBottom:22}}>
        <div style={{fontSize:9,letterSpacing:"0.35em",color:C.gold,fontWeight:600}}>PANEL EN VIVO</div>
        <div style={{fontSize:22,fontWeight:300,marginTop:4}}>Panel de Control</div>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
        <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"16px 18px"}}>
          <div style={kpiLabelStyle}>INGRESOS NETOS</div>
          <div style={{fontSize:24,fontWeight:200}}>{sol(ingresosNetos,0)}</div>
          <div style={{marginTop:6,fontSize:9.5,color:C.dim}}>ventas pagadas · {currentMonthAbbr}</div>
        </div>
        <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"16px 18px"}}>
          <div style={kpiLabelStyle}>MARGEN MENSUAL</div>
          <div style={{fontSize:24,fontWeight:200,color:margenMensual>=0?C.text:C.err}}>{sol(margenMensual,0)}</div>
          <div style={{marginTop:6,fontSize:9.5,color:C.dim}}>margen de ventas pagadas · {currentMonthAbbr}</div>
        </div>
        <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"16px 18px"}}>
          <div style={kpiLabelStyle}>CUENTAS × COBRAR</div>
          <div style={{fontSize:24,fontWeight:200}}>{sol(cuentasXCobrar,0)}</div>
          <div style={{marginTop:6,fontSize:9.5,color:C.dim}}>{pendientes.length} ventas pendientes/separadas</div>
        </div>
        <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"16px 18px"}}>
          <div style={kpiLabelStyle}>VALOR INVENTARIO</div>
          <div style={{fontSize:24,fontWeight:200}}>{sol(valorInventario,0)}</div>
          <div style={{marginTop:6,fontSize:9.5,color:C.dim}}>{refsActivas} referencias activas</div>
        </div>
      </div>

      {/* Chart + Simulator */}
      <div style={{display:"grid",gridTemplateColumns:"1.7fr 1fr",gap:12,marginBottom:12}}>
        <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"18px 20px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
            <div>
              <div style={{fontSize:8,letterSpacing:"0.24em",color:C.dim,fontWeight:600}}>TENDENCIA · VENTAS NETAS</div>
              <div style={{fontSize:24,fontWeight:200,marginTop:4}}>{sol(sales.reduce((a,s)=>a+s.amount,0),0)}</div>
            </div>
            <span style={{fontSize:10,color:C.dim}}>{sales.length} venta(s) registrada(s)</span>
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={TREND} margin={{top:4,right:4,bottom:0,left:0}}>
              <defs>
                <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.gold} stopOpacity={0.2}/>
                  <stop offset="100%" stopColor={C.gold} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="m" tick={{fontSize:9,fill:C.dim}} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip content={<ChartTip/>}/>
              <Area type="monotone" dataKey="v" stroke={C.gold} strokeWidth={1.5}
                fill="url(#ag)" dot={false} activeDot={{r:3,fill:C.gold}}/>
            </AreaChart>
          </ResponsiveContainer>
          <div style={{fontSize:8.5,color:C.dim,marginTop:8}}>Vista ilustrativa — conéctala a tus cierres reales cuando los registres.</div>
        </div>

        <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"18px 20px"}}>
          <div style={{fontSize:8,letterSpacing:"0.24em",color:C.dim,marginBottom:14,fontWeight:600}}>
            SIMULADOR DE MARGEN RÁPIDO
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:9,marginBottom:12}}>
            <Field label="PRECIO DE VENTA" prefix="S/" value={sim.sale}
              onChange={e=>up("sale",parseFloat(e.target.value)||0)}/>
            <Field label="COSTO UNITARIO" prefix="S/" value={sim.cost}
              onChange={e=>up("cost",parseFloat(e.target.value)||0)}/>
            <div>
              <div style={{fontSize:8,letterSpacing:"0.18em",color:C.dim,marginBottom:4,fontWeight:600}}>
                SPLIT {settings.partnerA.toUpperCase()}% / {settings.partnerB.toUpperCase()}%
              </div>
              <div style={{display:"flex",gap:6}}>
                <NumberInput min="0" max="100" value={sim.splitE}
                  onChange={n=>up("splitE",Math.min(100,Math.max(0,n)))}
                  style={{flex:1,minWidth:0,padding:"8px 10px",background:C.el,
                    border:`1px solid ${C.brd}`,borderRadius:3,color:C.gold,
                    fontSize:12.5,outline:"none",fontFamily:"inherit"}}/>
                <input readOnly value={100-sim.splitE}
                  style={{flex:1,minWidth:0,padding:"8px 10px",background:C.el,
                    border:`1px solid ${C.brd}`,borderRadius:3,color:C.sub,
                    fontSize:12.5,outline:"none",fontFamily:"inherit"}}/>
              </div>
            </div>
          </div>
          <div style={{background:C.el,borderRadius:3,padding:"13px 14px"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <div>
                <div style={{fontSize:8,letterSpacing:"0.14em",color:C.dim}}>MARGEN BRUTO</div>
                <div style={{fontSize:22,fontWeight:200,color:mg.gross>=0?C.ok:C.err,marginTop:3}}>
                  {sol(mg.gross,2)}
                </div>
                <div style={{fontSize:9.5,color:C.dim}}>{num(mg.pct,1)}%</div>
              </div>
              <div>
                <div style={{fontSize:8,letterSpacing:"0.14em",color:C.dim}}>POR SOCIO</div>
                <div style={{fontSize:13,color:C.gold,marginTop:3}}>{sol(mg.shareE,2)}</div>
                <div style={{fontSize:13,color:C.sub,marginTop:3}}>{sol(mg.shareM,2)}</div>
              </div>
            </div>
            <div style={{height:2,background:C.brd,borderRadius:2}}>
              <div style={{height:"100%",borderRadius:2,transition:"width 0.3s",
                background:mg.gross>=0?C.gold:C.err,
                width:`${Math.min(100,Math.max(0,mg.pct))}%`}}/>
            </div>
          </div>
        </div>
      </div>

      {/* Critical stock + Recent sales */}
      <div style={{display:"grid",gridTemplateColumns:"220px 1fr",gap:12}}>
        <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"16px 18px"}}>
          <div style={{fontSize:8,letterSpacing:"0.22em",color:C.dim,marginBottom:12,fontWeight:600}}>
            STOCK CRÍTICO
          </div>
          {critical.length===0
            ? <div style={{fontSize:10,color:C.dim,padding:"8px 0"}}>Sin alertas activas</div>
            : critical.map(i=>(
              <div key={i.id} style={{display:"flex",justifyContent:"space-between",
                alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${C.brd}`}}>
                <div>
                  <div style={{fontSize:10.5,color:C.text}}>{i.name}</div>
                  <div style={{fontSize:8.5,color:C.dim,marginTop:1}}>{num(i.decantMl)} ml en decants</div>
                </div>
                <div style={{fontSize:20,fontWeight:200,color:i.stock===0?C.err:C.warn}}>
                  {i.stock}<span style={{fontSize:9,color:C.dim,fontWeight:400}}>u</span>
                </div>
              </div>
            ))}
        </div>
        <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"16px 18px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:8,letterSpacing:"0.22em",color:C.dim,fontWeight:600}}>VENTAS RECIENTES</div>
            <button onClick={()=>setFormMode(m=>m?.type==="add"?null:{type:"add"})} style={{...btnGhost,padding:"4px 10px"}}>
              {formMode?.type==="add"?"✕ Cerrar":"+ Nueva venta"}
            </button>
          </div>
          {formMode && (
            <QuickSaleForm inventory={inventory} settings={settings}
              initial={formMode.type==="edit" ? formMode.sale : null}
              submitLabel={formMode.type==="edit" ? "Guardar cambios" : "Registrar venta"}
              onSubmit={handleSubmitForm} onCancel={()=>setFormMode(null)}/>
          )}
          {sales.length===0 && (
            <div style={{fontSize:10,color:C.dim,padding:"10px 0"}}>No hay ventas registradas aún.</div>
          )}
          {sales.map(s=>(
            <div key={s.id} style={{display:"grid",gridTemplateColumns:"52px 1fr 80px 90px 48px",
              gap:8,padding:"8px 0",borderBottom:`1px solid ${C.brd}`,alignItems:"center"}}>
              <div style={{fontSize:9,color:C.dim}}>{s.date}</div>
              <div>
                <div style={{fontSize:10.5,color:C.text}}>{s.client}</div>
                <div style={{fontSize:8.5,color:C.dim,marginTop:1}}>{s.product}</div>
              </div>
              <div style={{fontSize:12.5,fontWeight:200}}>{sol(s.amount,0)}</div>
              <Badge status={s.status}/>
              <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                {s.kind!=="decant" && (
                  <button onClick={()=>setFormMode({type:"edit", sale:s})}
                    title="Editar venta"
                    style={{background:"transparent",border:"none",color:C.dim,cursor:"pointer",
                      fontSize:12,padding:0,lineHeight:1,fontFamily:"inherit",
                      transition:"color 0.15s"}}
                    onMouseEnter={e=>e.target.style.color=C.gold}
                    onMouseLeave={e=>e.target.style.color=C.dim}>✎</button>
                )}
                <button onClick={()=>setSales(prev=>prev.filter(x=>x.id!==s.id))}
                  title="Eliminar venta"
                  style={{background:"transparent",border:"none",color:C.dim,cursor:"pointer",
                    fontSize:14,padding:0,lineHeight:1,fontFamily:"inherit",
                    transition:"color 0.15s"}}
                  onMouseEnter={e=>e.target.style.color=C.err}
                  onMouseLeave={e=>e.target.style.color=C.dim}>×</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── IMPORT VIEW ─────────────────────────────────────────────────────────────
function ImportView({imp,setImp,settings}){
  // imp is now an array of batches; selectedId tracks which is active
  const batches = Array.isArray(imp) ? imp : [imp];
  const [selectedId,setSelectedId] = useState(()=> batches.length>0 ? batches[0].id : null);
  const [creating,setCreating] = useState(false);
  const [draft,setDraft] = useState({...EMPTY_IMPORT_DRAFT});

  const selected = batches.find(b=>b.id===selectedId) || batches[0] || null;

  const upd = (f,v) => {
    setImp(prev=>{
      const arr = Array.isArray(prev) ? prev : [prev];
      return arr.map(b=>b.id===selectedId ? {...b,[f]:f==="name"?v:(parseFloat(v)||0)} : b);
    });
  };

  const syncFromSettings = () => {
    setImp(prev=>{
      const arr = Array.isArray(prev) ? prev : [prev];
      return arr.map(b=>b.id===selectedId ? {...b,tc:settings.tc,splitE:settings.splitDefault} : b);
    });
  };

  const saveDraft = () => {
    if(!draft.name.trim()) return;
    const newBatch = {
      ...draft,
      id: Date.now(),
      createdAt: todayFull(),
    };
    setImp(prev=>{
      const arr = Array.isArray(prev) ? prev : [prev];
      return [newBatch, ...arr];
    });
    setSelectedId(newBatch.id);
    setCreating(false);
    setDraft({...EMPTY_IMPORT_DRAFT});
  };

  const removeBatch = (id) => {
    setImp(prev=>{
      const arr = Array.isArray(prev) ? prev : [prev];
      const next = arr.filter(b=>b.id!==id);
      return next;
    });
    if(selectedId===id){
      const remaining = batches.filter(b=>b.id!==id);
      setSelectedId(remaining.length>0 ? remaining[0].id : null);
    }
  };

  const R = selected ? (() => {
    const bUSD = selected.priceUSD * selected.units * (1 - selected.discount/100);
    const bPEN = bUSD * selected.tc;
    const tax  = bPEN * (selected.tax/100);
    const prod = bPEN + tax;
    const log  = selected.ship + selected.customs + selected.repack + selected.local + selected.travel;
    const total = prod + log;
    const unit  = selected.units>0 ? total/selected.units : 0;
    const logU  = selected.units>0 ? log/selected.units : 0;
    return {bUSD,bPEN,tax,prod,log,total,unit,logU};
  })() : null;

  const RRow = ({label,value,accent,large,isLight}) => (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
      padding:"7px 0",borderBottom:`1px solid ${C.brd}`}}>
      <div style={{fontSize:9.5,color:isLight?C.dim:C.sub}}>{label}</div>
      <div style={{fontSize:large?20:12.5,fontWeight:large?200:400,color:accent?C.gold:C.text}}>
        {sol(value,2)}
      </div>
    </div>
  );
  const Sub = ({label,value}) => (
    <div style={{padding:"9px 12px",background:C.el,borderRadius:3,
      display:"flex",justifyContent:"space-between",marginTop:4}}>
      <span style={{fontSize:9.5,color:C.dim}}>{label}</span>
      <span style={{fontSize:12.5,color:C.sub}}>{sol(value,2)}</span>
    </div>
  );

  return(
    <div style={{height:"100vh",overflowY:"auto",padding:28}}>
      <div style={{marginBottom:24}}>
        <div style={{fontSize:9,letterSpacing:"0.35em",color:C.gold,fontWeight:600}}>MÓDULO 01</div>
        <div style={{fontSize:22,fontWeight:300,marginTop:4}}>Motor de Costeo · Importación</div>
        <div style={{fontSize:10.5,color:C.dim,marginTop:5}}>
          Los gastos logísticos se prorratean automáticamente por unidad importada. Cada lote guarda el TC y prorrateo exacto del momento.
        </div>
      </div>

      {/* ── BATCH HISTORY PANEL ── */}
      <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"16px 20px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:8,letterSpacing:"0.22em",color:C.dim,fontWeight:600}}>
            LOTES DE IMPORTACIÓN · {batches.length} registrado{batches.length!==1?"s":""}
          </div>
          <button onClick={()=>{setCreating(c=>!c); setDraft({...EMPTY_IMPORT_DRAFT,tc:settings.tc,splitE:settings.splitDefault});}}
            style={creating ? btnGhost : btnGold}>
            {creating ? "✕ Cancelar" : "+ Nuevo lote"}
          </button>
        </div>

        {creating && (
          <div style={{background:C.el,borderRadius:3,padding:"14px 16px",marginBottom:14,
            border:`1px solid ${C.gold}33`}}>
            <div style={{fontSize:8,letterSpacing:"0.2em",color:C.gold,marginBottom:10,fontWeight:600}}>NUEVO LOTE</div>
            <div style={{display:"flex",flexDirection:"column",gap:9}}>
              <Field label="NOMBRE DEL PRODUCTO" type="text" value={draft.name}
                onChange={e=>setDraft(p=>({...p,name:e.target.value}))}/>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:9}}>
                <Field label="PRECIO USD" prefix="USD" value={draft.priceUSD}
                  onChange={e=>setDraft(p=>({...p,priceUSD:parseFloat(e.target.value)||0}))}/>
                <Field label="UNIDADES" step="1" value={draft.units}
                  onChange={e=>setDraft(p=>({...p,units:parseFloat(e.target.value)||0}))}/>
                <Field label="TIPO DE CAMBIO" prefix="S/" value={draft.tc}
                  onChange={e=>setDraft(p=>({...p,tc:parseFloat(e.target.value)||0}))}/>
                <Field label={`SPLIT ${settings.partnerA.toUpperCase()}%`} prefix="%" value={draft.splitE}
                  onChange={e=>setDraft(p=>({...p,splitE:parseFloat(e.target.value)||0}))}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:9}}>
                <Field label="DESCUENTO %" prefix="%" value={draft.discount}
                  onChange={e=>setDraft(p=>({...p,discount:parseFloat(e.target.value)||0}))}/>
                <Field label="ARANCELES %" prefix="%" value={draft.tax}
                  onChange={e=>setDraft(p=>({...p,tax:parseFloat(e.target.value)||0}))}/>
                <Field label="ENVÍO USA→PE" value={draft.ship}
                  onChange={e=>setDraft(p=>({...p,ship:parseFloat(e.target.value)||0}))}/>
                <Field label="DESADUANAJE" value={draft.customs}
                  onChange={e=>setDraft(p=>({...p,customs:parseFloat(e.target.value)||0}))}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9}}>
                <Field label="REEMPAQUE" value={draft.repack}
                  onChange={e=>setDraft(p=>({...p,repack:parseFloat(e.target.value)||0}))}/>
                <Field label="SHALOM/COMBI" value={draft.local}
                  onChange={e=>setDraft(p=>({...p,local:parseFloat(e.target.value)||0}))}/>
                <Field label="PASAJES" value={draft.travel}
                  onChange={e=>setDraft(p=>({...p,travel:parseFloat(e.target.value)||0}))}/>
              </div>
              <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
                <button onClick={()=>{setCreating(false);setDraft({...EMPTY_IMPORT_DRAFT});}} style={btnGhost}>Cancelar</button>
                <button onClick={saveDraft} disabled={!draft.name.trim()}
                  style={{...btnGold,opacity:draft.name.trim()?1:0.4}}>
                  ✓ Guardar lote
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Batch list */}
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {batches.length===0 && (
            <div style={{fontSize:10,color:C.dim,padding:"8px 0"}}>No hay lotes registrados. Crea el primero.</div>
          )}
          {batches.map(b=>{
            const bR = (()=>{
              const bUSD2 = b.priceUSD * b.units * (1 - b.discount/100);
              const bPEN2 = bUSD2 * b.tc;
              const tax2  = bPEN2 * (b.tax/100);
              const prod2 = bPEN2 + tax2;
              const log2  = b.ship + b.customs + b.repack + b.local + b.travel;
              const total2 = prod2 + log2;
              const unit2  = b.units>0 ? total2/b.units : 0;
              return {total:total2,unit:unit2};
            })();
            const isActive = selectedId===b.id;
            return(
              <div key={b.id} onClick={()=>setSelectedId(b.id)}
                style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",
                  borderRadius:3,cursor:"pointer",
                  background:isActive?C.goldBg:C.el,
                  border:`1px solid ${isActive?C.gold+"55":C.brd}`,
                  transition:"all 0.15s"}}>
                <div style={{width:6,height:6,borderRadius:"50%",flexShrink:0,
                  background:isActive?C.gold:C.dim}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,color:isActive?C.text:C.sub,
                    fontWeight:isActive?500:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {b.name||"Sin nombre"}
                  </div>
                  <div style={{fontSize:8.5,color:C.dim,marginTop:2}}>
                    {b.createdAt} · TC {b.tc} · {b.units}u
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:12,color:isActive?C.gold:C.sub}}>{sol(bR.total,0)}</div>
                  <div style={{fontSize:8.5,color:C.dim}}>{sol(bR.unit,2)}/u</div>
                </div>
                <button onClick={e=>{e.stopPropagation();removeBatch(b.id);}}
                  title="Eliminar lote"
                  style={{background:"transparent",border:"none",color:C.dim,cursor:"pointer",
                    fontSize:14,padding:"0 2px",lineHeight:1,fontFamily:"inherit",flexShrink:0,
                    transition:"color 0.15s"}}
                  onMouseEnter={ev=>ev.target.style.color=C.err}
                  onMouseLeave={ev=>ev.target.style.color=C.dim}>×</button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── SELECTED BATCH EDITOR ── */}
      {selected && R && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          {/* LEFT */}
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"18px 20px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div>
                  <div style={{fontSize:8,letterSpacing:"0.22em",color:C.dim,fontWeight:600}}>IDENTIFICACIÓN DEL LOTE</div>
                  {selected.createdAt && (
                    <div style={{fontSize:8.5,color:C.dim,marginTop:3}}>Registrado: {selected.createdAt}</div>
                  )}
                </div>
                <button onClick={syncFromSettings} style={{...btnGhost,padding:"4px 9px",fontSize:8.5}}>
                  ↺ usar TC/Split de Config.
                </button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:9}}>
                <Field label="NOMBRE DEL PRODUCTO" type="text" value={selected.name}
                  onChange={e=>upd("name",e.target.value)}/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
                  <Field label="TIPO DE CAMBIO (fijado al registrar)" prefix="S/" value={selected.tc}
                    onChange={e=>upd("tc",e.target.value)}/>
                  <Field label={`SPLIT ${settings.partnerA.toUpperCase()}`} prefix="%" value={selected.splitE}
                    onChange={e=>upd("splitE",e.target.value)}/>
                </div>
              </div>
            </div>

            <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"18px 20px"}}>
              <div style={{fontSize:8,letterSpacing:"0.22em",color:C.dim,marginBottom:12,fontWeight:600}}>
                COMPRA EN ORIGEN (USA)
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:9}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
                  <Field label="PRECIO UNITARIO" prefix="USD" value={selected.priceUSD}
                    onChange={e=>upd("priceUSD",e.target.value)}/>
                  <Field label="UNIDADES" step="1" value={selected.units}
                    onChange={e=>upd("units",e.target.value)}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
                  <Field label="DESCUENTO" prefix="%" value={selected.discount}
                    onChange={e=>upd("discount",e.target.value)}/>
                  <Field label="ARANCELES / TAXES" prefix="%" value={selected.tax}
                    onChange={e=>upd("tax",e.target.value)}/>
                </div>
                <Sub label="Subtotal producto (S/)" value={R.prod}/>
              </div>
            </div>

            <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"18px 20px"}}>
              <div style={{fontSize:8,letterSpacing:"0.22em",color:C.dim,marginBottom:12,fontWeight:600}}>
                COSTOS LOGÍSTICOS (S/)
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:9}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
                  <Field label="ENVÍO USA → PERÚ" value={selected.ship}
                    onChange={e=>upd("ship",e.target.value)}/>
                  <Field label="DESADUANAJE" value={selected.customs}
                    onChange={e=>upd("customs",e.target.value)}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:9}}>
                  <Field label="REEMPAQUE" value={selected.repack}
                    onChange={e=>upd("repack",e.target.value)}/>
                  <Field label="SHALOM/COMBI" value={selected.local}
                    onChange={e=>upd("local",e.target.value)}/>
                  <Field label="PASAJES" value={selected.travel}
                    onChange={e=>upd("travel",e.target.value)}/>
                </div>
                <Sub label="Total logística (S/)" value={R.log}/>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"18px 20px"}}>
              <div style={{fontSize:8,letterSpacing:"0.22em",color:C.dim,marginBottom:12,fontWeight:600}}>
                DESGLOSE FINAL
              </div>
              <RRow label="Base USD convertida" value={R.bPEN}/>
              <RRow label={`Aranceles (${selected.tax}%)`} value={R.tax}/>
              <RRow label="Subtotal Producto" value={R.prod}/>
              <RRow label="Total Logística" value={R.log}/>
              <div style={{height:1,background:C.gold,opacity:0.2,margin:"10px 0"}}/>
              <RRow label="COSTO TOTAL (S/)" value={R.total} large accent/>
              <RRow label={`Costo / Unidad (${selected.units}u)`} value={R.unit} accent/>
              <RRow label="Logística / Unidad" value={R.logU} isLight/>
            </div>

            <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"18px 20px"}}>
              <div style={{fontSize:8,letterSpacing:"0.22em",color:C.dim,marginBottom:14,fontWeight:600}}>
                CAPITAL INVERTIDO POR SOCIO
              </div>
              {[
                [settings.partnerA, selected.splitE, R.total*(selected.splitE/100), C.gold],
                [settings.partnerB, 100-selected.splitE, R.total*((100-selected.splitE)/100), C.sub],
              ].map(([name,pct,amount,color])=>(
                <div key={name} style={{marginBottom:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:11,color:C.sub}}>{name}</span>
                    <span style={{fontSize:22,fontWeight:200,color}}>{sol(amount,2)}</span>
                  </div>
                  <div style={{height:2,background:C.brd,borderRadius:2}}>
                    <div style={{height:"100%",background:color,borderRadius:2,
                      width:`${pct}%`,transition:"width 0.3s"}}/>
                  </div>
                  <div style={{fontSize:8.5,color:C.dim,marginTop:3}}>{pct}% del capital total</div>
                </div>
              ))}
            </div>

            <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"18px 20px"}}>
              <div style={{fontSize:8,letterSpacing:"0.22em",color:C.dim,marginBottom:12,fontWeight:600}}>
                COMPOSICIÓN DEL COSTO
              </div>
              <div style={{display:"flex",height:6,borderRadius:3,overflow:"hidden",marginBottom:12}}>
                {R.total>0 && [[R.prod,C.gold],[R.log,C.sub]].map(([v,col],i)=>(
                  <div key={i} style={{flex:v,background:col,opacity:0.75}}/>
                ))}
              </div>
              <div style={{display:"flex",gap:18}}>
                {[["Producto",R.prod,C.gold],["Logística",R.log,C.sub]].map(([lbl,v,col])=>(
                  <div key={lbl} style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:7,height:7,background:col,borderRadius:1,opacity:0.75}}/>
                    <span style={{fontSize:9,color:C.dim}}>
                      {lbl} — {R.total>0?num((v/R.total)*100,1):0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {!selected && !creating && (
        <div style={{textAlign:"center",padding:"40px 0",color:C.dim,fontSize:11}}>
          No hay lotes. Usa "+ Nuevo lote" para registrar tu primera importación.
        </div>
      )}
    </div>
  );
}

// ── INVENTORY ITEM CARD ─────────────────────────────────────────────────────
function InvItemCard({item,settings,patchItem,removeItem,convert,isOpen,onToggleSell,sellForm,setSellForm,onSubmitSell}){
  const costPerMl = item.ml>0 ? item.cost/item.ml : 0;
  const recovered = Math.min(item.cost, costPerMl*(item.decantSold||0));
  const recoveryPct = item.cost>0 ? (recovered/item.cost)*100 : 0;
  const mlNum = parseFloat(sellForm.ml)||0;
  const priceNum = parseFloat(sellForm.price)||0;
  const costPortion = costPerMl*mlNum;
  const profit = priceNum-costPortion;
  const shareA = profit*(item.splitE/100) + (item.ownership==="socio"&&item.ownerName===settings.partnerA?costPortion:0);
  const shareB = profit*((100-item.splitE)/100) + (item.ownership==="socio"&&item.ownerName===settings.partnerB?costPortion:0);
  const stockColor = item.stock===0?C.err:item.stock<=1?C.warn:C.text;
  const canSell = mlNum>0 && mlNum<=item.decantMl && priceNum>0;

  return(
    <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"16px 18px",marginBottom:10}}>
      <div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap",marginBottom:10}}>
        <div style={{flex:"2 1 200px"}}>
          <Field label="FRAGANCIA" type="text" value={item.name} onChange={e=>patchItem(item.id,"name",e.target.value)}/>
        </div>
        <div style={{flex:"0 1 70px"}}>
          <Field label="ML" step="1" value={item.ml} onChange={e=>patchItem(item.id,"ml",parseFloat(e.target.value)||0)}/>
        </div>
        <div style={{flex:"0 1 70px"}}>
          <Field label="STOCK" step="1" value={item.stock} onChange={e=>patchItem(item.id,"stock",parseFloat(e.target.value)||0)}/>
        </div>
        <div style={{flex:"0 1 100px"}}>
          <Field label="COSTO" prefix="S/" value={item.cost} onChange={e=>patchItem(item.id,"cost",parseFloat(e.target.value)||0)}/>
        </div>
        <div style={{flex:"0 1 90px"}}>
          <Field label="SPLIT E%" prefix="%" value={item.splitE}
            onChange={e=>patchItem(item.id,"splitE",Math.min(100,Math.max(0,parseFloat(e.target.value)||0)))}/>
        </div>
        <div style={{flex:"0 1 160px"}}>
          <Select label="PROPIEDAD" value={item.ownership}
            onChange={e=>{
              const val = e.target.value;
              patchItem(item.id,"ownership",val);
              if(val==="socio" && !item.ownerName) patchItem(item.id,"ownerName",settings.partnerA);
            }}
            options={[{value:"negocio",label:"Capital del negocio"},{value:"socio",label:"Aporte previo de un socio"}]}/>
        </div>
        {item.ownership==="socio" && (
          <div style={{flex:"0 1 130px"}}>
            <Select label="DUEÑO ORIGINAL" value={item.ownerName||settings.partnerA}
              onChange={e=>patchItem(item.id,"ownerName",e.target.value)}
              options={[settings.partnerA,settings.partnerB]}/>
          </div>
        )}
        <button onClick={()=>removeItem(item.id)} title="Eliminar producto" style={{
          marginLeft:"auto",width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",
          background:"transparent",border:`1px solid ${C.brd}`,borderRadius:3,color:C.dim,
          cursor:"pointer",fontSize:13,fontFamily:"inherit",flexShrink:0}}>×</button>
      </div>

      <div style={{height:1,background:C.brd,margin:"6px 0 12px"}}/>

      <div style={{display:"flex",gap:18,alignItems:"center",flexWrap:"wrap"}}>
        <div>
          <div style={{fontSize:8,letterSpacing:"0.14em",color:C.dim}}>STOCK SELLADO</div>
          <div style={{fontSize:18,fontWeight:200,color:stockColor}}>{item.stock}<span style={{fontSize:9,color:C.dim,fontWeight:400}}> u</span></div>
        </div>
        <div>
          <div style={{fontSize:8,letterSpacing:"0.14em",color:C.dim}}>POOL DE DECANTS</div>
          <div style={{fontSize:18,fontWeight:200,color:C.gold}}>{num(item.decantMl)}<span style={{fontSize:9,color:C.dim,fontWeight:400}}> ml</span></div>
        </div>
        <div>
          <div style={{fontSize:8,letterSpacing:"0.14em",color:C.dim}}>PRECIO MÍN. SUGERIDO (+{settings.minMarginPct}%)</div>
          <div style={{fontSize:14,fontWeight:200,color:C.sub}}>{sol(item.cost*(1+settings.minMarginPct/100),2)}</div>
        </div>
        <button onClick={()=>convert(item.id)} disabled={item.stock<1} style={{
          padding:"7px 12px",background:item.stock>=1?C.el:"transparent",
          border:`1px solid ${item.stock>=1?C.brd:"transparent"}`,borderRadius:3,fontSize:9,
          letterSpacing:"0.06em",color:item.stock>=1?C.gold:C.dim,
          cursor:item.stock>=1?"pointer":"default",fontFamily:"inherit"}}>
          ⊕ Fraccionar 1 unidad
        </button>
        <button onClick={onToggleSell} disabled={item.decantMl<=0} style={{
          padding:"7px 12px",background:item.decantMl>0?C.goldBg:"transparent",
          border:`1px solid ${item.decantMl>0?C.gold+"55":C.brd}`,borderRadius:3,fontSize:9,
          letterSpacing:"0.06em",color:item.decantMl>0?C.gold:C.dim,
          cursor:item.decantMl>0?"pointer":"default",fontFamily:"inherit",marginLeft:"auto"}}>
          {isOpen?"✕ Cerrar":"✎ Vender decant"}
        </button>
      </div>

      {item.ownership==="socio" && (
        <div style={{marginTop:12}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:8.5,color:C.dim,marginBottom:4}}>
            <span>CAPITAL DE {(item.ownerName||settings.partnerA).toUpperCase()} RECUPERADO</span>
            <span>{sol(recovered,2)} / {sol(item.cost,2)}</span>
          </div>
          <div style={{height:3,background:C.brd,borderRadius:2}}>
            <div style={{height:"100%",background:C.gold,borderRadius:2,width:`${Math.min(100,recoveryPct)}%`,transition:"width 0.3s"}}/>
          </div>
        </div>
      )}

      {isOpen && (
        <div style={{marginTop:14,background:C.el,borderRadius:3,padding:"14px 16px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:9,marginBottom:10}}>
            <Field label="ML A VENDER" value={sellForm.ml} onChange={e=>setSellForm({...sellForm,ml:e.target.value})}/>
            <Field label="PRECIO DE VENTA" prefix="S/" value={sellForm.price} onChange={e=>setSellForm({...sellForm,price:e.target.value})}/>
            <Field label="CLIENTE (OPCIONAL)" type="text" value={sellForm.client} onChange={e=>setSellForm({...sellForm,client:e.target.value})}/>
          </div>
          {mlNum>0 && priceNum>0 && (
            <div style={{display:"flex",gap:18,flexWrap:"wrap",marginBottom:10,fontSize:10}}>
              <div><span style={{color:C.dim}}>Costo recuperado: </span><span style={{color:C.text}}>{sol(costPortion,2)}</span></div>
              <div><span style={{color:C.dim}}>Margen a repartir: </span><span style={{color:profit>=0?C.ok:C.err}}>{sol(profit,2)}</span></div>
              <div><span style={{color:C.dim}}>{settings.partnerA}: </span><span style={{color:C.gold}}>{sol(shareA,2)}</span></div>
              <div><span style={{color:C.dim}}>{settings.partnerB}: </span><span style={{color:C.sub}}>{sol(shareB,2)}</span></div>
            </div>
          )}
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <button onClick={onToggleSell} style={btnGhost}>Cancelar</button>
            <button onClick={()=>onSubmitSell(item)} disabled={!canSell}
              style={{...btnGold, opacity:canSell?1:0.4, cursor:canSell?"pointer":"default"}}>
              Registrar venta
            </button>
          </div>
          {mlNum>item.decantMl && <div style={{fontSize:9,color:C.err,marginTop:6}}>Solo hay {num(item.decantMl)} ml disponibles en el pool.</div>}
        </div>
      )}
    </div>
  );
}

// ── INVENTORY VIEW ──────────────────────────────────────────────────────────
function InventoryView({inventory,setInventory,settings,sellDecant}){
  const [openId,setOpenId] = useState(null);
  const [sellForm,setSellForm] = useState({ml:"",price:"",client:""});

  const patchItem = (id,field,value) => setInventory(prev=>prev.map(i=>i.id===id?{...i,[field]:value}:i));
  const removeItem = id => setInventory(prev=>prev.filter(i=>i.id!==id));
  const convert = id => setInventory(prev=>prev.map(i=>
    i.id===id && i.stock>0 ? {...i,stock:i.stock-1,decantMl:i.decantMl+i.ml} : i));
  const addItem = () => setInventory(prev=>[{
    id:Date.now(), name:"Nuevo perfume", ml:50, stock:0, cost:0,
    splitE:settings.splitDefault, decantMl:0, decantSold:0, ownership:"negocio", ownerName:"",
  },...prev]);

  const toggleSell = id => { setOpenId(prev=>prev===id?null:id); setSellForm({ml:"",price:"",client:""}); };
  const submitSell = (item) => {
    const ok = sellDecant(item.id, sellForm.ml, sellForm.price, sellForm.client);
    if(ok){ setOpenId(null); setSellForm({ml:"",price:"",client:""}); }
  };

  const totalVal = inventory.reduce((a,i)=>a+i.cost*i.stock,0);
  const totalMl  = inventory.reduce((a,i)=>a+i.decantMl,0);

  return(
    <div style={{height:"100vh",overflowY:"auto",padding:28}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:24,gap:12,flexWrap:"wrap"}}>
        <div>
          <div style={{fontSize:9,letterSpacing:"0.35em",color:C.gold,fontWeight:600}}>MÓDULO 03</div>
          <div style={{fontSize:22,fontWeight:300,marginTop:4}}>Inventario & Decants</div>
          <div style={{fontSize:10.5,color:C.dim,marginTop:5,maxWidth:520}}>
            Marca qué productos son capital del negocio o aporte previo de un socio: así cada venta de decant
            recupera primero ese capital antes de repartir el margen.
          </div>
        </div>
        <button onClick={addItem} style={btnGold}>+ Agregar perfume</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
        {[
          {l:"VALOR EN STOCK",v:sol(totalVal,0),s:`${inventory.reduce((a,i)=>a+i.stock,0)} botellas selladas`},
          {l:"ML EN DECANTS",v:`${num(totalMl)} ml`,s:"Pool total fraccionado"},
          {l:"REFERENCIAS ACTIVAS",v:inventory.filter(i=>i.stock>0||i.decantMl>0).length,s:`De ${inventory.length} productos`},
        ].map(({l,v,s})=>(
          <div key={l} style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"14px 16px"}}>
            <div style={kpiLabelStyle}>{l}</div>
            <div style={{fontSize:18,fontWeight:200}}>{v}</div>
            <div style={{fontSize:9,color:C.dim,marginTop:4}}>{s}</div>
          </div>
        ))}
      </div>

      {inventory.map(item=>(
        <InvItemCard key={item.id} item={item} settings={settings}
          patchItem={patchItem} removeItem={removeItem} convert={convert}
          isOpen={openId===item.id} onToggleSell={()=>toggleSell(item.id)}
          sellForm={sellForm} setSellForm={setSellForm} onSubmitSell={submitSell}/>
      ))}

      <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"16px 18px",marginTop:6}}>
        <div style={{fontSize:8,letterSpacing:"0.22em",color:C.dim,marginBottom:12,fontWeight:600}}>
          FORMATOS ESTÁNDAR DE DECANT
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
          {[
            {f:"5ml",r:"×20/botella 100ml",p:"S/ 35–55",u:"MUESTRA PREMIUM"},
            {f:"10ml",r:"×10/botella 100ml",p:"S/ 70–110",u:"USO PERSONAL"},
            {f:"50ml",r:"Refrasco sellado",p:"S/ 190–270",u:"REGALO"},
            {f:"3×50ml",r:"Kit tres aromas",p:"S/ 240–340",u:"PROMOCIÓN"},
          ].map(({f,r,p,u})=>(
            <div key={f} style={{padding:"11px 13px",background:C.el,borderRadius:3}}>
              <div style={{fontSize:15,fontWeight:200,color:C.gold}}>{f}</div>
              <div style={{fontSize:8.5,color:C.dim,marginTop:4}}>{r}</div>
              <div style={{fontSize:9.5,color:C.sub,marginTop:3}}>{p}</div>
              <div style={{fontSize:8,color:C.dim,marginTop:3,letterSpacing:"0.1em"}}>{u}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── PAGOS A SOCIO (liquidación de perfumes sellados) ────────────────────────
function emptyExpenseRow(){ return {id:Date.now()+Math.random(), label:"", amount:""}; }

function PaymentsView({sales,setSales,settlements,setSettlements,settings}){
  const eligible = useMemo(()=> sales.filter(s=>s.kind==="sellada" && s.status==="paid" && !s.settlementId), [sales]);
  const allSelladas = useMemo(()=> sales.filter(s=>s.kind==="sellada"), [sales]);
  const [included,setIncluded] = useState({});
  const [expenses,setExpenses] = useState([emptyExpenseRow()]);

  useEffect(()=>{
    setIncluded(prev=>{
      const next = {...prev};
      eligible.forEach(s=>{ if(!(s.id in next)) next[s.id]=true; });
      return next;
    });
    // eslint-disable-next-line
  }, [eligible.map(s=>s.id).join(",")]);

  const chosen = eligible.filter(s=>included[s.id]);
  const totalVenta = chosen.reduce((a,s)=>a+s.amount,0);
  const totalCosto = chosen.reduce((a,s)=>a+(s.cost||0),0);
  const utilidadBruta = totalVenta-totalCosto;
  const totalGastos = expenses.reduce((a,e)=>a+(parseFloat(e.amount)||0),0);
  const utilidadNeta = utilidadBruta-totalGastos;
  const splitE = settings.splitDefault;
  const shareA = utilidadNeta*splitE/100;
  const shareB = utilidadNeta*(100-splitE)/100;

  const toggleInclude = id => setIncluded(prev=>({...prev,[id]:!prev[id]}));
  const updateExpense = (id,field,value) => setExpenses(prev=>prev.map(e=>e.id===id?{...e,[field]:value}:e));
  const addExpense = () => setExpenses(prev=>[...prev,emptyExpenseRow()]);
  const removeExpense = id => setExpenses(prev=>prev.filter(e=>e.id!==id));

  const generateSettlement = () => {
    if(chosen.length===0) return;
    const record = {
      id: Date.now(), date: todayFull(),
      items: chosen.map(s=>({id:s.id, product:s.product, client:s.client, venta:s.amount, costo:s.cost||0})),
      totalVenta, totalCosto, utilidadBruta,
      gastos: expenses.filter(e=>e.label.trim()||parseFloat(e.amount)>0)
        .map(e=>({label:e.label.trim()||"Gasto", amount:parseFloat(e.amount)||0})),
      totalGastos, utilidadNeta, splitUsed: splitE, shareA, shareB,
    };
    setSettlements(prev=>[record, ...prev]);
    setSales(prev=>prev.map(s=> chosen.some(c=>c.id===s.id)
      ? {...s, settlementId:record.id, paidToSocio:true, paidDate:todayLabel()}
      : s));
    setExpenses([emptyExpenseRow()]);
  };

  const restoreSalesFromSettlement = (record) => {
    setSales(prev=>prev.map(s=> record.items.some(it=>it.id===s.id)
      ? {...s, settlementId:null, paidToSocio:false, paidDate:null}
      : s));
  };

  const deleteSettlement = (record) => {
    if(!window.confirm("¿Eliminar esta liquidación? Las ventas incluidas volverán a la lista de pendientes de liquidar.")) return;
    restoreSalesFromSettlement(record);
    setSettlements(prev=>prev.filter(r=>r.id!==record.id));
  };

  const editSettlement = (record) => {
    restoreSalesFromSettlement(record);
    setSettlements(prev=>prev.filter(r=>r.id!==record.id));
    setExpenses(record.gastos && record.gastos.length
      ? record.gastos.map(g=>({id:Date.now()+Math.random(), label:g.label, amount:String(g.amount)}))
      : [emptyExpenseRow()]);
  };

  return(
    <div style={{height:"100vh",overflowY:"auto",padding:28}}>
      <div style={{marginBottom:22}}>
        <div style={{fontSize:9,letterSpacing:"0.35em",color:C.gold,fontWeight:600}}>MÓDULO 05</div>
        <div style={{fontSize:22,fontWeight:300,marginTop:4}}>Liquidación de Perfumes Sellados</div>
        <div style={{fontSize:10.5,color:C.dim,marginTop:5,maxWidth:580}}>
          Igual que tu hoja "Resumen de pago": junta las botellas ya cobradas, resta gastos de venta (ej. taxi)
          y reparte la utilidad neta según el split configurado. Las ventas de decants no entran aquí — se
          reparten al momento de venderse, en el módulo de Inventario.
        </div>
      </div>

      <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"16px 18px",marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:8,letterSpacing:"0.22em",color:C.dim,fontWeight:600}}>
            VENTAS SELLADAS COBRADAS · PENDIENTES DE LIQUIDAR
          </div>
          <div style={{fontSize:8.5,color:C.dim}}>{eligible.length} venta(s) · {chosen.length} seleccionada(s)</div>
        </div>
        {allSelladas.length===0 ? (
          <div style={{fontSize:10,color:C.dim,padding:"6px 0"}}>
            No hay ventas selladas registradas. Agrega una venta de tipo "Botella sellada" desde el Dashboard.
          </div>
        ) : eligible.length===0 && allSelladas.length>0 ? (
          <div style={{fontSize:10,color:C.dim,padding:"6px 0"}}>
            Todas las ventas selladas ya fueron liquidadas o están pendientes de cobro.
            Marca las ventas como "Pagado" en el Dashboard para que aparezcan aquí.
          </div>
        ) : eligible.map(s=>(
          <div key={s.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:`1px solid ${C.brd}`}}>
            <input type="checkbox" checked={!!included[s.id]} onChange={()=>toggleInclude(s.id)}
              style={{width:14,height:14,accentColor:C.gold,cursor:"pointer",flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:10.5,color:C.text}}>{s.product}</div>
              <div style={{fontSize:8.5,color:C.dim}}>{s.client} · {s.date}</div>
            </div>
            <div style={{fontSize:10,color:C.dim,width:90,textAlign:"right"}}>Costo {sol(s.cost||0,2)}</div>
            <div style={{fontSize:11,color:C.text,width:90,textAlign:"right"}}>{sol(s.amount,2)}</div>
            <button onClick={()=>setSales(prev=>prev.filter(x=>x.id!==s.id))}
              title="Eliminar esta venta"
              style={{background:"transparent",border:"none",color:C.dim,cursor:"pointer",
                fontSize:15,padding:0,lineHeight:1,fontFamily:"inherit",flexShrink:0}}
              onMouseEnter={e=>e.target.style.color=C.err}
              onMouseLeave={e=>e.target.style.color=C.dim}>×</button>
          </div>
        ))}
      </div>

      <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"16px 18px",marginBottom:14}}>
        <div style={{fontSize:8,letterSpacing:"0.22em",color:C.dim,marginBottom:10,fontWeight:600}}>GASTOS DE VENTA</div>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:10}}>
          {expenses.map(e=>(
            <div key={e.id} style={{display:"grid",gridTemplateColumns:"1fr 140px 30px",gap:8}}>
              <Field label="DESCRIPCIÓN" type="text" value={e.label} onChange={ev=>updateExpense(e.id,"label",ev.target.value)}/>
              <Field label="MONTO" prefix="S/" value={e.amount} onChange={ev=>updateExpense(e.id,"amount",ev.target.value)}/>
              <button onClick={()=>removeExpense(e.id)} style={{height:36,marginTop:18,background:"transparent",
                border:`1px solid ${C.brd}`,borderRadius:3,color:C.dim,cursor:"pointer",fontFamily:"inherit"}}>×</button>
            </div>
          ))}
        </div>
        <button onClick={addExpense} style={btnGhost}>+ Agregar gasto</button>
      </div>

      <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"18px 20px",marginBottom:14}}>
        <div style={{fontSize:8,letterSpacing:"0.22em",color:C.dim,marginBottom:14,fontWeight:600}}>RESUMEN DE LA LIQUIDACIÓN</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
          <div>
            {[["Ventas",totalVenta],["Costo de ventas",totalCosto],["Utilidad Bruta",utilidadBruta],
              ["Gastos de venta",-totalGastos],["Utilidad Neta",utilidadNeta]].map(([l,v],i)=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",
                borderBottom: i<4?`1px solid ${C.brd}`:"none"}}>
                <span style={{fontSize:10,color:i===4?C.text:C.dim,fontWeight:i===4?600:400}}>{l}</span>
                <span style={{fontSize:i===4?15:11,color:i===4?C.gold:C.text,fontWeight:i===4?700:400}}>{sol(v,2)}</span>
              </div>
            ))}
          </div>
          <div style={{background:C.el,borderRadius:3,padding:"14px 16px"}}>
            <div style={{fontSize:8,letterSpacing:"0.15em",color:C.dim,marginBottom:10}}>REPARTO ({splitE}% / {100-splitE}%)</div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:11,color:C.sub}}>{settings.partnerA}</span>
              <span style={{fontSize:18,fontWeight:200,color:C.gold}}>{sol(shareA,2)}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:11,color:C.sub}}>{settings.partnerB}</span>
              <span style={{fontSize:18,fontWeight:200,color:C.sub}}>{sol(shareB,2)}</span>
            </div>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:14}}>
          <button onClick={generateSettlement} disabled={chosen.length===0}
            style={{...btnGold, opacity:chosen.length?1:0.4, cursor:chosen.length?"pointer":"default"}}>
            Generar liquidación y marcar como pagado
          </button>
        </div>
      </div>

      <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,overflow:"hidden"}}>
        <div style={{padding:"12px 18px",background:C.el,borderBottom:`1px solid ${C.brd}`,
          fontSize:8,letterSpacing:"0.2em",color:C.dim,fontWeight:600}}>HISTORIAL DE LIQUIDACIONES</div>
        {settlements.length===0 ? (
          <div style={{padding:"16px 18px",fontSize:10,color:C.dim}}>Aún no se ha generado ninguna liquidación.</div>
        ) : settlements.map(r=>(
          <div key={r.id} style={{padding:"12px 18px",borderBottom:`1px solid ${C.brd}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <div>
                <div style={{fontSize:10.5,color:C.text}}>{r.date} · {r.items.length} producto(s)</div>
                <div style={{fontSize:8.5,color:C.dim,marginTop:2}}>
                  Ventas {sol(r.totalVenta,2)} · Costo {sol(r.totalCosto,2)} · Gastos {sol(r.totalGastos,2)} · Neta {sol(r.utilidadNeta,2)}
                </div>
              </div>
              <div style={{display:"flex",gap:16,alignItems:"center"}}>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:8,color:C.dim}}>{settings.partnerA}</div>
                  <div style={{fontSize:12,color:C.gold}}>{sol(r.shareA,2)}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:8,color:C.dim}}>{settings.partnerB}</div>
                  <div style={{fontSize:12,color:C.sub}}>{sol(r.shareB,2)}</div>
                </div>
                <div style={{display:"flex",gap:5,marginLeft:6}}>
                  <button onClick={()=>editSettlement(r)} title="Editar liquidación"
                    style={{background:"transparent",border:"none",color:C.dim,cursor:"pointer",
                      fontSize:11,padding:2,lineHeight:1,fontFamily:"inherit",transition:"color 0.15s"}}
                    onMouseEnter={e=>e.target.style.color=C.gold}
                    onMouseLeave={e=>e.target.style.color=C.dim}>✎</button>
                  <button onClick={()=>deleteSettlement(r)} title="Eliminar liquidación"
                    style={{background:"transparent",border:"none",color:C.dim,cursor:"pointer",
                      fontSize:13,padding:2,lineHeight:1,fontFamily:"inherit",transition:"color 0.15s"}}
                    onMouseEnter={e=>e.target.style.color=C.err}
                    onMouseLeave={e=>e.target.style.color=C.dim}>×</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── QUOTE DOCUMENT (preview) ─────────────────────────────────────────────────
function QuoteDoc({quote,settings}){
  return(
    <div id="quote-doc" style={{
      width:680, maxWidth:"100%", margin:"0 auto", background:"#FBF9F4", color:"#1C1A14",
      borderRadius:2, padding:"46px 50px", fontFamily:"Georgia,'Times New Roman',serif",
      boxShadow:"0 30px 80px rgba(0,0,0,0.5)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",
        borderBottom:"2px solid #C9A84C",paddingBottom:18,marginBottom:24}}>
        <div>
          <div style={{fontSize:20,letterSpacing:"0.18em",fontWeight:700,color:"#1C1A14"}}>
            {(settings.businessName||"ELEGANZZA").toUpperCase()}
          </div>
          <div style={{fontSize:10,letterSpacing:"0.1em",color:"#8a8472",marginTop:4,fontFamily:"Helvetica,Arial,sans-serif"}}>
            COTIZACIÓN DE PRODUCTOS
          </div>
        </div>
        <div style={{textAlign:"right",fontFamily:"Helvetica,Arial,sans-serif"}}>
          <div style={{fontSize:13,fontWeight:700,color:"#C9A84C"}}>{quote.number}</div>
          <div style={{fontSize:9.5,color:"#8a8472",marginTop:3}}>{quote.dateLabel}</div>
          <div style={{fontSize:9.5,color:"#8a8472"}}>Válida hasta {quote.validUntil}</div>
        </div>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",marginBottom:22,
        fontFamily:"Helvetica,Arial,sans-serif",fontSize:11}}>
        <div>
          <div style={{fontSize:8.5,letterSpacing:"0.15em",color:"#8a8472",marginBottom:3}}>CLIENTE</div>
          <div>{quote.client.name}</div>
          {quote.client.phone && <div style={{color:"#5c5848",marginTop:1}}>{quote.client.phone}</div>}
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:8.5,letterSpacing:"0.15em",color:"#8a8472",marginBottom:3}}>CONTACTO</div>
          <div>{settings.contactPhone}</div>
          <div style={{color:"#5c5848",marginTop:1}}>{settings.contactInstagram}</div>
        </div>
      </div>

      <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"Helvetica,Arial,sans-serif",fontSize:11,marginBottom:18}}>
        <thead>
          <tr style={{borderBottom:"1px solid #C9A84C"}}>
            {["Producto","Formato","Cant.","Precio Unit.","Subtotal"].map((h,i)=>(
              <th key={h} style={{textAlign:i>=2?"right":"left",padding:"6px 4px",
                fontSize:8.5,letterSpacing:"0.1em",color:"#8a8472",fontWeight:600}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {quote.items.map((it,i)=>(
            <tr key={i} style={{borderBottom:"1px solid #e8e2d0"}}>
              <td style={{padding:"8px 4px"}}>{it.name}</td>
              <td style={{padding:"8px 4px",color:"#5c5848"}}>{it.format}</td>
              <td style={{padding:"8px 4px",textAlign:"right"}}>{it.qty}</td>
              <td style={{padding:"8px 4px",textAlign:"right"}}>{sol(it.unitPrice,2)}</td>
              <td style={{padding:"8px 4px",textAlign:"right",fontWeight:600}}>{sol(it.qty*it.unitPrice,2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:24,fontFamily:"Helvetica,Arial,sans-serif"}}>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:9,letterSpacing:"0.1em",color:"#8a8472"}}>TOTAL</div>
          <div style={{fontSize:24,fontWeight:700,color:"#C9A84C"}}>{sol(quote.total,2)}</div>
        </div>
      </div>

      {quote.notes && (
        <div style={{fontSize:10.5,color:"#5c5848",marginBottom:16,fontFamily:"Helvetica,Arial,sans-serif",fontStyle:"italic"}}>
          {quote.notes}
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,
        fontFamily:"Helvetica,Arial,sans-serif",fontSize:10,color:"#5c5848",
        borderTop:"1px solid #e8e2d0",paddingTop:16,marginBottom:14}}>
        <div>
          <div style={{fontSize:8.5,letterSpacing:"0.12em",color:"#8a8472",marginBottom:4}}>MÉTODOS DE PAGO</div>
          {settings.paymentMethods}
        </div>
        <div>
          <div style={{fontSize:8.5,letterSpacing:"0.12em",color:"#8a8472",marginBottom:4}}>ENTREGA</div>
          {settings.deliveryInfo}
        </div>
      </div>

      <div style={{fontSize:8.5,color:"#9a9482",fontFamily:"Helvetica,Arial,sans-serif",lineHeight:1.5}}>
        {settings.quoteTerms}
      </div>
    </div>
  );
}

function QuoteOverlay({quote,settings,onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(5,5,7,0.92)",zIndex:1000,
      overflowY:"auto",padding:"40px 20px"}}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #quote-doc, #quote-doc * { visibility: visible; }
          #quote-doc { position: absolute; left:0; top:0; width:100%; box-shadow:none !important; }
        }
      `}</style>
      <div style={{maxWidth:680,margin:"0 auto 16px",display:"flex",justifyContent:"flex-end",gap:8}}>
        <button onClick={onClose} style={btnGhost}>Cerrar</button>
        <button onClick={()=>downloadQuote(quote,settings)} style={btnGhost}>Descargar .html</button>
        <button onClick={()=>window.print()} style={btnGold}>Imprimir / Guardar PDF</button>
      </div>
      <QuoteDoc quote={quote} settings={settings}/>
    </div>
  );
}

// ── Quote helpers (downloadable standalone file) ────────────────────────────
function escapeHtml(s){
  return String(s??"").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function nextQuoteNumber(quotes){
  const max = quotes.reduce((m,q)=>{
    const n = parseInt(String(q.number||"").replace(/\D/g,""),10);
    return isNaN(n)?m:Math.max(m,n);
  },0);
  return `COT-${String(max+1).padStart(4,"0")}`;
}

function buildQuoteHTMLDoc(quote,settings){
  const rows = quote.items.map(it => `
    <tr style="border-bottom:1px solid #e8e2d0;">
      <td style="padding:8px 4px;">${escapeHtml(it.name)}</td>
      <td style="padding:8px 4px;color:#5c5848;">${escapeHtml(it.format)}</td>
      <td style="padding:8px 4px;text-align:right;">${it.qty}</td>
      <td style="padding:8px 4px;text-align:right;">${sol(it.unitPrice,2)}</td>
      <td style="padding:8px 4px;text-align:right;font-weight:600;">${sol(it.qty*it.unitPrice,2)}</td>
    </tr>`).join("");
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>Cotización ${quote.number}</title>
<style>
  body{font-family:Helvetica,Arial,sans-serif;background:#1c1a14;margin:0;padding:40px 16px;}
  .doc{max-width:680px;margin:0 auto;background:#FBF9F4;color:#1C1A14;padding:46px 50px;border-radius:2px;}
  h1{font-family:Georgia,'Times New Roman',serif;font-size:20px;letter-spacing:0.18em;margin:0;}
  table{width:100%;border-collapse:collapse;font-size:11px;}
  th{text-align:left;padding:6px 4px;font-size:8.5px;letter-spacing:0.1em;color:#8a8472;border-bottom:1px solid #C9A84C;}
  .right{text-align:right;}
</style></head>
<body>
<div class="doc">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #C9A84C;padding-bottom:18px;margin-bottom:24px;">
    <div>
      <h1>${escapeHtml((settings.businessName||"ELEGANZZA").toUpperCase())}</h1>
      <div style="font-size:10px;letter-spacing:0.1em;color:#8a8472;margin-top:4px;">COTIZACIÓN DE PRODUCTOS</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:13px;font-weight:700;color:#C9A84C;">${quote.number}</div>
      <div style="font-size:9.5px;color:#8a8472;margin-top:3px;">${quote.dateLabel}</div>
      <div style="font-size:9.5px;color:#8a8472;">Válida hasta ${quote.validUntil}</div>
    </div>
  </div>
  <div style="display:flex;justify-content:space-between;margin-bottom:22px;font-size:11px;">
    <div>
      <div style="font-size:8.5px;letter-spacing:0.15em;color:#8a8472;margin-bottom:3px;">CLIENTE</div>
      <div>${escapeHtml(quote.client.name)}</div>
      ${quote.client.phone?`<div style="color:#5c5848;margin-top:1px;">${escapeHtml(quote.client.phone)}</div>`:""}
    </div>
    <div style="text-align:right;">
      <div style="font-size:8.5px;letter-spacing:0.15em;color:#8a8472;margin-bottom:3px;">CONTACTO</div>
      <div>${escapeHtml(settings.contactPhone||"")}</div>
      <div style="color:#5c5848;margin-top:1px;">${escapeHtml(settings.contactInstagram||"")}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Producto</th><th>Formato</th><th class="right">Cant.</th><th class="right">Precio Unit.</th><th class="right">Subtotal</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="display:flex;justify-content:flex-end;margin:24px 0;">
    <div style="text-align:right;">
      <div style="font-size:9px;letter-spacing:0.1em;color:#8a8472;">TOTAL</div>
      <div style="font-size:24px;font-weight:700;color:#C9A84C;">${sol(quote.total,2)}</div>
    </div>
  </div>
  ${quote.notes?`<div style="font-size:10.5px;color:#5c5848;margin-bottom:16px;font-style:italic;">${escapeHtml(quote.notes)}</div>`:""}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:10px;color:#5c5848;border-top:1px solid #e8e2d0;padding-top:16px;margin-bottom:14px;">
    <div><div style="font-size:8.5px;letter-spacing:0.12em;color:#8a8472;margin-bottom:4px;">MÉTODOS DE PAGO</div>${escapeHtml(settings.paymentMethods||"")}</div>
    <div><div style="font-size:8.5px;letter-spacing:0.12em;color:#8a8472;margin-bottom:4px;">ENTREGA</div>${escapeHtml(settings.deliveryInfo||"")}</div>
  </div>
  <div style="font-size:8.5px;color:#9a9482;line-height:1.5;">${escapeHtml(settings.quoteTerms||"")}</div>
</div>
</body></html>`;
}

function downloadQuote(quote,settings){
  try{
    const html = buildQuoteHTMLDoc(quote,settings);
    const blob = new Blob([html], {type:"text/html"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Cotizacion-${quote.number}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
  }catch(e){
    console.error("No se pudo descargar la cotización", e);
  }
}

function emptyItemRow(){
  return {id:Date.now()+Math.random(), itemId:"", name:"", format:"Decant 10ml", qty:1, unitPrice:""};
}

// ── QUOTES VIEW ──────────────────────────────────────────────────────────────
function QuotesView({inventory,quotes,setQuotes,settings}){
  const [form,setForm] = useState({clientName:"",clientPhone:"",notes:"",items:[emptyItemRow()]});
  const [preview,setPreview] = useState(null);

  const updateRow = (id,field,value) => setForm(f=>({...f,items:f.items.map(r=>{
    if(r.id!==id) return r;
    const next = {...r,[field]:value};
    if(field==="itemId" && value){
      const inv = inventory.find(i=>String(i.id)===String(value));
      if(inv) next.name = inv.name;
    }
    return next;
  })}));
  const addRow = () => setForm(f=>({...f,items:[...f.items,emptyItemRow()]}));
  const removeRow = id => setForm(f=>({...f,items:f.items.filter(r=>r.id!==id)}));

  const total = form.items.reduce((a,r)=>a+(parseFloat(r.qty)||0)*(parseFloat(r.unitPrice)||0),0);

  const generate = () => {
    const validItems = form.items.filter(r=>(r.name||"").trim() && parseFloat(r.unitPrice)>0);
    if(!form.clientName.trim() || validItems.length===0) return;
    const number = nextQuoteNumber(quotes);
    const quote = {
      id: Date.now(), number, dateLabel: todayFull(),
      validUntil: addDaysLabel(settings.quoteValidityDays||3),
      client: {name:form.clientName.trim(), phone:form.clientPhone.trim()},
      items: validItems.map(r=>({name:r.name,format:r.format,qty:parseFloat(r.qty)||1,unitPrice:parseFloat(r.unitPrice)||0})),
      notes: form.notes.trim(),
      total: validItems.reduce((a,r)=>a+(parseFloat(r.qty)||0)*(parseFloat(r.unitPrice)||0),0),
    };
    setQuotes(prev=>[quote,...prev]);
    setForm({clientName:"",clientPhone:"",notes:"",items:[emptyItemRow()]});
    setPreview(quote);
  };

  const removeQuote = id => setQuotes(prev=>prev.filter(q=>q.id!==id));

  return(
    <div style={{height:"100vh",overflowY:"auto",padding:28}}>
      <div style={{marginBottom:22}}>
        <div style={{fontSize:9,letterSpacing:"0.35em",color:C.gold,fontWeight:600}}>MÓDULO 04</div>
        <div style={{fontSize:22,fontWeight:300,marginTop:4}}>Cotizaciones para Clientes</div>
        <div style={{fontSize:10.5,color:C.dim,marginTop:5,maxWidth:560}}>
          Llena cliente y productos, genera la cotización y descárgala o imprímela para enviarla.
        </div>
      </div>

      <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"18px 20px",marginBottom:14}}>
        <div style={{fontSize:8,letterSpacing:"0.22em",color:C.dim,marginBottom:12,fontWeight:600}}>NUEVA COTIZACIÓN</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:14}}>
          <Field label="CLIENTE" type="text" value={form.clientName} onChange={e=>setForm({...form,clientName:e.target.value})}/>
          <Field label="TELÉFONO / WHATSAPP" type="text" value={form.clientPhone} onChange={e=>setForm({...form,clientPhone:e.target.value})}/>
        </div>
        <div style={{fontSize:8,letterSpacing:"0.18em",color:C.dim,marginBottom:8,fontWeight:600}}>PRODUCTOS</div>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:10}}>
          {form.items.map(row=>(
            <div key={row.id} style={{display:"grid",gridTemplateColumns:"1.1fr 1.1fr 1fr 60px 90px 30px",gap:8,alignItems:"end"}}>
              <Select label="PERFUME" value={row.itemId} onChange={e=>updateRow(row.id,"itemId",e.target.value)}
                options={[{value:"",label:"— Personalizado —"},...inventory.map(i=>({value:String(i.id),label:i.name}))]}/>
              <Field label="NOMBRE (SI ES PERSONALIZADO)" type="text" value={row.name}
                onChange={e=>updateRow(row.id,"name",e.target.value)} readOnly={!!row.itemId}/>
              <Select label="FORMATO" value={row.format} onChange={e=>updateRow(row.id,"format",e.target.value)} options={FORMATS}/>
              <Field label="CANT." step="1" value={row.qty} onChange={e=>updateRow(row.id,"qty",e.target.value)}/>
              <Field label="PRECIO UNIT." prefix="S/" value={row.unitPrice} onChange={e=>updateRow(row.id,"unitPrice",e.target.value)}/>
              <button onClick={()=>removeRow(row.id)} style={{height:36,background:"transparent",
                border:`1px solid ${C.brd}`,borderRadius:3,color:C.dim,cursor:"pointer",fontFamily:"inherit"}}>×</button>
            </div>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <button onClick={addRow} style={btnGhost}>+ Agregar producto</button>
          <div style={{fontSize:9.5,color:C.dim}}>Total: <span style={{fontSize:14,color:C.gold,fontWeight:600}}>{sol(total,2)}</span></div>
        </div>
        <Field label="NOTAS PARA EL CLIENTE (OPCIONAL)" type="text" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}>
          <button onClick={generate} style={btnGold}>Generar cotización</button>
        </div>
      </div>

      <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,overflow:"hidden"}}>
        <div style={{padding:"12px 18px",background:C.el,borderBottom:`1px solid ${C.brd}`,
          fontSize:8,letterSpacing:"0.2em",color:C.dim,fontWeight:600}}>
          COTIZACIONES GUARDADAS
        </div>
        {quotes.length===0
          ? <div style={{padding:"16px 18px",fontSize:10,color:C.dim}}>Aún no hay cotizaciones generadas.</div>
          : quotes.map(q=>(
            <div key={q.id} style={{display:"grid",gridTemplateColumns:"90px 1fr 90px 130px 1fr",gap:10,
              padding:"11px 18px",borderBottom:`1px solid ${C.brd}`,alignItems:"center"}}>
              <div style={{fontSize:10,color:C.gold}}>{q.number}</div>
              <div>
                <div style={{fontSize:11,color:C.text}}>{q.client.name}</div>
                <div style={{fontSize:8.5,color:C.dim}}>{q.dateLabel} · {q.items.length} ítem(s)</div>
              </div>
              <div style={{fontSize:12.5,fontWeight:200}}>{sol(q.total,2)}</div>
              <div style={{fontSize:8.5,color:C.dim}}>Válida hasta {q.validUntil}</div>
              <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                <button onClick={()=>setPreview(q)} style={btnGhost}>Ver / Imprimir</button>
                <button onClick={()=>downloadQuote(q,settings)} style={btnGhost}>Descargar</button>
                <button onClick={()=>removeQuote(q.id)} style={{...btnGhost,color:C.err}}>Eliminar</button>
              </div>
            </div>
          ))}
      </div>

      {preview && <QuoteOverlay quote={preview} settings={settings} onClose={()=>setPreview(null)}/>}
    </div>
  );
}

// ── PROFITS VIEW ────────────────────────────────────────────────────────────
function ProfView({settings,setSettings}){
  const net = settings.monthlyMargin;
  const splitE = settings.splitDefault;
  const shareE = net*splitE/100, shareM = net*(100-splitE)/100;
  const up = (f,v) => setSettings(p=>({...p,[f]:v}));

  return(
    <div style={{height:"100vh",overflowY:"auto",padding:28}}>
      <div style={{marginBottom:24}}>
        <div style={{fontSize:9,letterSpacing:"0.35em",color:C.gold,fontWeight:600}}>MÓDULO 06</div>
        <div style={{fontSize:22,fontWeight:300,marginTop:4}}>Distribución de Utilidades</div>
        <div style={{fontSize:10.5,color:C.dim,marginTop:5}}>
          Liquidación basada en el margen neto del mes y el % de split configurado.
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
        {[
          {name:settings.partnerA,amount:shareE,pct:splitE,color:C.gold,sub:"Director Comercial"},
          {name:settings.partnerB,amount:shareM,pct:100-splitE,color:C.sub,sub:"Director Operativo"},
        ].map(({name,amount,pct,color,sub})=>(
          <div key={name} style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"22px 24px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontSize:8,letterSpacing:"0.35em",color:C.dim,fontWeight:600}}>{(name||"").toUpperCase()}</div>
                <div style={{fontSize:9,color:C.dim,marginTop:2}}>{sub}</div>
                <div style={{fontSize:38,fontWeight:100,color,marginTop:10,letterSpacing:"-0.02em"}}>
                  {sol(amount,2)}
                </div>
                <div style={{fontSize:9.5,color:C.dim,marginTop:6}}>
                  {pct}% de {sol(net,0)}
                </div>
              </div>
              <div style={{width:46,height:46,borderRadius:"50%",border:`1.5px solid ${color}55`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:17,fontWeight:200,color}}>{(name||"?")[0]}</div>
            </div>
            <div style={{marginTop:18,height:2,background:C.brd,borderRadius:2}}>
              <div style={{height:"100%",background:color,opacity:0.85,borderRadius:2,width:`${pct}%`}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
              <span style={{fontSize:8.5,color:C.dim}}>{pct}%</span>
              <span style={{fontSize:8.5,color:C.dim}}>100%</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"18px 20px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div>
            <div style={{fontSize:8,letterSpacing:"0.24em",color:C.dim,fontWeight:600}}>HISTÓRICO MENSUAL · DISTRIBUCIÓN</div>
            <div style={{fontSize:16,fontWeight:200,marginTop:4}}>Últimos 3 meses</div>
          </div>
          <div style={{display:"flex",gap:14}}>
            {[[settings.partnerA,C.gold],[settings.partnerB,C.sub]].map(([n,c])=>(
              <div key={n} style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:8,height:8,background:c,borderRadius:1,opacity:0.8}}/>
                <span style={{fontSize:9,color:C.dim}}>{n}</span>
              </div>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={HIST} barGap={6} margin={{top:4,right:4,bottom:0,left:0}}>
            <XAxis dataKey="mes" tick={{fontSize:9,fill:C.dim}} axisLine={false} tickLine={false}/>
            <YAxis hide/>
            <Tooltip content={<ChartTip/>}/>
            <Bar dataKey="es" name={settings.partnerA} fill={C.gold} opacity={0.8} radius={[2,2,0,0]}/>
            <Bar dataKey="mi" name={settings.partnerB} fill={C.sub}  opacity={0.6} radius={[2,2,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
        <div style={{fontSize:8.5,color:C.dim,marginTop:8}}>Vista ilustrativa — actualízala con tus cierres reales.</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"14px 16px"}}>
          <div style={kpiLabelStyle}>MARGEN NETO TOTAL</div>
          <NumberInput value={settings.monthlyMargin} onChange={n=>up("monthlyMargin",n)}
            style={{fontSize:15,fontWeight:200,background:"transparent",border:"none",color:C.text,width:"100%",outline:"none",fontFamily:"inherit"}}/>
          <div style={{fontSize:9,color:C.dim,marginTop:4}}>editable manualmente</div>
        </div>
        <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"14px 16px"}}>
          <div style={kpiLabelStyle}>PRÓXIMA LIQUIDACIÓN</div>
          <input type="text" value={settings.nextSettlementDate} onChange={e=>up("nextSettlementDate",e.target.value)}
            style={{fontSize:15,fontWeight:200,background:"transparent",border:"none",color:C.text,width:"100%",outline:"none",fontFamily:"inherit"}}/>
        </div>
        <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"14px 16px"}}>
          <div style={kpiLabelStyle}>ACUMULADO AÑO</div>
          <NumberInput value={settings.yearAccumulated} onChange={n=>up("yearAccumulated",n)}
            style={{fontSize:15,fontWeight:200,background:"transparent",border:"none",color:C.text,width:"100%",outline:"none",fontFamily:"inherit"}}/>
        </div>
        <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"14px 16px"}}>
          <div style={kpiLabelStyle}>SPLIT ACTUAL</div>
          <div style={{fontSize:15,fontWeight:200}}>{splitE}% / {100-splitE}%</div>
          <div style={{fontSize:9,color:C.dim,marginTop:4}}>Editable en Configuración</div>
        </div>
      </div>
    </div>
  );
}

// ── SETTINGS VIEW ────────────────────────────────────────────────────────────
function SettingsView({settings,setSettings}){
  const up = (f,v) => setSettings(prev=>({...prev,[f]:v}));
  return(
    <div style={{height:"100vh",overflowY:"auto",padding:28}}>
      <div style={{marginBottom:24}}>
        <div style={{fontSize:9,letterSpacing:"0.35em",color:C.gold,fontWeight:600}}>MÓDULO 00</div>
        <div style={{fontSize:22,fontWeight:300,marginTop:4}}>Configuración General</div>
        <div style={{fontSize:10.5,color:C.dim,marginTop:5}}>
          Estos valores alimentan los cálculos y las cotizaciones en todo el sistema, y se comparten con tu socio.
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:14}}>
        <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"18px 20px",display:"flex",flexDirection:"column",gap:9}}>
          <div style={{fontSize:8,letterSpacing:"0.22em",color:C.dim,marginBottom:4,fontWeight:600}}>FINANZAS</div>
          <Field label="TIPO DE CAMBIO USD → PEN" prefix="S/" value={settings.tc} onChange={e=>up("tc",parseFloat(e.target.value)||0)}/>
          <Field label={`SPLIT ${settings.partnerA.toUpperCase()} % (PREDETERMINADO)`} prefix="%" value={settings.splitDefault}
            onChange={e=>up("splitDefault",Math.min(100,Math.max(0,parseFloat(e.target.value)||0)))}/>
          <Field label="MARGEN MÍNIMO SOBRE COSTO" prefix="%" value={settings.minMarginPct}
            onChange={e=>up("minMarginPct",parseFloat(e.target.value)||0)}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
            <Field label="NOMBRE SOCIO A" type="text" value={settings.partnerA} onChange={e=>up("partnerA",e.target.value)}/>
            <Field label="NOMBRE SOCIO B" type="text" value={settings.partnerB} onChange={e=>up("partnerB",e.target.value)}/>
          </div>
        </div>
        <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"18px 20px",display:"flex",flexDirection:"column",gap:9}}>
          <div style={{fontSize:8,letterSpacing:"0.22em",color:C.dim,marginBottom:4,fontWeight:600}}>MARCA & COTIZACIONES</div>
          <Field label="NOMBRE DE LA MARCA" type="text" value={settings.businessName} onChange={e=>up("businessName",e.target.value)}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
            <Field label="TELÉFONO / WHATSAPP" type="text" value={settings.contactPhone} onChange={e=>up("contactPhone",e.target.value)}/>
            <Field label="INSTAGRAM" type="text" value={settings.contactInstagram} onChange={e=>up("contactInstagram",e.target.value)}/>
          </div>
          <Field label="VALIDEZ DE COTIZACIÓN (DÍAS)" step="1" value={settings.quoteValidityDays} onChange={e=>up("quoteValidityDays",parseInt(e.target.value)||1)}/>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:14}}>
        <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"18px 20px"}}>
          <TextArea label="MÉTODOS DE PAGO" value={settings.paymentMethods} onChange={e=>up("paymentMethods",e.target.value)} rows={3}/>
        </div>
        <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"18px 20px"}}>
          <TextArea label="POLÍTICA DE ENTREGA" value={settings.deliveryInfo} onChange={e=>up("deliveryInfo",e.target.value)} rows={3}/>
        </div>
      </div>

      <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:4,padding:"18px 20px"}}>
        <TextArea label="TÉRMINOS Y CONDICIONES (pie de cada cotización)" value={settings.quoteTerms} onChange={e=>up("quoteTerms",e.target.value)} rows={3}/>
      </div>
    </div>
  );
}

// ── SIDEBAR ─────────────────────────────────────────────────────────────────
function Sidebar({view,go,settings,syncing,syncError,lastSync,onRefresh}){
  return(
    <aside style={{width:200,height:"100vh",background:C.sf,
      borderRight:`1px solid ${C.brd}`,display:"flex",flexDirection:"column",flexShrink:0}}>
      <div style={{padding:"26px 22px 20px",borderBottom:`1px solid ${C.brd}`}}>
        <div style={{fontSize:11,letterSpacing:"0.42em",fontWeight:700,color:C.gold}}>
          {(settings.businessName||"ELEGANZZA").toUpperCase()}
        </div>
        <div style={{fontSize:8,letterSpacing:"0.25em",color:C.dim,marginTop:4}}>MANAGEMENT SYSTEM</div>
      </div>
      <div style={{height:1,background:`linear-gradient(90deg,${C.gold}80,transparent)`}}/>
      <nav style={{padding:"10px 0",flex:1,overflowY:"auto"}}>
        {NAV.map(n=>{
          const on = view===n.id;
          return(
            <button key={n.id} onClick={()=>go(n.id)} style={{
              width:"100%",display:"flex",alignItems:"center",gap:10,
              padding:"11px 20px",background:on?C.goldBg:"transparent",
              border:"none",borderLeft:`2px solid ${on?C.gold:"transparent"}`,
              color:on?C.gold:C.dim,fontSize:11,letterSpacing:"0.05em",
              fontWeight:on?600:400,cursor:"pointer",fontFamily:"inherit",
              transition:"all 0.15s",textAlign:"left"}}>
              <span style={{fontSize:13}}>{n.icon}</span>{n.label}
            </button>
          );
        })}
      </nav>
      <div style={{padding:"14px 20px",borderTop:`1px solid ${C.brd}`}}>
        <div style={{fontSize:8,letterSpacing:"0.25em",color:C.dim,marginBottom:10,fontWeight:600}}>SOCIOS</div>
        {[[settings.partnerA,C.gold],[settings.partnerB,C.sub]].map(([name,color])=>(
          <div key={name} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <div style={{width:24,height:24,borderRadius:"50%",border:`1px solid ${color}55`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:9,color,fontWeight:700,flexShrink:0}}>{(name||"?")[0]}</div>
            <span style={{fontSize:10.5,color:C.sub}}>{name}</span>
          </div>
        ))}
        <div style={{marginTop:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:8,color:syncError?C.err:C.dim}}>
            {syncError ? "Error al sincronizar" : syncing ? "Guardando…" : lastSync ? `Sync ${lastSync.toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"})}` : "Sin sincronizar"}
          </span>
          <button onClick={onRefresh} title="Actualizar datos compartidos" style={{
            background:"transparent",border:"none",color:C.gold,cursor:"pointer",
            fontSize:12,fontFamily:"inherit",padding:2}}>⟲</button>
        </div>
      </div>
    </aside>
  );
}

// ── ROOT ────────────────────────────────────────────────────────────────────
export default function App(){
  const [store,setStore] = useState(null);
  const [view,setView] = useState("dash");
  const [sim,setSim] = useState({sale:0,cost:0,splitE:65});
  const [syncing,setSyncing] = useState(false);
  const [syncError,setSyncError] = useState(false);
  const [lastSync,setLastSync] = useState(null);
  const saveTimer = useRef(null);

  useEffect(()=>{
    (async ()=>{
      const data = await loadStore();
      setStore(data);
      setSim(s=>({...s, splitE:data.settings.splitDefault}));
    })();
  },[]);

  useEffect(()=>{
    if(!store) return;
    if(saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async ()=>{
      setSyncing(true);
      const ok = await saveStore(store);
      setSyncing(false);
      setSyncError(!ok);
      if(ok) setLastSync(new Date());
    }, 700);
    return ()=>clearTimeout(saveTimer.current);
  },[store]);

  useEffect(()=>{
    const id = setInterval(async ()=>{
      const tag = document.activeElement && document.activeElement.tagName;
      if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT") return;
      try{
        const { data: remoteData } = await supabase.from('store').select('data').eq('key', STORE_KEY).single();
        if(remoteData && remoteData.data){
          const remote = JSON.parse(remoteData.data);
          setStore(prev=>{
            if(!prev) return prev;
            if(JSON.stringify(remote)!==JSON.stringify(prev)){
              setLastSync(new Date());
              return remote;
            }
            return prev;
          });
        }
      }catch(e){ /* ignore polling errors */ }
    }, 25000);
    return ()=>clearInterval(id);
  },[]);

  const manualRefresh = async () => {
    setSyncing(true);
    try{
      const data = await loadStore();
      setStore(data);
      setLastSync(new Date());
      setSyncError(false);
    }catch(e){ setSyncError(true); }
    setSyncing(false);
  };

  if(!store) return <LoadingScreen/>;

  const setSettings = updater => setStore(prev=>({...prev, settings: typeof updater==="function"?updater(prev.settings):updater}));
  const setInventory = updater => setStore(prev=>({...prev, inventory: typeof updater==="function"?updater(prev.inventory):updater}));
  const setSales = updater => setStore(prev=>({...prev, sales: typeof updater==="function"?updater(prev.sales):updater}));
  const setQuotes = updater => setStore(prev=>({...prev, quotes: typeof updater==="function"?updater(prev.quotes):updater}));
  const setSettlements = updater => setStore(prev=>({...prev, settlements: typeof updater==="function"?updater(prev.settlements||[]):updater}));
  const setImp = updater => setStore(prev=>({...prev, imp: typeof updater==="function"?updater(prev.imp):updater}));

  const sellDecant = (itemId, mlRaw, priceRaw, client) => {
    const ml = parseFloat(mlRaw)||0;
    const price = parseFloat(priceRaw)||0;
    if(ml<=0 || price<=0) return false;
    const item = store.inventory.find(i=>i.id===itemId);
    if(!item || ml>item.decantMl) return false;
    const costPerMl = item.ml>0 ? item.cost/item.ml : 0;
    const costPortion = +(costPerMl*ml).toFixed(2);
    const newSale = {
      id: Date.now(), client: client && client.trim() ? client.trim() : "Venta de decant",
      product: `${item.name} ${ml}ml (Decant)`, amount: price, status:"paid",
      date: todayLabel(), kind:"decant", itemId, ml, cost: costPortion,
      splitE: item.splitE, paidToSocio:false, paidDate:null, settlementId:null,
    };
    setStore(prev=>({
      ...prev,
      inventory: prev.inventory.map(i=>i.id===itemId
        ? {...i, decantMl:+(i.decantMl-ml).toFixed(2), decantSold:+((i.decantSold||0)+ml).toFixed(2)}
        : i),
      sales: [newSale, ...prev.sales],
    }));
    return true;
  };

  return(
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        body{overflow:hidden;}
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;}
        input[type=number]{-moz-appearance:textfield;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:#0F0F12;}
        ::-webkit-scrollbar-thumb{background:#28282E;border-radius:2px;}
        button:focus{outline:none;}
        select{cursor:pointer;}
      `}</style>
      <div style={{display:"flex",height:"100vh",overflow:"hidden",
        background:C.bg,color:C.text,
        fontFamily:"Inter,'Helvetica Neue',-apple-system,system-ui,sans-serif"}}>
        <Sidebar view={view} go={setView} settings={store.settings}
          syncing={syncing} syncError={syncError} lastSync={lastSync} onRefresh={manualRefresh}/>
        <main style={{flex:1,overflow:"hidden"}}>
          {view==="dash" && <DashView sim={sim} setSim={setSim} inventory={store.inventory}
            sales={store.sales} setSales={setSales} settings={store.settings} setSettings={setSettings}/>}
          {view==="import" && <ImportView imp={store.imp} setImp={setImp} settings={store.settings}/>}
          {view==="inventory" && <InventoryView inventory={store.inventory} setInventory={setInventory}
            settings={store.settings} sellDecant={sellDecant}/>}
          {view==="quotes" && <QuotesView inventory={store.inventory} quotes={store.quotes}
            setQuotes={setQuotes} settings={store.settings}/>}
          {view==="payments" && <PaymentsView sales={store.sales} setSales={setSales} settlements={store.settlements||[]} setSettlements={setSettlements} settings={store.settings}/>}
          {view==="profits" && <ProfView settings={store.settings} setSettings={setSettings}/>}
          {view==="settings" && <SettingsView settings={store.settings} setSettings={setSettings}/>}
        </main>
      </div>
    </>
  );
}