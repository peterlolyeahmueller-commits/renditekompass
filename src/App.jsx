import React, { useState, useMemo, useEffect } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, ReferenceLine
} from "recharts";

const TF_DEPOT = 0.30;
const TF_FLEX  = 0.15;

function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const handle = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);
  return width;
}

function simuliereDepot({ laufzeit, sparrate, startkapital, bruttoRendite, fondskosten, vorabDrag, rebalDrag, kapSt }) {
  const nettoRendite = bruttoRendite - fondskosten - vorabDrag - rebalDrag;
  const effStDepot   = (1 - TF_DEPOT) * kapSt;
  let wert = Math.max(startkapital, 0);
  let eingezahlt = startkapital;
  const jahre = [];
  for (let j = 1; j <= laufzeit; j++) {
    eingezahlt += sparrate * 12;
    for (let m = 0; m < 12; m++) wert = (wert + sparrate) * (1 + nettoRendite / 12);
    jahre.push({ jahr: j, brutto: Math.round(wert), eingezahlt: Math.round(eingezahlt) });
  }
  const bruttoEndwert = wert;
  const gewinn        = Math.max(0, bruttoEndwert - eingezahlt);
  const schlusssteuer = gewinn * effStDepot;
  const nettoEndwert  = bruttoEndwert - schlusssteuer;
  return { bruttoEndwert, nettoEndwert, schlusssteuer, gesamtEingezahlt: eingezahlt, nettoRendite, effStDepot, jahre };
}

function simuliereFlex({ laufzeit, sparrate, startkapital, bruttoRendite, effektivKosten, steuersatz }) {
  const nettoRendite = bruttoRendite - effektivKosten;
  let wert = Math.max(startkapital, 0);
  let eingezahlt = startkapital;
  const jahre = [];
  for (let j = 1; j <= laufzeit; j++) {
    eingezahlt += sparrate * 12;
    for (let m = 0; m < 12; m++) wert = (wert + sparrate) * (1 + nettoRendite / 12);
    jahre.push({ jahr: j, brutto: Math.round(wert), eingezahlt: Math.round(eingezahlt) });
  }
  const bruttoEndwert   = wert;
  const gewinn          = Math.max(0, bruttoEndwert - eingezahlt);
  const steuerpflichtig = gewinn * 0.5 * (1 - TF_FLEX);
  const schlusssteuer   = steuerpflichtig * steuersatz;
  const nettoEndwert    = bruttoEndwert - schlusssteuer;
  return { bruttoEndwert, nettoEndwert, schlusssteuer, steuerpflichtig, gesamtEingezahlt: eingezahlt, nettoRendite, jahre };
}

const fmt    = n => new Intl.NumberFormat("de-DE", { style:"currency", currency:"EUR", maximumFractionDigits:0 }).format(n);
const fmtPct = (n, d=2) => (n*100).toFixed(d) + " %";
const fmtPP  = (n, d=2) => (n>=0?"+":"") + (n*100).toFixed(d) + " pp";

function CustomTooltip({ active, payload, label, laufzeit }) {
  if (!active || !payload?.length) return null;
  const isLast = label >= laufzeit && label <= laufzeit + 10;
  return (
    <div style={{ background:"#111a0e", border:"1px solid rgba(212,232,194,0.12)", padding:"0.8rem 1rem",
      fontFamily:"Courier New", fontSize:"0.72rem", color:"#d4e8c2", minWidth:"210px" }}>
      <div style={{ color:"rgba(212,232,194,0.4)", marginBottom:"0.5rem", letterSpacing:"0.1em" }}>
        {label <= laufzeit ? `JAHR ${label}` : <span style={{color:"#f87171"}}>NACH STEUER</span>}
      </div>
      {payload.filter(p => p.value != null && p.value > 0).map(p => (
        <div key={p.dataKey} style={{ display:"flex", justifyContent:"space-between", gap:"1.5rem", marginBottom:"0.2rem" }}>
          <span style={{ color:"rgba(212,232,194,0.5)" }}>{p.name}</span>
          <span style={{ fontWeight:"bold", color:p.color }}>{fmt(p.value)}</span>
        </div>
      ))}
      {label > laufzeit && <div style={{ marginTop:"0.5rem", paddingTop:"0.5rem", borderTop:"1px solid rgba(212,232,194,0.1)", fontSize:"0.62rem", color:"rgba(212,232,194,0.3)" }}>Werte nach Schlusssteuer</div>}
    </div>
  );
}

