
"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

function Card({children,className=""}){return <div className={`card ${className}`}>{children}</div>}
function Btn({children,variant="",...props}){return <button className={`btn ${variant}`} {...props}>{children}</button>}
function Input(props){return <input className="input" {...props} />}
function Textarea(props){return <textarea className="input textarea" {...props} />}
function Modal({open,title,onClose,children}){if(!open)return null; return <div className="overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modalHead"><h3>{title}</h3><button className="x" onClick={onClose}>×</button></div>{children}</div></div>}
const err=(e)=> typeof e==="string"?e:(e?.message||"Something went wrong.");

export default function Page(){
  const [session,setSession]=useState(null);
  const [profile,setProfile]=useState(null);
  const [parts,setParts]=useState([]);
  const [machines,setMachines]=useState([]);
  const [usageLogs,setUsageLogs]=useState([]);
  const [stockMovements,setStockMovements]=useState([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState("");
  const [tab,setTab]=useState("dashboard");
  const [search,setSearch]=useState("");
  const [authMode,setAuthMode]=useState("signin");
  const [authForm,setAuthForm]=useState({email:"",password:"",fullName:""});
  const [partOpen,setPartOpen]=useState(false);
  const [machineOpen,setMachineOpen]=useState(false);
  const [issueOpen,setIssueOpen]=useState(false);
  const [stockOpen,setStockOpen]=useState(false);
  const [scanOpen,setScanOpen]=useState(false);
  const [barcodeSupported,setBarcodeSupported]=useState(false);
  const [scannerInput,setScannerInput]=useState("");
  const [scannerStatus,setScannerStatus]=useState("Ready");
  const videoRef=useRef(null); const streamRef=useRef(null); const timerRef=useRef(null);

  const [newPart,setNewPart]=useState({name:"",part_number:"",barcode:"",category:"",stock:0,min_stock:0,location:"",supplier:"",image_url:"",notes:""});
  const [newMachine,setNewMachine]=useState({machine_code:"",name:"",model:"",site:"",status:"Active",notes:""});
  const [issueForm,setIssueForm]=useState({user_name:"",machine_id:"",part_id:"",qty:1,reference:"",notes:"",log_date:new Date().toISOString().slice(0,10)});
  const [stockForm,setStockForm]=useState({part_id:"",qty:1,reference:"",notes:"",barcode_value:""});
  const [stockFile,setStockFile]=useState(null); const [stockPreview,setStockPreview]=useState("");
  const isAdmin=profile?.role==="admin";

  useEffect(()=>{if(typeof window!=="undefined") setBarcodeSupported("BarcodeDetector" in window); if(!supabase){setLoading(false); return;} supabase.auth.getSession().then(({data})=>setSession(data.session??null)); const {data}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s??null)); return ()=>{data.subscription.unsubscribe(); stopScanner();};},[]);
  useEffect(()=>{if(!session?.user||!supabase){setLoading(false); setProfile(null); setParts([]); setMachines([]); setUsageLogs([]); setStockMovements([]); return;} loadAll();},[session?.user?.id]);

  async function loadAll(){
    if(!supabase||!session?.user) return;
    setLoading(true); setMsg("");
    const uid=session.user.id;
    const [a,b,c,d,e]=await Promise.all([
      supabase.from("profiles").select("*").eq("id",uid).single(),
      supabase.from("parts").select("*").order("name"),
      supabase.from("machines").select("*").order("name"),
      supabase.from("usage_logs").select("*, part:parts(id,name,part_number,image_url), machine:machines(id,name,machine_code)").order("log_date",{ascending:false}).order("created_at",{ascending:false}),
      supabase.from("stock_movements").select("*, part:parts(id,name,part_number,image_url,barcode)").order("created_at",{ascending:false}),
    ]);
    if(a.error) setMsg(err(a.error)); if(b.error) setMsg(err(b.error)); if(c.error) setMsg(err(c.error)); if(d.error) setMsg(err(d.error)); if(e.error&&e.error.code!=="PGRST205") setMsg(err(e.error));
    setProfile(a.data||null); setParts(b.data||[]); setMachines(c.data||[]); setUsageLogs(d.data||[]); setStockMovements(e.data||[]);
    setIssueForm(prev=>({...prev,user_name:a.data?.full_name||session.user.email||""}));
    setLoading(false);
  }

  const filteredParts=useMemo(()=>{const q=search.toLowerCase().trim(); return parts.filter(p=>!q||[p.name,p.part_number,p.barcode,p.category,p.location].some(v=>(v||"").toLowerCase().includes(q)));},[parts,search]);
  const lowStock=useMemo(()=>parts.filter(p=>Number(p.stock)<=Number(p.min_stock)),[parts]);
  const totalUnits=useMemo(()=>parts.reduce((s,p)=>s+Number(p.stock||0),0),[parts]);
  const totalIssued=useMemo(()=>usageLogs.reduce((s,p)=>s+Number(p.qty||0),0),[usageLogs]);
  const totalIn=useMemo(()=>stockMovements.reduce((s,p)=>s+Number(p.qty||0),0),[stockMovements]);

  async function authSubmit(e){
    e.preventDefault(); if(!supabase) return; setSaving(true); setMsg("");
    if(authMode==="signup"){ const {error}=await supabase.auth.signUp({email:authForm.email,password:authForm.password,options:{data:{full_name:authForm.fullName}}}); setMsg(error?err(error):"Account created."); }
    else { const {error}=await supabase.auth.signInWithPassword({email:authForm.email,password:authForm.password}); if(error) setMsg(err(error));}
    setSaving(false);
  }

  async function addPart(){ if(!supabase||!session?.user||!isAdmin) return; setSaving(true); const {error}=await supabase.from("parts").insert({...newPart,stock:Number(newPart.stock),min_stock:Number(newPart.min_stock),created_by:session.user.id}); setSaving(false); if(error) return setMsg(err(error)); setPartOpen(false); setNewPart({name:"",part_number:"",barcode:"",category:"",stock:0,min_stock:0,location:"",supplier:"",image_url:"",notes:""}); loadAll(); }
  async function addMachine(){ if(!supabase||!session?.user||!isAdmin) return; setSaving(true); const {error}=await supabase.from("machines").insert({...newMachine,created_by:session.user.id}); setSaving(false); if(error) return setMsg(err(error)); setMachineOpen(false); setNewMachine({machine_code:"",name:"",model:"",site:"",status:"Active",notes:""}); loadAll(); }
  async function issuePart(){ if(!supabase||!session?.user) return; setSaving(true); const {error}=await supabase.rpc("issue_part",{p_user_id:session.user.id,p_user_name:issueForm.user_name,p_machine_id:issueForm.machine_id,p_part_id:issueForm.part_id,p_qty:Number(issueForm.qty),p_reference:issueForm.reference,p_notes:issueForm.notes,p_log_date:issueForm.log_date}); setSaving(false); if(error) return setMsg(err(error)); setIssueOpen(false); setIssueForm({user_name:profile?.full_name||session.user.email||"",machine_id:"",part_id:"",qty:1,reference:"",notes:"",log_date:new Date().toISOString().slice(0,10)}); loadAll(); }

  async function uploadPhoto(file){ if(!supabase||!session?.user||!file) return null; const ext=(file.name.split(".").pop()||"jpg"); const path=`${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`; const {error}=await supabase.storage.from("part-photos").upload(path,file); if(error) throw error; const {data}=supabase.storage.from("part-photos").getPublicUrl(path); return data.publicUrl; }
  async function stockInPart(){ if(!supabase||!session?.user) return; if(!stockForm.part_id) return setMsg("Choose a part."); if(!stockFile) return setMsg("A part photo is required for stock in."); setSaving(true); setMsg(""); try{ const imageUrl=await uploadPhoto(stockFile); const {error}=await supabase.rpc("stock_in_part",{p_user_id:session.user.id,p_user_name:profile?.full_name||session.user.email||"",p_part_id:stockForm.part_id,p_qty:Number(stockForm.qty),p_reference:stockForm.reference,p_notes:stockForm.notes,p_image_url:imageUrl,p_barcode_value:stockForm.barcode_value}); if(error) throw error; setStockOpen(false); setStockForm({part_id:"",qty:1,reference:"",notes:"",barcode_value:""}); setStockFile(null); setStockPreview(""); await loadAll(); }catch(e){setMsg(err(e));} setSaving(false); }
  function chooseStockFile(file){ setStockFile(file||null); setStockPreview(file?URL.createObjectURL(file):"");}
  function applyBarcode(v){ const value=String(v||"").trim(); if(!value) return; setScannerInput(value); const part=parts.find(p=>p.barcode===value||p.part_number===value); setStockForm(prev=>({...prev,barcode_value:value,part_id:part?.id||prev.part_id})); setScannerStatus(part?`Matched: ${part.name}`:"Barcode saved. No matching part found."); }
  async function startScanner(){ if(!barcodeSupported) return setScannerStatus("Camera scanning not supported here. Use typed barcode or scanner gun."); try{ const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}}); streamRef.current=stream; if(videoRef.current){videoRef.current.srcObject=stream; await videoRef.current.play();} const detector=new window.BarcodeDetector({formats:["code_128","ean_13","ean_8","upc_a","upc_e","qr_code"]}); setScannerStatus("Camera started."); timerRef.current=window.setInterval(async()=>{ try{ const found=await detector.detect(videoRef.current); if(found?.length){ applyBarcode(found[0].rawValue); stopScanner(); }}catch{} },800);}catch(e){setScannerStatus(`Camera error: ${err(e)}`);} }
  function stopScanner(){ if(timerRef.current){clearInterval(timerRef.current); timerRef.current=null;} if(streamRef.current){streamRef.current.getTracks().forEach(t=>t.stop()); streamRef.current=null;} if(videoRef.current) videoRef.current.srcObject=null; }

  async function adjust(part,amount){ if(!supabase||!isAdmin) return; const next=Math.max(0,Number(part.stock||0)+amount); const {error}=await supabase.from("parts").update({stock:next}).eq("id",part.id); if(error) return setMsg(err(error)); loadAll(); }
  async function del(table,id){ if(!supabase||!isAdmin) return; if(!window.confirm("Delete this item?")) return; const {error}=await supabase.from(table).delete().eq("id",id); if(error) return setMsg(err(error)); loadAll(); }

  if(!supabase) return <main className="shell"><Card><h2>Supabase setup needed</h2><p>Add your environment variables and redeploy.</p></Card></main>;

  if(!session){
    return <main className="auth"><Card className="hero"><div className="heroHead"><img src="/albion-logo.png" className="logo" alt="logo"/><div><h1>Albion Engineering Inventory</h1><p>Live stock, barcode scans, and photo-required stock in.</p></div></div></Card><Card><h2>{authMode==="signin"?"Sign in":"Create account"}</h2><form onSubmit={authSubmit} className="stack">{authMode==="signup"&&<div><label>Full name</label><Input value={authForm.fullName} onChange={e=>setAuthForm({...authForm,fullName:e.target.value})}/></div>}<div><label>Email</label><Input type="email" value={authForm.email} onChange={e=>setAuthForm({...authForm,email:e.target.value})}/></div><div><label>Password</label><Input type="password" value={authForm.password} onChange={e=>setAuthForm({...authForm,password:e.target.value})}/></div>{msg&&<div className="notice">{msg}</div>}<Btn disabled={saving}>{saving?"Please wait...":authMode==="signin"?"Sign in":"Create account"}</Btn><Btn type="button" variant="ghost" onClick={()=>setAuthMode(authMode==="signin"?"signup":"signin")}>{authMode==="signin"?"Need an account? Sign up":"Already have an account? Sign in"}</Btn></form></Card></main>;
  }

  return <main className="page">
    <section className="topbar"><div className="heroHead"><img src="/albion-logo.png" className="logo" alt="logo"/><div><h1>Albion Engineering Inventory</h1><p>Signed in as <strong>{profile?.full_name||session.user.email}</strong>{profile?.role?` • ${profile.role}`:""}</p></div></div><div className="actions"><Btn variant="outline" onClick={loadAll}>Refresh</Btn><Btn onClick={()=>setScanOpen(true)}>Scan Barcode</Btn><Btn onClick={()=>setStockOpen(true)}>Stock In</Btn><Btn onClick={()=>setIssueOpen(true)}>Issue Part</Btn>{isAdmin&&<Btn onClick={()=>setPartOpen(true)}>Add Part</Btn>}{isAdmin&&<Btn variant="outline" onClick={()=>setMachineOpen(true)}>Add Machine</Btn>}<Btn variant="ghost" onClick={()=>supabase.auth.signOut()}>Sign out</Btn></div></section>
    {msg&&<div className="notice">{msg}</div>}
    <section className="stats">{[
      ["Parts",parts.length],["Units in stock",totalUnits],["Machines",machines.length],["Low stock",lowStock.length],["Issued",totalIssued],["Booked in",totalIn]
    ].map(([a,b])=><Card key={a}><div className="muted">{a}</div><div className="big">{b}</div></Card>)}</section>
    <section className="tabs">{["dashboard","parts","machines","usage","stockin"].map(t=><button key={t} className={`tab ${tab===t?"active":""}`} onClick={()=>setTab(t)}>{t==="stockin"?"Stock In":t[0].toUpperCase()+t.slice(1)}</button>)}</section>

    {tab==="dashboard"&&<div className="grid2"><Card><h3>Low stock parts</h3><div className="stack">{lowStock.length?lowStock.map(p=><div key={p.id} className="item"><div><div className="strong">{p.name}</div><div className="muted">{p.part_number}</div></div><div className="pill">Stock {p.stock} / Min {p.min_stock}</div></div>):<p>No low-stock items.</p>}</div></Card><Card><h3>Recent stock in</h3><div className="grid2 smallGrid">{stockMovements.slice(0,6).map(m=><div key={m.id} className="stockCard"><div className="thumb">{m.image_url&&<img src={m.image_url} alt=""/>}</div><div className="strong">{m.part?.name||"Unknown part"}</div><div className="muted">+{m.qty}</div></div>)}</div>{!stockMovements.length&&<p>No stock-in history yet.</p>}</Card></div>}

    {tab==="parts"&&<Card><div className="row spread"><div><h3>Parts</h3><div className="muted">Search by name, number, barcode, category, or location.</div></div><Input placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="tableWrap"><table><thead><tr><th>Part</th><th>Category</th><th>Barcode</th><th>Stock</th><th>Min</th><th>Location</th><th>Actions</th></tr></thead><tbody>{filteredParts.map(p=><tr key={p.id}><td><div className="row"><div className="thumb tiny">{p.image_url&&<img src={p.image_url} alt=""/>}</div><div><div className="strong">{p.name}</div><div className="muted">{p.part_number}</div></div></div></td><td>{p.category}</td><td>{p.barcode||"—"}</td><td>{p.stock}</td><td>{p.min_stock}</td><td>{p.location}</td><td className="row">{isAdmin&&<Btn variant="outline" onClick={()=>adjust(p,1)}>+1</Btn>}{isAdmin&&<Btn variant="outline" onClick={()=>adjust(p,-1)}>-1</Btn>}{isAdmin&&<Btn variant="outline" onClick={()=>del("parts",p.id)}>Delete</Btn>}</td></tr>)}</tbody></table></div></Card>}

    {tab==="machines"&&<div className="grid3">{machines.map(m=><Card key={m.id}><div className="row spread"><div><h3>{m.name}</h3><div className="muted">{m.machine_code} • {m.model}</div></div><div className="pill">{m.status}</div></div><div className="stack"><div><strong>Site:</strong> {m.site||"—"}</div><div><strong>Notes:</strong> {m.notes||"—"}</div>{isAdmin&&<Btn variant="outline" onClick={()=>del("machines",m.id)}>Delete machine</Btn>}</div></Card>)}</div>}

    {tab==="usage"&&<Card><h3>Usage log</h3><div className="tableWrap"><table><thead><tr><th>Date</th><th>User</th><th>Part</th><th>Machine</th><th>Qty</th><th>Reference</th><th>Notes</th>{isAdmin&&<th>Admin</th>}</tr></thead><tbody>{usageLogs.map(u=><tr key={u.id}><td>{u.log_date}</td><td>{u.user_name}</td><td>{u.part?.name||"Unknown"}</td><td>{u.machine?.name||"Unknown"}</td><td>{u.qty}</td><td>{u.reference||"—"}</td><td>{u.notes||"—"}</td>{isAdmin&&<td><Btn variant="outline" onClick={()=>del("usage_logs",u.id)}>Delete</Btn></td>}</tr>)}</tbody></table></div></Card>}

    {tab==="stockin"&&<Card><div className="row spread"><div><h3>Stock In History</h3><div className="muted">Photo is required every time stock is received.</div></div><Btn onClick={()=>setStockOpen(true)}>New Stock In</Btn></div><div className="grid3">{stockMovements.map(m=><div key={m.id} className="stockCard"><div className="thumb large">{m.image_url&&<img src={m.image_url} alt=""/>}</div><div className="strong">{m.part?.name||"Unknown part"}</div><div className="muted">{m.part?.part_number||""}</div><div className="pill">+{m.qty}</div><div className="muted">Barcode: {m.barcode_value||m.part?.barcode||"—"}</div></div>)}{!stockMovements.length&&<p>No stock-in history yet.</p>}</div></Card>}

    <Modal open={partOpen} onClose={()=>setPartOpen(false)} title="Add Part"><div className="form">{["name","part_number","barcode","category","location","supplier"].map(k=><div key={k}><label>{k.replaceAll("_"," ")}</label><Input value={newPart[k]} onChange={e=>setNewPart({...newPart,[k]:e.target.value})}/></div>)}<div><label>Current stock</label><Input type="number" value={newPart.stock} onChange={e=>setNewPart({...newPart,stock:e.target.value})}/></div><div><label>Minimum stock</label><Input type="number" value={newPart.min_stock} onChange={e=>setNewPart({...newPart,min_stock:e.target.value})}/></div><div className="full"><label>Notes</label><Textarea value={newPart.notes} onChange={e=>setNewPart({...newPart,notes:e.target.value})}/></div></div><div className="modalActions"><Btn onClick={addPart}>Save Part</Btn></div></Modal>
    <Modal open={machineOpen} onClose={()=>setMachineOpen(false)} title="Add Machine"><div className="form"><div><label>Machine code</label><Input value={newMachine.machine_code} onChange={e=>setNewMachine({...newMachine,machine_code:e.target.value})}/></div><div><label>Name</label><Input value={newMachine.name} onChange={e=>setNewMachine({...newMachine,name:e.target.value})}/></div><div><label>Model</label><Input value={newMachine.model} onChange={e=>setNewMachine({...newMachine,model:e.target.value})}/></div><div><label>Site</label><Input value={newMachine.site} onChange={e=>setNewMachine({...newMachine,site:e.target.value})}/></div><div><label>Status</label><select className="input" value={newMachine.status} onChange={e=>setNewMachine({...newMachine,status:e.target.value})}><option>Active</option><option>Maintenance</option><option>Offline</option></select></div><div className="full"><label>Notes</label><Textarea value={newMachine.notes} onChange={e=>setNewMachine({...newMachine,notes:e.target.value})}/></div></div><div className="modalActions"><Btn onClick={addMachine}>Save Machine</Btn></div></Modal>
    <Modal open={issueOpen} onClose={()=>setIssueOpen(false)} title="Issue Part"><div className="form"><div><label>Date</label><Input type="date" value={issueForm.log_date} onChange={e=>setIssueForm({...issueForm,log_date:e.target.value})}/></div><div><label>User</label><Input value={issueForm.user_name} onChange={e=>setIssueForm({...issueForm,user_name:e.target.value})}/></div><div><label>Machine</label><select className="input" value={issueForm.machine_id} onChange={e=>setIssueForm({...issueForm,machine_id:e.target.value})}><option value="">Select machine</option>{machines.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></div><div><label>Part</label><select className="input" value={issueForm.part_id} onChange={e=>setIssueForm({...issueForm,part_id:e.target.value})}><option value="">Select part</option>{parts.map(p=><option key={p.id} value={p.id}>{p.name} • Stock {p.stock}</option>)}</select></div><div><label>Quantity</label><Input type="number" min="1" value={issueForm.qty} onChange={e=>setIssueForm({...issueForm,qty:e.target.value})}/></div><div><label>Reference</label><Input value={issueForm.reference} onChange={e=>setIssueForm({...issueForm,reference:e.target.value})}/></div><div className="full"><label>Notes</label><Textarea value={issueForm.notes} onChange={e=>setIssueForm({...issueForm,notes:e.target.value})}/></div></div><div className="modalActions"><Btn onClick={issuePart}>Save Usage Log</Btn></div></Modal>
    <Modal open={stockOpen} onClose={()=>setStockOpen(false)} title="Stock In"><div className="form"><div><label>Part</label><select className="input" value={stockForm.part_id} onChange={e=>setStockForm({...stockForm,part_id:e.target.value})}><option value="">Select part</option>{parts.map(p=><option key={p.id} value={p.id}>{p.name} • {p.part_number}</option>)}</select></div><div><label>Barcode</label><div className="row"><Input value={stockForm.barcode_value} onChange={e=>setStockForm({...stockForm,barcode_value:e.target.value})}/><Btn type="button" variant="outline" onClick={()=>setScanOpen(true)}>Scan</Btn></div></div><div><label>Quantity</label><Input type="number" min="1" value={stockForm.qty} onChange={e=>setStockForm({...stockForm,qty:e.target.value})}/></div><div><label>Reference</label><Input value={stockForm.reference} onChange={e=>setStockForm({...stockForm,reference:e.target.value})}/></div><div className="full"><label>Notes</label><Textarea value={stockForm.notes} onChange={e=>setStockForm({...stockForm,notes:e.target.value})}/></div><div className="full"><label>Part photo (required)</label><Input type="file" accept="image/*" capture="environment" onChange={e=>chooseStockFile(e.target.files?.[0]||null)}/>{stockPreview&&<img src={stockPreview} className="preview" alt="preview"/>}</div></div><div className="modalActions"><Btn onClick={stockInPart}>Save Stock In</Btn></div></Modal>
    <Modal open={scanOpen} onClose={()=>{setScanOpen(false); stopScanner();}} title="Barcode Scanner"><div className="stack"><div className="muted">{scannerStatus}</div><div className="row"><Input value={scannerInput} onChange={e=>setScannerInput(e.target.value)} placeholder="Type or paste barcode"/><Btn type="button" variant="outline" onClick={()=>applyBarcode(scannerInput)}>Use</Btn></div><div className="camWrap"><video ref={videoRef} autoPlay muted playsInline className="cam"/></div><div className="row"><Btn type="button" onClick={startScanner}>Start Camera</Btn><Btn type="button" variant="outline" onClick={stopScanner}>Stop</Btn><Btn type="button" variant="outline" onClick={()=>{applyBarcode(scannerInput); setScanOpen(false); setStockOpen(true);}}>Use for Stock In</Btn></div>{!barcodeSupported&&<div className="muted">Manual or scanner-gun entry still works even if live camera scanning does not.</div>}</div></Modal>
  </main>;
}
