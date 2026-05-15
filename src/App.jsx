import { useState, useMemo, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "./firebase";

// ── Brand ────────────────────────────────────────────────────────────────────
const B = {
  teal:       '#265e61',
  tealDark:   '#1a3d3f',
  tealLight:  '#d4dddf',
  cream:      '#fffef8',
  creamDeep:  '#fef2c2',
  brown:      '#6c4d3a',
  brownLight: '#f5ede7',
  gold:       '#d2a12a',
  goldLight:  '#fef2c2',
  slate:      '#d4dddf',
  slateDark:  '#6c6d6d',
  grey:       '#6c6d6d',
  greyLight:  '#f0f1f0',
  white:      '#ffffff',
  // status
  dangerBg:   '#fde8e8', dangerText: '#b91c1c',
  successBg:  '#e4f5e9', successText:'#166534',
  warnBg:     '#fef2c2', warnText:   '#6c4d3a',
  infoBg:     '#d4dddf', infoText:   '#265e61',
};

// ── Constants ─────────────────────────────────────────────────────────────────
const CORRECT_PIN = '986532';
const today = new Date(); today.setHours(0,0,0,0);
const addDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const fmtDate = d => new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
const fmtINR  = n => '₹'+Number(n).toLocaleString('en-IN',{maximumFractionDigits:0});
const iso     = d => d.toISOString().split('T')[0];
const CATS = ['Raw Materials','Logistics','Services','Equipment','Utilities','Other'];

const SEED = [
  {id:1,vendor:'TechParts Ltd',     amount:145000,category:'Raw Materials',dueDate:iso(addDays(today,-5)), status:'pending',notes:'Invoice #2891'},
  {id:2,vendor:'SwiftCargo Co',     amount:32500, category:'Logistics',    dueDate:iso(addDays(today,-15)),status:'paid',   paidDate:iso(addDays(today,-16)),notes:''},
  {id:3,vendor:'PrintPro Services', amount:18000, category:'Services',     dueDate:iso(addDays(today,3)),  status:'pending',notes:'Monthly retainer'},
  {id:4,vendor:'PowerGrid Utilities',amount:22400,category:'Utilities',    dueDate:iso(addDays(today,10)), status:'pending',notes:''},
  {id:5,vendor:'MachineWorks India',amount:280000,category:'Equipment',    dueDate:iso(addDays(today,-2)), status:'pending',notes:'Partial delivery'},
  {id:6,vendor:'PackagingHub',      amount:55000, category:'Raw Materials',dueDate:iso(addDays(today,20)), status:'pending',notes:'INV-0042'},
  {id:7,vendor:'LegalEdge Assoc.',  amount:45000, category:'Services',     dueDate:iso(addDays(today,-20)),status:'paid',   paidDate:iso(addDays(today,-18)),notes:''},
];

const computeStatus = p => {
  if (p.status==='paid') return 'paid';
  const due = new Date(p.dueDate); due.setHours(0,0,0,0);
  if (due < today) return 'overdue';
  if ((due-today)/86400000 <= 7) return 'due-soon';
  return 'pending';
};

const STATUS = {
  paid:      {label:'Paid',     bg:B.successBg, text:B.successText, dot:'#166534'},
  overdue:   {label:'Overdue',  bg:B.dangerBg,  text:B.dangerText,  dot:'#b91c1c'},
  'due-soon':{label:'Due Soon', bg:B.warnBg,    text:B.warnText,    dot:B.gold},
  pending:   {label:'Pending',  bg:B.infoBg,    text:B.infoText,    dot:B.teal},
};
const PIE_FILL = {overdue:'#e05252','due-soon':B.gold,pending:B.teal,paid:'#3aab5e'};
const EMPTY = {vendor:'',amount:'',category:'Raw Materials',dueDate:'',notes:'',pdfLink:''};

// ── Shared tiny components ────────────────────────────────────────────────────
const Badge = ({cs}) => (
  <span style={{display:'inline-block',padding:'3px 10px',borderRadius:'20px',fontSize:'12px',fontWeight:600,letterSpacing:'0.01em',background:STATUS[cs].bg,color:STATUS[cs].text}}>
    {STATUS[cs].label}
  </span>
);

const Divider = () => <div style={{height:'0.5px',background:B.slate,margin:'0'}}/>;

// ── PIN Screen ────────────────────────────────────────────────────────────────
function PinScreen({onUnlock}) {
  const [pin,  setPin]  = useState('');
  const [shake,setShake]= useState(false);
  const [wrong,setWrong]= useState(false);

  const press = k => {
    if (pin.length >= 6) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 6) {
      if (next === CORRECT_PIN) {
        setTimeout(() => onUnlock(), 150);
      } else {
        setShake(true); setWrong(true);
        setTimeout(() => { setPin(''); setShake(false); setWrong(false); }, 750);
      }
    }
  };
  const erase = () => setPin(p => p.slice(0,-1));
  const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div style={{minHeight:'100vh',background:B.tealDark,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:'"Avenir LT Std", Avenir, sans-serif',padding:'2rem',userSelect:'none'}}>
      <style>{`
        @keyframes pinShake{0%,100%{transform:translateX(0)}15%{transform:translateX(-10px)}35%{transform:translateX(10px)}55%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
        @keyframes pinFadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .pin-wrap{animation:pinFadeIn 0.5s ease both}
        .pin-key:active{background:rgba(212,161,42,0.25)!important;transform:scale(0.95)}
      `}</style>

      <div className="pin-wrap" style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'0',width:'100%',maxWidth:'300px'}}>
        {/* Logo */}
        <img src="/logo.png" alt="Ingri" style={{height:'100px', objectFit:'contain', marginBottom:'0.5rem'}} />
        <div style={{fontSize:'13px',color:B.slateDark,marginBottom:'2.5rem',letterSpacing:'0.04em',textTransform:'uppercase'}}>Payment Tracker</div>

        {/* Dots */}
        <div style={{display:'flex',gap:'16px',marginBottom:'2.5rem',animation:shake?'pinShake 0.5s ease':'none'}}>
          {Array.from({length:6}).map((_,i) => (
            <div key={i} style={{width:'13px',height:'13px',borderRadius:'50%',transition:'all 0.18s',
              background: i<pin.length ? (wrong?'#e05252':B.gold) : 'rgba(255,255,255,0.15)',
              transform: i<pin.length?'scale(1.2)':'scale(1)'
            }}/>
          ))}
        </div>

        {/* Keypad */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px',width:'100%'}}>
          {KEYS.map((k,i) => k==='' ? <div key={i}/> : (
            <button key={i} className="pin-key"
              onClick={()=>k==='⌫'?erase():press(k)}
              style={{height:'66px',borderRadius:'16px',border:`0.5px solid rgba(212,161,42,0.2)`,
                background:k==='⌫'?'rgba(255,255,255,0.05)':'rgba(255,255,255,0.08)',
                color:B.cream,fontSize:k==='⌫'?'22px':'24px',fontWeight:400,
                cursor:'pointer',fontFamily:'"Moranga", serif',transition:'all 0.1s',
                WebkitTapHighlightColor:'transparent'
              }}>{k}</button>
          ))}
        </div>

        {wrong && <div style={{marginTop:'1.25rem',fontSize:'13px',color:'#f87171',letterSpacing:'0.02em'}}>Incorrect PIN — try again</div>}
      </div>
    </div>
  );
}

