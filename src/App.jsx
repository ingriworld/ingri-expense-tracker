import { useState, lazy, Suspense } from "react";
import PinScreen from "./PinScreen";

// Lazy load the Tracker so Firebase and Recharts are only loaded AFTER the PIN is entered
const Tracker = lazy(() => import("./Tracker"));

export default function App() {
  const [authed, setAuthed] = useState(false);
  if (!authed) return <PinScreen onUnlock={()=>setAuthed(true)}/>;
  return (
    <Suspense fallback={<div style={{minHeight:'100vh', background:'#fffef8'}}></div>}>
      <Tracker onLock={()=>setAuthed(false)}/>
    </Suspense>
  );
}