export default function RenditeKompass() {
  const [laufzeit,      setLaufzeit]      = useState(35);
  const [sparrate,      setSparrate]      = useState(200);
  const [startkapital,  setStartkapital]  = useState(0);
  const [bruttoRendite, setBruttoRendite] = useState(7);
  const [steuersatz,    setSteuersatz]    = useState(20);
  const [kapSt,         setKapSt]         = useState(27);
  const [kapGleichEst,  setKapGleichEst]  = useState(false);
  const [fondskosten,   setFondskosten]   = useState(0.20);
  const [vorabDrag,     setVorabDrag]     = useState(0.15);
  const [rebalDrag,     setRebalDrag]     = useState(0.40);
  const [flexKosten,    setFlexKosten]    = useState(1.02);
  const [activeTab,     setActiveTab]     = useState("vergleich");
  const vw       = useWindowWidth();
  const isMobile = vw < 860;
  const isNarrow = vw < 560;
  const isMedium = vw < 1100;

  useEffect(() => {
    if (kapGleichEst) setKapSt(steuersatz);
  }, [kapGleichEst, steuersatz]);

  const R = useMemo(() => {
    const r  = bruttoRendite / 100;
    const st = steuersatz / 100;
    const ks = kapSt / 100;
    const depot = simuliereDepot({ laufzeit, sparrate, startkapital, bruttoRendite: r,
      fondskosten: fondskosten/100, vorabDrag: vorabDrag/100, rebalDrag: rebalDrag/100, kapSt: ks });
    const flex = simuliereFlex({ laufzeit, sparrate, startkapital, bruttoRendite: r,
      effektivKosten: flexKosten/100, steuersatz: st });

    const flexGewinn  = Math.max(0, flex.bruttoEndwert - flex.gesamtEingezahlt);
    const flexStBasis = flexGewinn * 0.5 * (1 - TF_FLEX);
    const breakEvenSt = flexStBasis > 0 ? (flex.bruttoEndwert - depot.nettoEndwert) / flexStBasis : null;

    const chartData = [{ jahr:0, depot:startkapital, flex:startkapital, eingezahlt:startkapital }];
    for (let j = 1; j <= laufzeit; j++) {
      chartData.push({
        jahr: j,
        depot: depot.jahre[j-1].brutto,
        flex:  flex.jahre[j-1].brutto,
        eingezahlt: depot.jahre[j-1].eingezahlt,
      });
    }
    const schwanzEnde      = laufzeit + Math.round(laufzeit * 0.15);
    const letzteEinzahlung = depot.jahre[laufzeit-1].eingezahlt;
    chartData.push({ jahr: laufzeit + 1,  depot: depot.nettoEndwert, flex: flex.nettoEndwert, eingezahlt: letzteEinzahlung });
    chartData.push({ jahr: schwanzEnde,   depot: depot.nettoEndwert, flex: flex.nettoEndwert, eingezahlt: letzteEinzahlung });

    const accentColor = depot.nettoEndwert >= flex.nettoEndwert ? "#22d3ee" : "#ff8c00";
    return { depot, flex, chartData, breakEvenSt, accentColor };
  }, [laufzeit, sparrate, startkapital, bruttoRendite, steuersatz, kapSt, fondskosten, vorabDrag, rebalDrag, flexKosten]);

  const COLORS      = { depot:"#22d3ee", flex:"#ff8c00", ein:"rgba(255,255,255,0.18)" };
  const accent      = R.accentColor;
  const tabs        = [["vergleich","Vergleich"],["depot","Depot-Detail"],["flex","Flex-Detail"]];
  const depotNettoR = (bruttoRendite - fondskosten - vorabDrag - rebalDrag).toFixed(2);
  const flexNettoR  = (bruttoRendite - flexKosten).toFixed(2);

  return (
    <div style={{ fontFamily:"'Courier New',monospace", background:"#0c0f0a", minHeight:"100vh", color:"#d4e8c2", padding:"1.5rem" }}>
      <style>{`
        *{box-sizing:border-box}
        .card{background:rgba(212,232,194,0.04);border:1px solid rgba(212,232,194,0.1);border-radius:1px;padding:1.2rem}
        .inset{background:rgba(0,0,0,0.3);border:1px solid rgba(212,232,194,0.06);border-radius:1px;padding:0.9rem}
        .lbl{font-size:0.58rem;letter-spacing:0.2em;text-transform:uppercase;color:rgba(212,232,194,0.4)}
        input[type=range]{-webkit-appearance:none;width:100%;height:2px;background:rgba(212,232,194,0.15);outline:none;cursor:pointer}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;background:rgba(212,232,194,0.4);border-radius:50%}
        .tab{padding:0.35rem 0.8rem;font-size:0.62rem;letter-spacing:0.15em;text-transform:uppercase;cursor:pointer;border:1px solid transparent;border-radius:1px;background:none;color:rgba(212,232,194,0.4);transition:all 0.15s}
        .tab.on{border-color:rgba(212,232,194,0.2);color:inherit;background:rgba(212,232,194,0.04)}
        .tab:hover{color:#d4e8c2}
        .row{display:flex;justify-content:space-between;padding:0.3rem 0;border-bottom:1px solid rgba(212,232,194,0.05);font-size:0.8rem}
      `}</style>

      <div style={{ marginBottom:"1.5rem" }}>
        <div className="lbl" style={{ marginBottom:"0.3rem" }}>Modell-Rechner · Altersvorsorge · DE-Steuerrecht</div>
        <h1 style={{ margin:0, fontSize:"1.5rem", fontWeight:"normal", letterSpacing:"0.06em" }}>
          RenditeKompass <span style={{ color:"rgba(212,232,194,0.2)", fontSize:"1rem" }}> // ETF-Depot vs. Flex-Versicherung</span>
        </h1>
        <div style={{ fontSize:"0.6rem", color:"rgba(212,232,194,0.22)", marginTop:"0.25rem" }}>
          Vereinfachtes Renditemodell · Steuer nur beim Verkauf · Alle Werte nominal · Keine Anlageberatung
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : isMedium ? "280px 1fr" : "320px 1fr", gap:"1.2rem", alignItems:"start" }}>
        <div style={{ display:"flex", flexDirection:"column", gap:"0.8rem" }}>

          <div className="card">
            <div className="lbl" style={{ marginBottom:"1rem" }}>Allgemeine Parameter</div>
            {[
              { label:"Laufzeit",             val:laufzeit,      set:setLaufzeit,      min:10,  max:50,    step:1,    unit:"Jahre" },
              { label:"Sparrate",             val:sparrate,      set:setSparrate,      min:100, max:1500,  step:50,   unit:"€/Mo" },
              { label:"Startkapital",         val:startkapital,  set:setStartkapital,  min:0,   max:200000,step:5000, unit:"€" },
              { label:"Brutto-Rendite",       val:bruttoRendite, set:setBruttoRendite, min:2,   max:12,    step:0.25, unit:"% p.a." },
              { label:"Grenzsteuersatz",      val:steuersatz,    set:setSteuersatz,    min:14,  max:45,    step:1,    unit:"%" },
              { label:"Kapitalertragsteuer",  val:kapSt,         set:setKapSt,         min:20,  max:50,    step:1,    unit:"%",
                hint:"Ohne Soli: 25% · Inkl. Soli: 26,375% · Standard-Ansatz: 27%", disabled:kapGleichEst },
            ].map(({ label, val, set, min, max, step, unit, hint }) => (
              <div key={label} style={{ marginBottom:"1rem", opacity: label==="Kapitalertragsteuer" && kapGleichEst ? 0.35 : 1, pointerEvents: label==="Kapitalertragsteuer" && kapGleichEst ? "none" : "auto" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.3rem" }}>
                  <span style={{ fontSize:"0.74rem", color:"rgba(212,232,194,0.6)" }}>{label}</span>
                  <span style={{ fontSize:"0.74rem", color:"rgba(212,232,194,0.7)" }}>{val.toLocaleString("de-DE")} {unit}</span>
                </div>
                <input type="range" min={min} max={max} step={step} value={val} onChange={e => set(parseFloat(e.target.value))} />
                {hint && <div style={{ fontSize:"0.58rem", color:"rgba(212,232,194,0.24)", marginTop:"0.3rem", lineHeight:1.5 }}>{hint}</div>}
              </div>
            ))}
            <div onClick={() => setKapGleichEst(!kapGleichEst)}
              style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"0.5rem 0", borderTop:"1px solid rgba(212,232,194,0.08)", marginTop:"0.2rem", cursor:"pointer" }}>
              <span style={{ fontSize:"0.74rem", color: kapGleichEst ? "#d4e8c2" : "rgba(212,232,194,0.6)" }}>
                KapESt = Einkommensteuersatz
              </span>
              <div style={{ width:"36px", height:"20px", borderRadius:"10px", flexShrink:0,
                background: kapGleichEst ? "#22d3ee" : "rgba(212,232,194,0.15)",
                position:"relative", transition:"background 0.2s" }}>
                <div style={{ position:"absolute", top:"3px",
                  left: kapGleichEst ? "19px" : "3px",
                  width:"14px", height:"14px", borderRadius:"50%",
                  background:"#fff", transition:"left 0.2s" }} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="lbl" style={{ marginBottom:"0.4rem", color:"#22d3ee" }}>ETF-Depot · Renditeabschläge</div>
            <div style={{ fontSize:"0.62rem", color:"rgba(212,232,194,0.28)", marginBottom:"1rem", lineHeight:1.7,
              background:"rgba(34,211,238,0.05)", padding:"0.5rem 0.6rem", borderLeft:"2px solid #22d3ee44" }}>
              {bruttoRendite}% − {fondskosten.toFixed(2)}% − {vorabDrag.toFixed(2)}% − {rebalDrag.toFixed(2)}%
              {" "}= <span style={{ color:"#22d3ee", fontWeight:"bold" }}>{depotNettoR}% Nettorendite p.a.</span>
            </div>
            {[
              { label:"Effektive Fondskosten (TD)", val:fondskosten, set:setFondskosten, min:0.05, max:0.50, step:0.01, color:"#22d3ee" },
              { label:"Vorabpauschale-Drag",        val:vorabDrag,   set:setVorabDrag,   min:0.00, max:0.30, step:0.01, color:"#22d3ee" },
              { label:"Rebalancing Steuer-Drag",    val:rebalDrag,   set:setRebalDrag,   min:0.00, max:1.00, step:0.05, color:"#22d3ee" },
            ].map(({ label, val, set, min, max, step, color }) => (
              <div key={label} style={{ marginBottom:"1.1rem" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.3rem" }}>
                  <span style={{ fontSize:"0.74rem", color:"rgba(212,232,194,0.6)" }}>{label}</span>
                  <span style={{ fontSize:"0.74rem", color }}>−{val.toFixed(2)} %</span>
                </div>
                <input type="range" min={min} max={max} step={step} value={val} onChange={e => set(parseFloat(e.target.value))} />
              </div>
            ))}
          </div>

          <div className="card">
            <div className="lbl" style={{ marginBottom:"0.4rem", color:"#ff8c00" }}>Flex-Versicherung</div>
            <div style={{ fontSize:"0.62rem", color:"rgba(212,232,194,0.28)", marginBottom:"1rem", lineHeight:1.7,
              background:"rgba(255,140,0,0.05)", padding:"0.5rem 0.6rem", borderLeft:"2px solid #ff8c0044" }}>
              {bruttoRendite}% − {flexKosten.toFixed(2)}%
              {" "}= <span style={{ color:"#ff8c00", fontWeight:"bold" }}>{flexNettoR}% Nettorendite p.a.</span>
            </div>
            <div style={{ marginBottom:"0.8rem" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.3rem" }}>
                <span style={{ fontSize:"0.74rem", color:"rgba(212,232,194,0.6)" }}>Effektivkostensatz p.a.</span>
                <span style={{ fontSize:"0.74rem", color:"#ff8c00" }}>−{flexKosten.toFixed(2)} %</span>
              </div>
              <input type="range" min={0.30} max={2.50} step={0.01} value={flexKosten} onChange={e => setFlexKosten(parseFloat(e.target.value))} />
            </div>
            <div className="inset" style={{ fontSize:"0.66rem", color:"rgba(212,232,194,0.4)", lineHeight:1.9 }}>
              <div>✓ Rebalancing steuerfrei</div>
              <div>✓ Keine Vorabpauschale</div>
              <div>✓ Steuer erst bei Auszahlung (HEV)</div>
              <div>✗ Höhere laufende Kosten</div>
              <div>✗ Grenzsteuersatz statt {kapSt}%</div>
            </div>
          </div>

          <div className="card" style={{ borderColor:"rgba(212,232,194,0.06)" }}>
            <div className="lbl" style={{ marginBottom:"0.6rem" }}>Steuerlogik am Ende</div>
            <div style={{ fontSize:"0.66rem", color:"rgba(212,232,194,0.4)", lineHeight:2.1 }}>
              <div style={{ color:"#22d3ee", marginBottom:"0.2rem" }}>ETF-Depot:</div>
              <div>Gewinn × 70% × {kapSt}%</div>
              <div style={{ color:"#4ade80", marginBottom:"0.6rem" }}>= {fmtPct(R.depot.effStDepot)} eff. Steuersatz</div>
              <div style={{ color:"#ff8c00", marginBottom:"0.2rem" }}>Flex-Versicherung:</div>
              <div>Gewinn × 50% × 85% × {steuersatz}%</div>
              <div style={{ color:"#4ade80" }}>= {fmtPct(0.5*(1-TF_FLEX)*steuersatz/100)} eff. Steuersatz</div>
            </div>
          </div>

        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
          <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}>
            {tabs.map(([k,v]) => (
              <button key={k} className={`tab ${activeTab===k?"on":""}`}
                style={activeTab===k ? { borderColor:`${accent}66`, color:accent, background:`${accent}10` } : {}}
                onClick={() => setActiveTab(k)}>{v}</button>
            ))}
          </div>

          {activeTab === "vergleich" && <>
            <div style={{ display:"grid", gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr", gap:"0.8rem" }}>
              {[
                { label:"ETF-Depot",         r:R.depot, c:COLORS.depot, sub:`${depotNettoR}% Nettorendite p.a.` },
                { label:"Flex-Versicherung", r:R.flex,  c:COLORS.flex,  sub:`${flexNettoR}% Nettorendite p.a.` },
              ].map(({ label, r, c, sub }) => (
                <div key={label} className="card" style={{ borderColor:c+"44" }}>
                  <div className="lbl" style={{ color:c, marginBottom:"0.3rem" }}>{label}</div>
                  <div style={{ fontSize:"0.62rem", color:"rgba(212,232,194,0.3)", marginBottom:"0.7rem" }}>{sub}</div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:"0.35rem" }}>
                    <span style={{ fontSize:"0.65rem", color:"rgba(212,232,194,0.35)" }}>Vor Steuer</span>
                    <span style={{ fontSize:"1rem", color:"rgba(212,232,194,0.6)" }}>{fmt(r.bruttoEndwert)}</span>
                  </div>
                  <div style={{ height:"1px", background:"rgba(212,232,194,0.08)", marginBottom:"0.35rem" }} />
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
                    <span style={{ fontSize:"0.65rem", color:c }}>Netto nach Steuer</span>
                    <span style={{ fontSize:"1.4rem", fontWeight:"bold", color:c }}>{fmt(r.nettoEndwert)}</span>
                  </div>
                  <div style={{ fontSize:"0.65rem", color:"rgba(212,232,194,0.28)", marginTop:"0.4rem" }}>
                    Steuer: {fmt(r.schlusssteuer)} · Eingezahlt: {fmt(r.gesamtEingezahlt)}
                  </div>
                </div>
              ))}
            </div>

            {R.breakEvenSt !== null && (
              <div className="card" style={{ borderColor:"rgba(212,232,194,0.08)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div className="lbl" style={{ color:accent, marginBottom:"0.3rem" }}>Break-even Grenzsteuersatz</div>
                    <div style={{ fontSize:"0.7rem", color:"rgba(212,232,194,0.4)", lineHeight:1.7 }}>
                      {R.breakEvenSt >= 0 && R.breakEvenSt <= 1
                        ? <>Bei <strong style={{ color:accent }}>{fmtPct(R.breakEvenSt, 0)}</strong> Grenzsteuersatz im Alter wären Depot und Flex gleich.</>
                        : R.breakEvenSt > 1 ? "Depot gewinnt bei jedem realistischen Steuersatz."
                                            : "Flex gewinnt bei jedem realistischen Steuersatz." }
                      {R.breakEvenSt > 0 && R.breakEvenSt <= 0.60 && (
                        <span style={{ color: steuersatz/100 > R.breakEvenSt ? "#f87171" : "#4ade80", marginLeft:"0.4rem" }}>
                          Dein Steuersatz ({steuersatz}%) liegt {steuersatz/100 > R.breakEvenSt ? "darüber → Depot gewinnt" : "darunter → Flex gewinnt"}.
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize:"2.2rem", fontWeight:"bold", color:accent, marginLeft:"1.5rem", whiteSpace:"nowrap" }}>
                    {R.breakEvenSt >= 0 && R.breakEvenSt <= 1 ? fmtPct(R.breakEvenSt, 0) : "–"}
                  </div>
                </div>
              </div>
            )}

            <div className="card">
              <div style={{ marginBottom:"1rem" }}>
                <div className="lbl">Vermögensentwicklung · Vor Steuer + Steuersprung am Ende</div>
                <div style={{ fontSize:"0.6rem", color:"rgba(212,232,194,0.25)", marginTop:"0.3rem" }}>
                  Durchgezogene Linie = vor Steuer · Senkrechter Abfall = Schlusssteuer · Horizontale = Netto nach Steuer
                </div>
              </div>
              <ChartMitSprung data={R.chartData} laufzeit={laufzeit} COLORS={COLORS} />
            </div>

            <div className="card">
              <div className="lbl" style={{ marginBottom:"0.8rem" }}>Vollständiger Vergleich</div>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.78rem" }}>
                <thead>
                  <tr style={{ color:"rgba(212,232,194,0.3)", fontSize:"0.6rem", letterSpacing:"0.1em" }}>
                    <th style={{ textAlign:"left", padding:"0.4rem 0.5rem", fontWeight:"normal" }}>Kennzahl</th>
                    {[["ETF-Depot",COLORS.depot],["Flex",COLORS.flex]].map(([h,c]) => (
                      <th key={h} style={{ textAlign:"right", padding:"0.4rem 0.5rem", fontWeight:"normal", color:c }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label:"Nettorendite p.a.", vals:[fmtPct(R.depot.nettoRendite), fmtPct(R.flex.nettoRendite)] },
                    { label:"Vor Steuer",         vals:[R.depot, R.flex].map(r => fmt(r.bruttoEndwert)) },
                    { label:"Schlusssteuer",      vals:[R.depot, R.flex].map(r => fmt(r.schlusssteuer)), red:true },
                    { label:"Netto nach Steuer",  vals:[R.depot, R.flex].map(r => fmt(r.nettoEndwert)), bold:true },
                    { label:"Netto-Ertrag",       vals:[R.depot, R.flex].map(r => fmt(r.nettoEndwert - r.gesamtEingezahlt)) },
                    { label:"Eingezahlt",         vals:[R.depot, R.flex].map(r => fmt(r.gesamtEingezahlt)) },
                    { label:"Differenz Netto",    vals:["—", fmtPP((R.flex.nettoEndwert - R.depot.nettoEndwert) / R.depot.nettoEndwert)] },
                  ].map(({ label, vals, bold, red }) => (
                    <tr key={label} style={{ borderBottom:"1px solid rgba(212,232,194,0.05)" }}>
                      <td style={{ padding:"0.35rem 0.5rem", color:"rgba(212,232,194,0.42)", fontSize:"0.74rem" }}>{label}</td>
                      {vals.map((v, i) => (
                        <td key={i} style={{ padding:"0.35rem 0.5rem", textAlign:"right",
                          fontWeight:bold?"bold":"normal",
                          color:red?"#f87171":bold?"#d4e8c2":"rgba(212,232,194,0.78)" }}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <InterpretationBlock R={R} steuersatz={steuersatz} kapSt={kapSt} laufzeit={laufzeit}
              fondskosten={fondskosten} vorabDrag={vorabDrag} rebalDrag={rebalDrag} flexKosten={flexKosten} accent={accent} />
          </>}

          {activeTab === "depot" && <>
            <div style={{ display:"grid", gridTemplateColumns: isNarrow ? "1fr 1fr" : "repeat(3,1fr)", gap:"0.8rem" }}>
              {[
                { label:"Nettorendite p.a.", val:fmtPct(R.depot.nettoRendite), c:COLORS.depot },
                { label:"Vor Steuer",        val:fmt(R.depot.bruttoEndwert),    c:"rgba(212,232,194,0.6)" },
                { label:"Schlusssteuer",     val:fmt(R.depot.schlusssteuer),    c:"#f87171" },
              ].map(({ label, val, c }) => (
                <div key={label} className="card">
                  <div className="lbl" style={{ color:c, marginBottom:"0.4rem" }}>{label}</div>
                  <div style={{ fontSize:"1.1rem", fontWeight:"bold", color:c }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr", gap:"0.8rem" }}>
              <div className="card">
                <div className="lbl" style={{ marginBottom:"0.8rem" }}>Renditezerlegung</div>
                {[
                  ["Brutto-Rendite",       `${bruttoRendite.toFixed(2)} %`, "#d4e8c2"],
                  ["− Fondskosten (TD)",   `−${fondskosten.toFixed(2)} %`,  "#f97316"],
                  ["− Vorabpauschale-Drag",`−${vorabDrag.toFixed(2)} %`,    "#22d3ee"],
                  ["− Rebalancing-Drag",   `−${rebalDrag.toFixed(2)} %`,    "#f87171"],
                  ["= Nettorendite p.a.",  `${depotNettoR} %`,              "#4ade80"],
                ].map(([k,v,c]) => (
                  <div key={k} className="row">
                    <span style={{ color:"rgba(212,232,194,0.45)", fontSize:"0.74rem" }}>{k}</span>
                    <span style={{ color:c, fontWeight:k.startsWith("=")?"bold":"normal" }}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="card">
                <div className="lbl" style={{ marginBottom:"0.8rem" }}>Schlusssteuer-Herleitung</div>
                {[
                  ["Vor-Steuer-Endwert",      fmt(R.depot.bruttoEndwert),                                  "#d4e8c2"],
                  ["− Eingezahlt",            fmt(R.depot.gesamtEingezahlt),                               "#d4e8c2"],
                  ["= Gewinn",                fmt(R.depot.bruttoEndwert - R.depot.gesamtEingezahlt),       "#d4e8c2"],
                  ["× 70% (30% Teilfreist.)", fmt((R.depot.bruttoEndwert-R.depot.gesamtEingezahlt)*0.7),  "#d4e8c2"],
                  [`× ${kapSt}% KapESt`,      fmt(R.depot.schlusssteuer),                                  "#f87171"],
                  ["= Netto-Endwert",         fmt(R.depot.nettoEndwert),                                   "#4ade80"],
                ].map(([k,v,c]) => (
                  <div key={k} className="row">
                    <span style={{ color:"rgba(212,232,194,0.45)", fontSize:"0.74rem" }}>{k}</span>
                    <span style={{ color:c }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="lbl" style={{ marginBottom:"0.8rem" }}>Jahresverlauf ETF-Depot</div>
              <div style={{ maxHeight:"340px", overflowY:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.74rem" }}>
                  <thead style={{ position:"sticky", top:0, background:"#0c0f0a" }}>
                    <tr style={{ color:"rgba(212,232,194,0.32)", fontSize:"0.6rem" }}>
                      {["Jahr","Eingezahlt","Depotwert","Ertrag"].map(h => (
                        <th key={h} style={{ textAlign:"right", padding:"0.3rem 0.5rem", fontWeight:"normal" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {R.depot.jahre.filter((_,i) => (i+1)%5===0 || i===R.depot.jahre.length-1).map(r => (
                      <tr key={r.jahr} style={{ borderBottom:"1px solid rgba(212,232,194,0.04)" }}>
                        <td style={{ textAlign:"right", padding:"0.3rem 0.5rem", color:"rgba(212,232,194,0.3)" }}>{r.jahr}</td>
                        <td style={{ textAlign:"right", padding:"0.3rem 0.5rem" }}>{fmt(r.eingezahlt)}</td>
                        <td style={{ textAlign:"right", padding:"0.3rem 0.5rem", color:COLORS.depot }}>{fmt(r.brutto)}</td>
                        <td style={{ textAlign:"right", padding:"0.3rem 0.5rem" }}>{fmt(r.brutto - r.eingezahlt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>}

          {activeTab === "flex" && <>
            <div style={{ display:"grid", gridTemplateColumns: isNarrow ? "1fr 1fr" : "repeat(3,1fr)", gap:"0.8rem" }}>
              {[
                { label:"Nettorendite p.a.",   val:fmtPct(R.flex.nettoRendite), c:COLORS.flex },
                { label:"Vor Steuer",          val:fmt(R.flex.bruttoEndwert),   c:"rgba(212,232,194,0.6)" },
                { label:"Schlusssteuer (HEV)", val:fmt(R.flex.schlusssteuer),   c:"#f87171" },
              ].map(({ label, val, c }) => (
                <div key={label} className="card">
                  <div className="lbl" style={{ color:c, marginBottom:"0.4rem" }}>{label}</div>
                  <div style={{ fontSize:"1.1rem", fontWeight:"bold", color:c }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr", gap:"0.8rem" }}>
              <div className="card">
                <div className="lbl" style={{ marginBottom:"0.8rem", color:COLORS.flex }}>Schlusssteuer-Herleitung (HEV)</div>
                {[
                  ["Vor-Steuer-Endwert",        fmt(R.flex.bruttoEndwert),                                 "#d4e8c2"],
                  ["− Eingezahlt",              fmt(R.flex.gesamtEingezahlt),                              "#d4e8c2"],
                  ["= Gewinn",                  fmt(R.flex.bruttoEndwert - R.flex.gesamtEingezahlt),       "#d4e8c2"],
                  ["× 50% (Halbeinkünfte)",     fmt((R.flex.bruttoEndwert-R.flex.gesamtEingezahlt)*0.5),  "#d4e8c2"],
                  ["× 85% (−15% Teilfreist.)",  fmt(R.flex.steuerpflichtig),                              "#d4e8c2"],
                  [`× ${steuersatz}% Grenzst.`, fmt(R.flex.schlusssteuer),                                 "#f87171"],
                  ["= Netto-Endwert",           fmt(R.flex.nettoEndwert),                                  "#4ade80"],
                ].map(([k,v,c]) => (
                  <div key={k} className="row">
                    <span style={{ color:"rgba(212,232,194,0.45)", fontSize:"0.74rem" }}>{k}</span>
                    <span style={{ color:c }}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="inset" style={{ fontSize:"0.67rem", color:"rgba(212,232,194,0.4)", lineHeight:1.9 }}>
                <div style={{ color:COLORS.flex, marginBottom:"0.4rem" }}>Vereinfachungen:</div>
                <div>• Effektivkostensatz pauschal p.a.</div>
                <div>• Grenzsteuersatz = aktuell gesetzt</div>
                <div>• HEV-Bedingungen als erfüllt angenommen</div>
                <div style={{ marginTop:"0.5rem", fontSize:"0.6rem", color:"rgba(212,232,194,0.25)", lineHeight:1.6 }}>
                  Tipp: Im Rentenalter oft 25–30% Grenzsteuersatz → Flex attraktiver. Regler testen!
                </div>
              </div>
            </div>
            <div className="card">
              <div className="lbl" style={{ marginBottom:"0.8rem" }}>Jahresverlauf Flex</div>
              <div style={{ maxHeight:"340px", overflowY:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.74rem" }}>
                  <thead style={{ position:"sticky", top:0, background:"#0c0f0a" }}>
                    <tr style={{ color:"rgba(212,232,194,0.32)", fontSize:"0.6rem" }}>
                      {["Jahr","Eingezahlt","Versicherungswert","Ertrag"].map(h => (
                        <th key={h} style={{ textAlign:"right", padding:"0.3rem 0.5rem", fontWeight:"normal" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {R.flex.jahre.filter((_,i) => (i+1)%5===0 || i===R.flex.jahre.length-1).map(r => (
                      <tr key={r.jahr} style={{ borderBottom:"1px solid rgba(212,232,194,0.04)" }}>
                        <td style={{ textAlign:"right", padding:"0.3rem 0.5rem", color:"rgba(212,232,194,0.3)" }}>{r.jahr}</td>
                        <td style={{ textAlign:"right", padding:"0.3rem 0.5rem" }}>{fmt(r.eingezahlt)}</td>
                        <td style={{ textAlign:"right", padding:"0.3rem 0.5rem", color:COLORS.flex }}>{fmt(r.brutto)}</td>
                        <td style={{ textAlign:"right", padding:"0.3rem 0.5rem" }}>{fmt(r.brutto - r.eingezahlt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>}

        </div>
      </div>

      <div style={{ textAlign:"center", marginTop:"1.5rem", fontSize:"0.57rem", color:"rgba(212,232,194,0.16)", letterSpacing:"0.12em" }}>
        VEREINFACHTES RENDITEMODELL · KEINE ANLAGEBERATUNG · ALLE WERTE NOMINAL
      </div>
    </div>
  );
}

function ChartMitSprung({ data, laufzeit, COLORS }) {
  const yFmt = v => v>=1e6?`${(v/1e6).toFixed(1)}M`:`${(v/1000).toFixed(0)}k`;
  return (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart data={data} margin={{ top:10, right:20, left:5, bottom:5 }}>
        <CartesianGrid strokeDasharray="2 6" stroke="rgba(212,232,194,0.05)" />
        <XAxis dataKey="jahr"
          tick={{ fill:"rgba(212,232,194,0.38)", fontSize:10, fontFamily:"Courier New" }}
          tickFormatter={v => v > laufzeit ? "" : `J${v}`}
          axisLine={{ stroke:"rgba(212,232,194,0.08)" }} tickLine={false} />
        <YAxis tick={{ fill:"rgba(212,232,194,0.38)", fontSize:9, fontFamily:"Courier New" }}
          tickFormatter={yFmt} axisLine={false} tickLine={false} width={52} />
        <ReferenceLine x={laufzeit} stroke="rgba(212,232,194,0.25)" strokeDasharray="4 4" />
        <Tooltip content={<CustomTooltip laufzeit={laufzeit} />} />
        <Legend wrapperStyle={{ fontSize:"0.7rem", fontFamily:"Courier New",
          color:"rgba(212,232,194,0.5)", paddingTop:"15px" }} iconType="plainline" />
        <Line type="monotone" dataKey="eingezahlt" name="Eingezahltes Kapital"
          stroke={COLORS.ein} strokeWidth={2} strokeDasharray="4 4"
          dot={false} connectNulls={false} />
        <Line type="monotone" dataKey="depot" name="ETF-Depot"
          stroke={COLORS.depot} strokeWidth={3} dot={false} connectNulls={false}
          activeDot={{ r:6, fill:COLORS.depot, stroke:"#000", strokeWidth:2 }} />
        <Line type="monotone" dataKey="flex" name="Flex-Police"
          stroke={COLORS.flex} strokeWidth={3} dot={false} connectNulls={false}
          activeDot={{ r:6, fill:COLORS.flex, stroke:"#000", strokeWidth:2 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function InterpretationBlock({ R, steuersatz, kapSt, laufzeit, fondskosten, vorabDrag, rebalDrag, flexKosten, accent }) {
  const winner    = R.depot.nettoEndwert > R.flex.nettoEndwert ? "ETF-Depot" : "Flex-Versicherung";
  const diff      = Math.abs(R.depot.nettoEndwert - R.flex.nettoEndwert);
  const depotDrag = (fondskosten + vorabDrag + rebalDrag).toFixed(2);
  return (
    <div className="card" style={{ borderColor:"rgba(212,232,194,0.06)" }}>
      <div className="lbl" style={{ marginBottom:"0.7rem", color:accent }}>Automatische Interpretation</div>
      <div style={{ display:"flex", flexDirection:"column", gap:"0.45rem" }}>
        {[
          { text:`Nach ${laufzeit} Jahren liegt ${winner} vorne – Unterschied: ${fmt(diff)}.`, accent:true },
          { text:`Depot-Nettorendite: ${(R.depot.nettoRendite*100).toFixed(2)}% (nach ${depotDrag}% Abschlägen). Flex-Nettorendite: ${(R.flex.nettoRendite*100).toFixed(2)}% (nach ${flexKosten.toFixed(2)}% Kosten).` },
          { text: R.flex.nettoEndwert > R.depot.nettoEndwert
              ? `Flex gewinnt: Günstigere HEV-Schlusssteuer schlägt die Abgeltungssteuer trotz höherer Kosten bei ${steuersatz}% Grenzsteuersatz.`
              : `Depot gewinnt: Geringere Kosten + effektiv ${(R.depot.effStDepot*100).toFixed(1)}% Abgeltungssteuer schlägt das Halbeinkünfteverfahren bei ${steuersatz}% Grenzsteuersatz.` },
          { text:`Tipp: Break-even Steuersatz beachten – im Rentenalter oft 25–30%. Grenzsteuersatz-Regler auf Rentenniveau setzen!` },
        ].map((l,i) => (
          <div key={i} style={{ fontSize:"0.76rem", color:"rgba(212,232,194,0.6)", lineHeight:1.65,
            paddingLeft:"0.75rem", borderLeft:`2px solid ${l.accent?accent:"rgba(212,232,194,0.07)"}` }}>
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}