// ── App shell ─────────────────────────────────────────────────────────────────
export default function App() {
  const [authed, setAuthed] = useState(false);
  if (!authed) return <PinScreen onUnlock={()=>setAuthed(true)}/>;
  return <Tracker onLock={()=>setAuthed(false)}/>;
}

// ── Main Tracker ──────────────────────────────────────────────────────────────
function Tracker({onLock}) {
  const [payments, setPayments] = useState([]);
  
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "payments"), (snap) => {
      const data = [];
      snap.forEach((d) => data.push({ ...d.data(), id: d.id }));
      setPayments(data);
    });
    return () => unsub();
  }, []);
  const [tab,      setTab]      = useState('dashboard');
  const [filter,   setFilter]   = useState('all');
  const [search,   setSearch]   = useState('');
  const [sheet,    setSheet]    = useState(false);
  const [form,     setForm]     = useState(EMPTY);
  const [formErr,  setFormErr]  = useState('');

  const rich = useMemo(()=>payments.map(p=>({...p,cs:computeStatus(p)})),[payments]);

  const stats = useMemo(()=>{
    const by  = s => rich.filter(p=>p.cs===s);
    const sum = a => a.reduce((t,p)=>t+Number(p.amount),0);
    const now = new Date();
    const paidMo = by('paid').filter(p=>{
      const d=new Date(p.paidDate||p.dueDate);
      return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
    });
    return {
      outstanding: sum(rich.filter(p=>p.cs!=='paid')),
      overdueAmt:  sum(by('overdue')),
      dueSoonAmt:  sum(by('due-soon')),
      paidMoAmt:   sum(paidMo),
      overdueList: by('overdue'),
      dueSoonList: by('due-soon'),
      chart: ['overdue','due-soon','pending','paid']
        .map(s=>({name:STATUS[s].label,value:by(s).length,amount:sum(by(s)),fill:PIE_FILL[s]}))
        .filter(d=>d.value>0),
    };
  },[rich]);

  const rows = useMemo(()=>rich.filter(p=>{
    const mf = filter==='all' || p.cs===filter;
    const ms = !search || p.vendor.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase());
    return mf && ms;
  }),[rich,filter,search]);

  const markPaid = async id => {
    await updateDoc(doc(db, "payments", id), { status: 'paid', paidDate: iso(new Date()) });
  };
  const remove = async id => {
    await deleteDoc(doc(db, "payments", id));
  };

  const submit = async () => {
    if (!form.vendor.trim()||!form.amount||!form.dueDate){setFormErr('Please fill all required fields.');return;}
    await addDoc(collection(db, "payments"), { ...form, amount: Number(form.amount), status: 'pending' });
    setForm(EMPTY); setFormErr(''); setSheet(false); setTab('payments');
  };

  const exportCSV = () => {
    const hdr = ['Vendor','Amount','Category','Due Date','Status','Paid Date','Notes','Bill Link'];
    const data = rich.map(p=>[p.vendor,p.amount,p.category,p.dueDate,STATUS[p.cs].label,p.paidDate||'',p.notes||'',p.pdfLink||'']);
    const csv  = [hdr,...data].map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='ingri-payments.csv'; a.click();
  };

  const PieTip = ({active,payload}) => {
    if(!active||!payload?.length) return null;
    const d=payload[0].payload;
    return(
      <div style={{background:B.white,border:`1px solid ${B.slate}`,borderRadius:'10px',padding:'8px 12px',fontSize:'13px',color:B.brown,boxShadow:'0 4px 12px rgba(0,0,0,0.08)'}}>
        <div style={{fontWeight:600}}>{d.name}</div>
        <div style={{color:B.grey,marginTop:'2px'}}>{d.value} payments · {fmtINR(d.amount)}</div>
      </div>
    );
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  const cardStyle = {background:B.white,borderRadius:'24px',boxShadow:'0 8px 32px rgba(38,94,97,0.06)',border:'none',padding:'1.25rem',marginBottom:'16px'};
  const cardTitleStyle = {fontSize:'15px',fontWeight:700,color:B.teal,marginBottom:'12px',letterSpacing:'0.01em',fontFamily:'"Moranga", serif'};

  const inputStyle = {width:'100%',padding:'13px 14px',borderRadius:'16px',border:`1.5px solid ${B.slate}`,background:B.cream,color:B.brown,fontFamily:'"Avenir LT Std", Avenir, sans-serif',fontSize:'15px',boxSizing:'border-box',outline:'none'};
  const sheetInputStyle = {width:'100%',padding:'13px 14px',borderRadius:'16px',border:`1.5px solid rgba(255,255,255,0.2)`,background:'rgba(255,255,255,0.1)',color:B.cream,fontFamily:'"Avenir LT Std", Avenir, sans-serif',fontSize:'15px',boxSizing:'border-box',outline:'none'};
  const labelStyle = {fontSize:'12px',fontWeight:600,color:B.grey,display:'block',marginBottom:'6px',letterSpacing:'0.04em',textTransform:'uppercase'};
  const sheetLabelStyle = {...labelStyle, color:'rgba(255,254,248,0.6)'};

  const btnBase = {cursor:'pointer',fontFamily:'"Avenir LT Std", Avenir, sans-serif',WebkitTapHighlightColor:'transparent',transition:'opacity 0.1s'};
  const btnPrimary = {...btnBase,padding:'12px 18px',borderRadius:'12px',border:'none',background:B.teal,color:B.cream,fontSize:'14px',fontWeight:600};
  const btnOutline = {...btnBase,padding:'10px 14px',borderRadius:'10px',border:`1px solid ${B.slate}`,background:'transparent',color:B.brown,fontSize:'13px'};
  const btnDanger  = {...btnBase,padding:'10px 14px',borderRadius:'10px',border:`1px solid ${B.dangerText}`,background:'transparent',color:B.dangerText,fontSize:'13px'};

  // ── Reusable alert section ───────────────────────────────────────────────────
  const AlertSection = ({items,title,amtColor}) => items.length===0 ? null : (
    <div style={cardStyle}>
      <div style={cardTitleStyle}>{title}</div>
      {items.map((p,idx) => (
        <div key={p.id}>
          {idx>0 && <Divider/>}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0'}}>
            <div style={{flex:1,marginRight:'12px'}}>
              <div style={{fontSize:'14px',fontWeight:600,color:B.brown}}>{p.vendor}</div>
              <div style={{fontSize:'12px',color:B.grey,marginTop:'3px'}}>{p.category} · Due {fmtDate(p.dueDate)}</div>
            </div>
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'7px'}}>
              <span style={{fontSize:'15px',fontWeight:700,color:amtColor}}>{fmtINR(p.amount)}</span>
              <button style={{...btnBase,...btnOutline,fontSize:'12px',padding:'6px 12px'}} onClick={()=>markPaid(p.id)}>Mark paid</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{fontFamily:'"Avenir LT Std", Avenir, sans-serif',color:B.brown,minHeight:'100vh',background:B.cream,paddingBottom:'72px'}}>
      <style>{`
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        input::placeholder{color:${B.slateDark}}
        .sheet-input::placeholder{color:rgba(255,255,255,0.4)}
        .sheet-input::-webkit-calendar-picker-indicator{filter:invert(1);opacity:0.6;cursor:pointer}
        .sheet-input{color-scheme:dark}
        input:focus,select:focus{border-color:${B.teal}!important}
        .chip-active{background:${B.teal}!important;color:${B.cream}!important;border-color:${B.teal}!important}
        .pay-card:active{opacity:0.96}
        ::-webkit-scrollbar{display:none}
      `}</style>

      <div style={{maxWidth:'520px',margin:'0 auto'}}>

        {/* ── Header ── */}
        <div style={{padding:'1rem 1rem 0.75rem',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,background:B.tealDark,zIndex:10,borderBottom:`1px solid ${B.teal}`}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <img src="/logo.png" alt="Ingri" style={{height:'36px', objectFit:'contain'}} />
            <div>
              <div style={{fontSize:'10px',color:B.tealLight,letterSpacing:'0.06em',textTransform:'uppercase',lineHeight:1.4}}>Payment Tracker</div>
            </div>
          </div>
          <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
            <button style={{...btnBase,...btnOutline,borderColor:'rgba(255,255,255,0.2)',color:B.cream,fontSize:'12px',padding:'8px 12px'}} onClick={exportCSV}>Export CSV</button>
            <button title="Lock" onClick={onLock} style={{...btnBase,width:'36px',height:'36px',borderRadius:'10px',border:`1px solid rgba(255,255,255,0.2)`,background:'transparent',color:B.cream,fontSize:'16px',display:'flex',alignItems:'center',justifyContent:'center'}}>🔒</button>
          </div>
        </div>

        <div style={{padding:'1rem'}}>

          {/* ══ DASHBOARD ══ */}
          {tab==='dashboard' && <>

            {/* Metric cards */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'12px'}}>
              {[
                {label:'Outstanding', val:fmtINR(stats.outstanding), bg:B.tealLight,  textColor:B.tealDark, accent:B.teal},
                {label:'Overdue',     val:fmtINR(stats.overdueAmt),  bg:B.dangerBg,   textColor:B.dangerText, accent:'#c0392b'},
                {label:'Due this week',val:fmtINR(stats.dueSoonAmt), bg:B.goldLight,  textColor:'#7a4e10', accent:B.gold},
                {label:'Paid this month',val:fmtINR(stats.paidMoAmt),bg:B.successBg, textColor:B.successText, accent:'#2e7d32'},
              ].map(m=>(
                <div key={m.label} style={{background:m.bg,borderRadius:'16px',padding:'14px 12px',border:`1px solid rgba(0,0,0,0.04)`}}>
                  <div style={{fontSize:'11px',fontWeight:600,letterSpacing:'0.05em',textTransform:'uppercase',color:m.textColor,opacity:0.75,marginBottom:'7px'}}>{m.label}</div>
                  <div style={{fontSize:'18px',fontWeight:700,color:m.accent,lineHeight:1,fontFamily:'"Moranga", serif'}}>{m.val}</div>
                </div>
              ))}
            </div>

            {/* Pie chart */}
            {stats.chart.length>0 && (
              <div style={cardStyle}>
                <div style={cardTitleStyle}>Status overview</div>
                <div style={{display:'flex',alignItems:'center',gap:'0'}}>
                  <div style={{width:'140px',height:'140px',flexShrink:0}}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={stats.chart} cx="50%" cy="50%" innerRadius={38} outerRadius={62} dataKey="value" paddingAngle={3}>
                          {stats.chart.map((e,i)=><Cell key={i} fill={e.fill}/>)}
                        </Pie>
                        <Tooltip content={<PieTip/>}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{flex:1,paddingLeft:'16px',display:'flex',flexDirection:'column',gap:'10px'}}>
                    {stats.chart.map(d=>(
                      <div key={d.name} style={{display:'flex',alignItems:'center',gap:'8px'}}>
                        <div style={{width:'10px',height:'10px',borderRadius:'3px',background:d.fill,flexShrink:0}}/>
                        <div style={{flex:1}}>
                          <div style={{fontSize:'12px',color:B.grey}}>{d.name}</div>
                          <div style={{fontSize:'13px',fontWeight:700,color:B.brown}}>{fmtINR(d.amount)}</div>
                        </div>
                        <div style={{fontSize:'12px',background:B.greyLight,color:B.grey,borderRadius:'20px',padding:'2px 7px',fontWeight:600}}>{d.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <AlertSection items={stats.overdueList} title="⚠ Overdue payments" amtColor={B.dangerText}/>
            <AlertSection items={stats.dueSoonList} title="Due within 7 days" amtColor={'#92600a'}/>

            {stats.overdueList.length===0 && stats.dueSoonList.length===0 && (
              <div style={{...cardStyle,textAlign:'center',padding:'2.5rem 1rem',color:B.grey}}>
                <div style={{fontSize:'28px',marginBottom:'8px'}}>✓</div>
                <div style={{fontSize:'14px',fontWeight:600,color:B.teal}}>All clear — no urgent payments</div>
              </div>
            )}
          </>}

          {/* ══ PAYMENTS ══ */}
          {tab==='payments' && <>
            <input
              value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search vendor or category…"
              style={{...inputStyle,marginBottom:'10px'}}
            />

            {/* Filter chips */}
            <div style={{display:'flex',gap:'7px',overflowX:'auto',paddingBottom:'10px',marginBottom:'6px',scrollbarWidth:'none'}}>
              {['all','overdue','due-soon','pending','paid'].map(f=>(
                <button key={f} onClick={()=>setFilter(f)}
                  className={filter===f?'chip-active':''}
                  style={{...btnBase,padding:'8px 14px',borderRadius:'20px',border:`1px solid ${B.slate}`,background:'transparent',color:B.grey,fontSize:'13px',whiteSpace:'nowrap',flexShrink:0,fontFamily:'"Avenir LT Std", Avenir, sans-serif'}}>
                  {f==='all'?'All':STATUS[f]?.label}
                </button>
              ))}
            </div>

            {rows.length===0 && <div style={{...cardStyle,textAlign:'center',padding:'2.5rem',color:B.grey,fontSize:'14px'}}>No payments found</div>}

            {rows.map(p=>(
              <div key={p.id} className="pay-card" style={cardStyle}>
                {/* Card top */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
                  <div style={{flex:1,marginRight:'12px'}}>
                    <div style={{fontSize:'15px',fontWeight:700,color:B.brown}}>{p.vendor}</div>
                    <div style={{fontSize:'12px',color:B.grey,marginTop:'3px'}}>{p.category} · Due {fmtDate(p.dueDate)}</div>
                    {p.notes&&<div style={{fontSize:'12px',color:B.grey,marginTop:'2px',fontStyle:'italic'}}>{p.notes}</div>}
                    {p.pdfLink && (
                      <div style={{display:'flex', gap:'10px', marginTop:'8px'}}>
                        <a href={p.pdfLink} target="_blank" rel="noreferrer" style={{display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', color:B.tealDark, fontWeight:700, textDecoration:'none', background:B.tealLight, padding:'5px 10px', borderRadius:'8px'}}>
                          <span style={{fontSize:'12px'}}>📄</span> View Bill
                        </a>
                        <a href={p.pdfLink} download target="_blank" rel="noreferrer" style={{display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', color:B.brown, fontWeight:700, textDecoration:'none', background:B.brownLight, padding:'5px 10px', borderRadius:'8px'}}>
                          <span style={{fontSize:'12px'}}>⬇</span> Download
                        </a>
                      </div>
                    )}
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:'17px',fontWeight:700,color:B.teal,fontFamily:'"Moranga", serif'}}>{fmtINR(p.amount)}</div>
                    <div style={{marginTop:'6px'}}><Badge cs={p.cs}/></div>
                  </div>
                </div>
                <Divider/>
                {/* Actions */}
                <div style={{display:'flex',gap:'8px',paddingTop:'10px',alignItems:'center'}}>
                  {p.cs!=='paid'
                    ? <button style={{...btnBase,...btnPrimary,flex:1,textAlign:'center'}} onClick={()=>markPaid(p.id)}>Mark as paid</button>
                    : <div style={{flex:1,fontSize:'13px',color:B.successText,fontWeight:600}}>✓ Paid {p.paidDate?fmtDate(p.paidDate):''}</div>
                  }
                  <button style={{...btnBase,...btnDanger}} onClick={()=>remove(p.id)}>Delete</button>
                </div>
              </div>
            ))}
          </>}
        </div>
      </div>

      {/* ── FAB ── */}
      <button onClick={()=>{setSheet(true);setFormErr('');}} style={{...btnBase,position:'fixed',bottom:'82px',right:'50%',transform:'translateX(calc(50% + min(50vw,260px) - 72px))',width:'56px',height:'56px',borderRadius:'50%',border:'none',background:B.gold,color:B.tealDark,fontSize:'26px',fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 4px 20px rgba(210,161,42,0.5)`,zIndex:30,lineHeight:1}}>+</button>

      {/* ── Bottom Nav ── */}
      <div style={{position:'fixed',bottom:0,left:0,right:0,background:B.white,borderTop:`1px solid ${B.slate}`,display:'flex',zIndex:20}}>
        <div style={{maxWidth:'520px',margin:'0 auto',display:'flex',width:'100%'}}>
          {[
            {id:'dashboard',label:'Dashboard', icon:'▦'},
            {id:'payments', label:'Payments',  icon:'≡'},
          ].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{...btnBase,flex:1,padding:'11px 0 9px',border:'none',background:'transparent',color:tab===t.id?B.teal:B.grey,fontSize:'12px',fontWeight:tab===t.id?700:400,display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',borderTop:tab===t.id?`2.5px solid ${B.teal}`:'2.5px solid transparent',letterSpacing:'0.02em'}}>
              <span style={{fontSize:'19px',lineHeight:1}}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Add Payment Bottom Sheet ── */}
      {sheet && (
        <div style={{position:'fixed',inset:0,zIndex:100,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
          {/* Scrim */}
          <div style={{position:'absolute',inset:0,background:'rgba(26,61,63,0.55)',animation:'fadeIn 0.2s ease both'}} onClick={()=>setSheet(false)}/>
          {/* Sheet */}
          <div style={{position:'relative',background:B.teal,borderRadius:'22px 22px 0 0',padding:'0 1.25rem 2.5rem',maxHeight:'92vh',overflowY:'auto',maxWidth:'520px',width:'100%',margin:'0 auto',animation:'slideUp 0.3s cubic-bezier(0.32,0.72,0,1) both',boxShadow:'0 -8px 40px rgba(0,0,0,0.2)'}}>

            {/* Handle */}
            <div style={{textAlign:'center',padding:'12px 0 8px'}}>
              <div style={{width:'36px',height:'4px',borderRadius:'2px',background:'rgba(255,255,255,0.25)',display:'inline-block'}}/>
            </div>

            {/* Gold stripe */}
            <div style={{height:'3px',borderRadius:'2px',background:`linear-gradient(90deg,${B.gold},#f0c84a,${B.gold})`,marginBottom:'1.25rem'}}/>

            <div style={{fontSize:'18px',fontWeight:700,color:B.cream,marginBottom:'1.5rem',letterSpacing:'0.01em'}}>Add vendor payment</div>

            <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
              <div>
                <label style={sheetLabelStyle}>Vendor name *</label>
                <input className="sheet-input" style={sheetInputStyle} value={form.vendor} onChange={e=>setForm(f=>({...f,vendor:e.target.value}))} placeholder="e.g. TechParts Ltd"/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                <div>
                  <label style={sheetLabelStyle}>Amount (₹) *</label>
                  <input className="sheet-input" style={sheetInputStyle} type="number" inputMode="numeric" min="0" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0"/>
                </div>
                <div>
                  <label style={sheetLabelStyle}>Due date *</label>
                  <input className="sheet-input" style={sheetInputStyle} type="date" value={form.dueDate} onChange={e=>setForm(f=>({...f,dueDate:e.target.value}))}/>
                </div>
              </div>
              <div>
                <label style={sheetLabelStyle}>Category</label>
                <select className="sheet-input" style={{...sheetInputStyle,cursor:'pointer'}} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                  {CATS.map(c=><option key={c} style={{background:B.tealDark,color:B.cream}}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={sheetLabelStyle}>Notes (optional)</label>
                <input className="sheet-input" style={sheetInputStyle} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Invoice #, reference…"/>
              </div>
              <div>
                <label style={sheetLabelStyle}>Bill Link / PDF (optional)</label>
                <input className="sheet-input" style={sheetInputStyle} type="url" value={form.pdfLink||''} onChange={e=>setForm(f=>({...f,pdfLink:e.target.value}))} placeholder="e.g. Google Drive or OneDrive link"/>
              </div>
              {formErr && <div style={{fontSize:'13px',color:'#fca5a5',fontWeight:500}}>{formErr}</div>}
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginTop:'1.5rem'}}>
              <button onClick={()=>{setSheet(false);setFormErr('');}} style={{...btnBase,padding:'14px',borderRadius:'12px',border:'1.5px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.08)',color:B.cream,fontSize:'15px',fontFamily:'"Avenir LT Std", Avenir, sans-serif'}}>Cancel</button>
              <button onClick={submit} style={{...btnBase,padding:'14px',borderRadius:'12px',border:'none',background:B.gold,color:B.tealDark,fontSize:'15px',fontWeight:700,fontFamily:'"Avenir LT Std", Avenir, sans-serif'}}>Add payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
