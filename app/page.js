"use client";
import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

function Card({children,className=""}){return <div className={`card ${className}`}>{children}</div>}
function Btn({children,variant="",...props}){return <button className={`btn ${variant}`} {...props}>{children}</button>}
function Input(props){return <input className="input" {...props} />}
function Textarea(props){return <textarea className="input textarea" {...props} />}
function Modal({open,title,onClose,children}){if(!open)return null; return <div className="overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modalHead"><h2>{title}</h2><button className="closeBtn" onClick={onClose}>✕</button></div><div className="modalBody">{children}</div></div></div>}
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

  const [newPart,setNewPart]=useState({name:"",part_number:"",category:"",stock:0,min_stock:0,location:"",supplier:"",image_url:"",notes:""});
  const [newMachine,setNewMachine]=useState({machine_code:"",name:"",model:"",site:"",status:"Active",notes:""});
  const [issueForm,setIssueForm]=useState({user_name:"",machine_id:"",part_id:"",qty:1,reference:"",notes:"",log_date:new Date().toISOString().slice(0,10)});
  const [stockForm,setStockForm]=useState({part_id:"",qty:1,reference:"",notes:""});
  const [stockFile,setStockFile]=useState(null); const [stockPreview,setStockPreview]=useState("");
  const isAdmin=profile?.role==="admin";

  useEffect(()=>{if(!supabase){setLoading(false); return;} supabase.auth.getSession().then(({data})=>setSession(data.session)); supabase.auth.onAuthStateChange((_,s)=>setSession(s));},[]);
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
      supabase.from("stock_movements").select("*, part:parts(id,name,part_number,image_url)").order("created_at",{ascending:false}),
    ]);
    if(a.error) setMsg(err(a.error)); if(b.error) setMsg(err(b.error)); if(c.error) setMsg(err(c.error)); if(d.error) setMsg(err(d.error)); if(e.error&&e.error.code!=="PGRST205") setMsg(err(e.error));
    setProfile(a.data||null); setParts(b.data||[]); setMachines(c.data||[]); setUsageLogs(d.data||[]); setStockMovements(e.data||[]);
    setIssueForm(prev=>({...prev,user_name:a.data?.full_name||session.user.email||""}));
    setLoading(false);
  }

  const filteredParts=useMemo(()=>{const q=search.toLowerCase().trim(); return parts.filter(p=>!q||[p.name,p.part_number,p.category,p.location].some(v=>(v||"\"").toLowerCase().includes(q)));},[parts,search]);
  const lowStock=useMemo(()=>parts.filter(p=>Number(p.stock)<=Number(p.min_stock)),[parts]);
  const totalUnits=useMemo(()=>parts.reduce((s,p)=>s+Number(p.stock||0),0),[parts]);
  const totalIssued=useMemo(()=>usageLogs.reduce((s,p)=>s+Number(p.qty||0),0),[usageLogs]);
  const totalIn=useMemo(()=>stockMovements.reduce((s,p)=>s+Number(p.qty||0),0),[stockMovements]);

  async function authSubmit(e){
    e.preventDefault(); if(!supabase) return; setSaving(true); setMsg("");
    if(authMode==="signup"){ const {error}=await supabase.auth.signUp({email:authForm.email,password:authForm.password,options:{data:{full_name:authForm.fullName}}}); setMsg(error?err(error):"Account created! Check your email."); }
    else { const {error}=await supabase.auth.signInWithPassword({email:authForm.email,password:authForm.password}); if(error) setMsg(err(error));}
    setSaving(false);
  }

  async function addPart(){ if(!supabase||!session?.user||!isAdmin) return; setSaving(true); const {error}=await supabase.from("parts").insert({...newPart,stock:Number(newPart.stock),min_stock:Number(newPart.min_stock)}); setMsg(error?err(error):"Part added!"); setPartOpen(false); setNewPart({name:"",part_number:"",category:"",stock:0,min_stock:0,location:"",supplier:"",image_url:"",notes:""}); loadAll(); setSaving(false); }
  async function addMachine(){ if(!supabase||!session?.user||!isAdmin) return; setSaving(true); const {error}=await supabase.from("machines").insert({...newMachine,created_by:session.user.id}); setSaving(false); setMsg(error?err(error):"Machine added!"); setMachineOpen(false); setNewMachine({machine_code:"",name:"",model:"",site:"",status:"Active",notes:""}); loadAll(); }
  async function issuePart(){ if(!supabase||!session?.user) return; setSaving(true); const {error}=await supabase.rpc("issue_part",{p_user_id:session.user.id,p_user_name:issueForm.user_name,p_machine_id:issueForm.machine_id,p_part_id:issueForm.part_id,p_qty:issueForm.qty,p_reference:issueForm.reference,p_notes:issueForm.notes,p_log_date:issueForm.log_date}); setSaving(false); setMsg(error?err(error):"Part issued!"); setIssueOpen(false); loadAll(); }

  async function uploadPhoto(file){ if(!supabase||!session?.user||!file) return null; const ext=(file.name.split(".").pop()||"jpg"); const path=`${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`; const {error}=await supabase.storage.from("part_photos").upload(path,file); if(error) return null; const {data}=supabase.storage.from("part_photos").getPublicUrl(path); return data.publicUrl; }
  async function stockInPart(){ if(!supabase||!session?.user) return; if(!stockForm.part_id) return setMsg("Choose a part."); if(!stockFile) return setMsg("A part photo is required for stock in."); setSaving(true); const photoUrl=await uploadPhoto(stockFile); const {error}=await supabase.from("stock_movements").insert({part_id:stockForm.part_id,qty:stockForm.qty,reference:stockForm.reference,notes:stockForm.notes,recorded_by:session.user.id,photo_url:photoUrl}); setSaving(false); setMsg(error?err(error):"Stock in recorded!"); setStockOpen(false); setStockForm({part_id:"",qty:1,reference:"",notes:""}); chooseStockFile(null); loadAll(); }
  function chooseStockFile(file){ setStockFile(file||null); setStockPreview(file?URL.createObjectURL(file):"");}

  async function adjust(part,amount){ if(!supabase||!isAdmin) return; const next=Math.max(0,Number(part.stock||0)+amount); const {error}=await supabase.from("parts").update({stock:next}).eq("id",part.id); if(error) setMsg(err(error)); else loadAll(); }
  async function del(table,id){ if(!supabase||!isAdmin) return; if(!window.confirm("Delete this item?")) return; const {error}=await supabase.from(table).delete().eq("id",id); if(error) return setMsg(err(error)); loadAll(); }

  if(!supabase) return <main className="shell"><Card><h2>Supabase setup needed</h2><p>Add your environment variables and redeploy.</p></Card></main>;

  if(!session){
    return <main className="auth"><Card className="hero"><div className="heroHead"><img src="/albion-logo.png" className="logo" alt="logo"/><div><h1>Albion Engineering Inventory</h1><p>Live stock, tracking, and usage logs.</p></div></div><div className="form"><h2>{authMode==="signin"?"Sign In":"Create Account"}</h2><Input type="email" placeholder="Email" value={authForm.email} onChange={e=>setAuthForm({...authForm,email:e.target.value})} /><Input type="password" placeholder="Password" value={authForm.password} onChange={e=>setAuthForm({...authForm,password:e.target.value})} />{authMode==="signup"&&<Input placeholder="Full Name" value={authForm.fullName} onChange={e=>setAuthForm({...authForm,fullName:e.target.value})} />}<Btn variant="primary" onClick={authSubmit} disabled={saving}>{saving?"...":authMode==="signin"?"Sign In":"Create Account"}</Btn><button type="button" className="link" onClick={()=>{setAuthMode(authMode==="signin"?"signup":"signin"); setMsg("");}}>{authMode==="signin"?"Need an account?":"Already have an account?"}</button>{msg&&<div className="notice">{msg}</div>}</div></Card></main>;
  }

  return <main className="page">
    <section className="topbar"><div className="heroHead"><img src="/albion-logo.png" className="logo" alt="logo"/><div><h1>Albion Engineering Inventory</h1><p>Signed in as <strong>{profile?.full_name||session.user.email}</strong></p></div></div><Btn onClick={()=>supabase.auth.signOut()}>Sign Out</Btn></section>
    {msg&&<div className="notice">{msg}</div>}
    <section className="stats">{[
      ["Parts",parts.length],["Units in stock",totalUnits],["Machines",machines.length],["Low stock",lowStock.length],["Issued",totalIssued],["Booked in",totalIn]
    ].map(([a,b])=><Card key={a}><div className="muted">{a}</div><div className="big">{b}</div></Card>)}</section>
    <section className="tabs">{["dashboard","parts","machines","usage","stockin"].map(t=><button key={t} className={`tab ${tab===t?"active":""}`} onClick={()=>setTab(t)}>{t==="stockin"?"Stock In":t[0].toUpperCase()+t.slice(1)}</button>)}</section>

    {tab==="dashboard"&&<div className="grid2"><Card><h3>Low stock parts</h3><div className="stack">{lowStock.length?lowStock.map(p=><div key={p.id} className="item"><div><div className="strong">{p.name}</div><div className="muted">{p.stock} / {p.min_stock}</div></div><div className="actions"><Btn variant="small" onClick={()=>adjust(p,5)}>+5</Btn><Btn variant="small danger" onClick={()=>adjust(p,-1)}>-1</Btn></div></div>):<p className="muted">All parts well stocked!</p>}</div></Card><Card><h3>Recent activity</h3><div className="stack">{usageLogs.slice(0,5).map(l=><div key={l.id} className="item"><div><div className="strong">{l.part?.name}</div><div className="muted">{new Date(l.log_date).toLocaleDateString()} - {l.user_name}</div></div><div>{l.qty} units</div></div>)}</div></Card></div>}

    {tab==="parts"&&<Card><div className="row spread"><div><h3>Parts</h3><div className="muted">Search by name, number, category, or location.</div></div><Btn variant="primary" onClick={()=>setPartOpen(!partOpen)} disabled={!isAdmin}>{isAdmin?"+ Add Part":"View Only"}</Btn></div><Input placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} /><div className="grid3">{filteredParts.map(p=><Card key={p.id}><div className="row spread"><div><h3>{p.name}</h3><div className="muted">{p.part_number}</div></div><div className="actions"><button onClick={()=>del("parts",p.id)} disabled={!isAdmin} className="link">×</button></div></div><div className="muted">{p.category} • {p.location}</div><div className="big" style={{color:Number(p.stock)<=Number(p.min_stock)?"#d32f2f":"#388e3c"}}>{p.stock} units</div><div className="muted">Min: {p.min_stock}</div><div className="muted small">{p.supplier}</div>{isAdmin&&<div className="row"><Btn variant="small" onClick={()=>adjust(p,-1)}>-1</Btn><Btn variant="small" onClick={()=>adjust(p,1)}>+1</Btn></div>}</Card>)}</div></Card>}

    {tab==="machines"&&<div className="grid3">{machines.map(m=><Card key={m.id}><div className="row spread"><div><h3>{m.name}</h3><div className="muted">{m.machine_code} • {m.model}</div></div><div><button onClick={()=>del("machines",m.id)} disabled={!isAdmin} className="link">×</button></div></div><div className="muted">{m.site}</div><div><span className="badge">{m.status}</span></div><p>{m.notes}</p></Card>)}<Card onClick={()=>setMachineOpen(!machineOpen)} className="addCard" style={{cursor:isAdmin?"pointer":"default"}}><div style={{fontSize:"2em"}}>+</div><div>Add Machine</div></Card></div>}

    {tab==="usage"&&<Card><h3>Usage log</h3><div className="tableWrap"><table><thead><tr><th>Date</th><th>User</th><th>Part</th><th>Machine</th><th>Qty</th><th>Reference</th><th>Notes</th>{isAdmin&&<th>Action</th>}</tr></thead><tbody>{usageLogs.map(l=><tr key={l.id}><td>{new Date(l.log_date).toLocaleDateString()}</td><td>{l.user_name}</td><td>{l.part?.name} ({l.part?.part_number})</td><td>{l.machine?.name} ({l.machine?.machine_code})</td><td>{l.qty}</td><td>{l.reference}</td><td>{l.notes}</td>{isAdmin&&<td><button onClick={()=>del("usage_logs",l.id)} className="link">Delete</button></td>}</tr>)}</tbody></table></div><Btn variant="primary" onClick={()=>setIssueOpen(true)}>+ Issue Part</Btn></Card>}

    {tab==="stockin"&&<Card><div className="row spread"><div><h3>Stock In History</h3><div className="muted">Photo is required every time stock is received.</div></div><Btn variant="primary" onClick={()=>setStockOpen(true)}>+ Stock In</Btn></div><div className="tableWrap"><table><thead><tr><th>Date</th><th>Part</th><th>Qty</th><th>Reference</th><th>By</th><th>Notes</th></tr></thead><tbody>{stockMovements.map(m=><tr key={m.id}><td>{new Date(m.created_at).toLocaleDateString()}</td><td>{m.part?.name} ({m.part?.part_number})</td><td>{m.qty}</td><td>{m.reference}</td><td>{m.recorded_by}</td><td>{m.notes}</td></tr>)}</tbody></table></div></Card>}

    <Modal open={partOpen} onClose={()=>setPartOpen(false)} title="Add Part"><div className="form">{["name","part_number","category","location","supplier"].map(k=><div key={k}><label>{k.replace(/_/g," ")}</label><Input value={newPart[k]} onChange={e=>setNewPart({...newPart,[k]:e.target.value})} placeholder={k} /></div>)}<div><label>Stock</label><Input type="number" value={newPart.stock} onChange={e=>setNewPart({...newPart,stock:e.target.value})} /></div><div><label>Min stock</label><Input type="number" value={newPart.min_stock} onChange={e=>setNewPart({...newPart,min_stock:e.target.value})} /></div><div><label>Notes</label><Textarea value={newPart.notes} onChange={e=>setNewPart({...newPart,notes:e.target.value})} /></div><Btn variant="primary" onClick={addPart} disabled={saving}>{saving?"...":"Add Part"}</Btn></div></Modal>
    <Modal open={machineOpen} onClose={()=>setMachineOpen(false)} title="Add Machine"><div className="form"><div><label>Machine code</label><Input value={newMachine.machine_code} onChange={e=>setNewMachine({...newMachine,machine_code:e.target.value})} /></div><div><label>Name</label><Input value={newMachine.name} onChange={e=>setNewMachine({...newMachine,name:e.target.value})} /></div><div><label>Model</label><Input value={newMachine.model} onChange={e=>setNewMachine({...newMachine,model:e.target.value})} /></div><div><label>Site</label><Input value={newMachine.site} onChange={e=>setNewMachine({...newMachine,site:e.target.value})} /></div><div><label>Status</label><select className="input" value={newMachine.status} onChange={e=>setNewMachine({...newMachine,status:e.target.value})}><option>Active</option><option>Inactive</option><option>Maintenance</option></select></div><div><label>Notes</label><Textarea value={newMachine.notes} onChange={e=>setNewMachine({...newMachine,notes:e.target.value})} /></div><Btn variant="primary" onClick={addMachine} disabled={saving}>{saving?"...":"Add Machine"}</Btn></div></Modal>
    <Modal open={issueOpen} onClose={()=>setIssueOpen(false)} title="Issue Part"><div className="form"><div><label>Date</label><Input type="date" value={issueForm.log_date} onChange={e=>setIssueForm({...issueForm,log_date:e.target.value})} /></div><div><label>User name</label><Input value={issueForm.user_name} onChange={e=>setIssueForm({...issueForm,user_name:e.target.value})} /></div><div><label>Part</label><select className="input" value={issueForm.part_id} onChange={e=>setIssueForm({...issueForm,part_id:e.target.value})}><option value="">Choose a part</option>{parts.map(p=><option key={p.id} value={p.id}>{p.name} ({p.part_number}) - {p.stock} available</option>)}</select></div><div><label>Machine</label><select className="input" value={issueForm.machine_id} onChange={e=>setIssueForm({...issueForm,machine_id:e.target.value})}><option value="">Choose a machine</option>{machines.map(m=><option key={m.id} value={m.id}>{m.name} ({m.machine_code})</option>)}</select></div><div><label>Qty</label><Input type="number" value={issueForm.qty} onChange={e=>setIssueForm({...issueForm,qty:e.target.value})} min="1" /></div><div><label>Reference</label><Input value={issueForm.reference} onChange={e=>setIssueForm({...issueForm,reference:e.target.value})} placeholder="Work order, ticket, etc." /></div><div><label>Notes</label><Textarea value={issueForm.notes} onChange={e=>setIssueForm({...issueForm,notes:e.target.value})} /></div><Btn variant="primary" onClick={issuePart} disabled={saving}>{saving?"...":"Issue Part"}</Btn></div></Modal>
    <Modal open={stockOpen} onClose={()=>setStockOpen(false)} title="Stock In"><div className="form"><div><label>Part</label><select className="input" value={stockForm.part_id} onChange={e=>setStockForm({...stockForm,part_id:e.target.value})}><option value="">Choose a part</option>{parts.map(p=><option key={p.id} value={p.id}>{p.name} ({p.part_number})</option>)}</select></div><div><label>Quantity</label><Input type="number" value={stockForm.qty} onChange={e=>setStockForm({...stockForm,qty:e.target.value})} min="1" /></div><div><label>Reference</label><Input value={stockForm.reference} onChange={e=>setStockForm({...stockForm,reference:e.target.value})} placeholder="Invoice, PO, etc." /></div><div><label>Notes</label><Textarea value={stockForm.notes} onChange={e=>setStockForm({...stockForm,notes:e.target.value})} /></div><div><label>Photo</label><Input type="file" accept="image/*" onChange={e=>chooseStockFile(e.target.files?.[0])} />{stockPreview&&<img src={stockPreview} alt="preview" style={{maxWidth:"100%",marginTop:"10px"}} />}</div><Btn variant="primary" onClick={stockInPart} disabled={saving||!stockFile}>{saving?"...":"Stock In"}</Btn></div></Modal>
  </main>;
}