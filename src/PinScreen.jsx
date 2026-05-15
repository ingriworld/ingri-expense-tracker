import { useState, useEffect } from "react";

const B = {
  tealDark:   '#1a3d3f',
  slateDark:  '#6c6d6d',
  gold:       '#d2a12a',
  cream:      '#fffef8',
};
const CORRECT_PIN = '986532';

export default function PinScreen({onUnlock}) {
  const [pin,  setPin]  = useState('');
  const [shake,setShake]= useState(false);
  const [wrong,setWrong]= useState(false);
  const [loading,setLoading]= useState(false);

  const press = k => {
    if (pin.length === 0) import('./Tracker').catch(()=>{});
    if (pin.length >= 6 || loading) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 6) {
      if (next === CORRECT_PIN) {
        setLoading(true);
        import('./Tracker')
          .then(() => setTimeout(() => onUnlock(), 250))
          .catch(() => setTimeout(() => onUnlock(), 250));
      } else {
        setShake(true); setWrong(true);
        setTimeout(() => { setPin(''); setShake(false); setWrong(false); }, 750);
      }
    }
  };
  const erase = () => {
    if (!loading) setPin(p => p.slice(0,-1));
  };
  const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') erase();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin]);

  return (
    <div style={{minHeight:'100vh',background:B.tealDark,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:'"Avenir LT Std", Avenir, sans-serif',padding:'2rem',userSelect:'none'}}>
      <style>{`
        @keyframes pinShake{0%,100%{transform:translateX(0)}15%{transform:translateX(-10px)}35%{transform:translateX(10px)}55%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
        @keyframes pinFadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pinPulse{from{opacity:1;transform:scale(1.2)}to{opacity:0.4;transform:scale(1)}}
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
              transform: i<pin.length?'scale(1.2)':'scale(1)',
              animation: loading ? `pinPulse 0.5s alternate infinite ${i * 0.1}s` : 'none'
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
