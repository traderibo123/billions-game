
import React, { useEffect, useMemo, useRef, useState } from "react";

/** 
 * Billions Neon — Avatar Game (Screens Edition)
 * Screens: INTRO (avatar setup) → PLAY → GAME OVER (share on X).
 * Avatar composer with Billions glasses; proxy-backed avatar fetch; file upload fallback.
 */

const GOOD = ["HUMAN", "AI", "DISCORD", "REFERRAL", "ZK"] as const;
const BAD = ["FAKE", "SYBIL"] as const;
type Good = typeof GOOD[number];
type Bad = typeof BAD[number];
type Drop = { id: number; x: number; y: number; vy: number; type: Good | Bad; good: boolean };
type Floaty = { id: number; x: number; y: number; text: string; life: number };
type Particle = { id: number; x: number; y: number; vx: number; vy: number; life: number };

const COLORS: Record<Good | Bad, string> = {
  HUMAN: "from-emerald-400 to-emerald-600",
  AI: "from-sky-400 to-sky-600",
  DISCORD: "from-indigo-400 to-indigo-600",
  REFERRAL: "from-amber-400 to-amber-600",
  ZK: "from-fuchsia-400 to-fuchsia-600",
  FAKE: "from-rose-400 to-rose-600",
  SYBIL: "from-red-500 to-red-700",
};
const LABELS: Record<Good | Bad, string> = {
  HUMAN: "Human", AI: "AI Agent", DISCORD: "Discord", REFERRAL: "Referral", ZK: "ZK Proof", FAKE: "Fake", SYBIL: "Sybil",
};
const ICONS: Record<Good | Bad, string> = {
  HUMAN: "👤",
  AI: "🤖",
  DISCORD: "💬",
  REFERRAL: "🔗",
  ZK: "🔒",
  FAKE: "❌",
  SYBIL: "🚫",
};

const KEY_LEFT = new Set(["ArrowLeft", "a", "A"]);
const KEY_RIGHT = new Set(["ArrowRight", "d", "D"]);
const clamp01 = (v:number) => Math.max(0, Math.min(1, v));
const sanitizeHandle = (v: string) => v.trim().replace(/^@+/, "");

type Screen = "intro" | "play" | "gameover";

export default function Home() {
  // --- Screens & core game state ---
  const [screen, setScreen] = useState<Screen>("intro");
  const [running, setRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [power, setPower] = useState(0);
  const [lives, setLives] = useState(3);
  const [best, setBest] = useState<number>(() => (typeof window === "undefined" ? 0 : parseInt(localStorage.getItem("billions_best") || "0")));
  const [x, setX] = useState(0.5);
  const [combo, setCombo] = useState(0);

  // runtime refs for stable RAF
  const timeRef = useRef(60);
  const powerRef = useRef(0);
  const livesRef = useRef(3);
  const xRef = useRef(0.5);
  const comboRef = useRef(0);

  useEffect(() => { timeRef.current = timeLeft; }, [timeLeft]);
  useEffect(() => { powerRef.current = power; }, [power]);
  useEffect(() => { livesRef.current = lives; }, [lives]);
  useEffect(() => { xRef.current = x; }, [x]);
  useEffect(() => { comboRef.current = combo; }, [combo]);

  // --- Avatar + glasses ---
  const [handle, setHandle] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [glassesUrl, setGlassesUrl] = useState<string>("/billions-glasses.png");
  const [composedUrl, setComposedUrl] = useState<string>("");
  const [scale, setScale] = useState(1.0);
  const [offX, setOffX] = useState(0);
  const [offY, setOffY] = useState(0);
  const [rotate, setRotate] = useState(0);
  const [debug, setDebug] = useState<string>("");

  // game objects
  const dropsRef = useRef<Drop[]>([]);
  const floatiesRef = useRef<Floaty[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const keys = useRef({ L: false, R: false });
  const last = useRef<number | null>(null);

  const reset = () => {
    setTimeLeft(60); setPower(0); setLives(3); setCombo(0);
    timeRef.current = 60; powerRef.current = 0; livesRef.current = 3; comboRef.current = 0; xRef.current = 0.5; setX(0.5);
    dropsRef.current = []; floatiesRef.current = []; particlesRef.current = [];
  };

  const fetchAvatar = async () => {
    try {
      const h = sanitizeHandle(handle);
      if (!h) throw new Error("no-handle");
      const url = `/api/avatar?handle=${encodeURIComponent(h)}`; // same-origin proxy
      setAvatarUrl(url);
      await composeAvatar(url, glassesUrl);
      setDebug(`ok: ${url}`);
    } catch (e: any) {
      console.error("avatar-fetch-failed", e);
      setAvatarUrl(""); setComposedUrl("");
      setDebug(`error: ${String(e?.message || e)}`);
      alert("Avatar alınamadı. Kullanıcı adını (@ olmadan) doğru girdiğinden ve hesabın var/erişilebilir olduğundan emin ol.");
    }
  };

  const onLocalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAvatarUrl(url);
    composeAvatar(url, glassesUrl);
    setDebug(`local-file: ${file.name}`);
  };

  const composeAvatar = async (src?: string, gsrc?: string) => {
    const img = new Image(); img.crossOrigin = "anonymous"; img.src = src || avatarUrl;
    await new Promise((ok, err) => { img.onload = ok; img.onerror = err; });

    const size = 256; const c = document.createElement("canvas"); c.width = size; c.height = size; const ctx = c.getContext("2d")!;
    ctx.clearRect(0,0,size,size);
    ctx.save(); ctx.beginPath(); ctx.arc(size/2, size/2, size/2 - 2, 0, Math.PI*2); ctx.closePath(); ctx.clip();
    ctx.drawImage(img, 0, 0, size, size); ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(size/2, size/2, size/2 - 3, 0, Math.PI*2); ctx.stroke();

    const g = new Image(); g.crossOrigin = "anonymous"; g.src = gsrc || glassesUrl;
    try {
      await new Promise((ok, err) => { g.onload = ok; g.onerror = err; });
      ctx.save(); ctx.translate(size/2 + offX, size*0.48 + offY); ctx.rotate((rotate*Math.PI)/180);
      const targetW = 170 * scale; const targetH = 100 * scale; ctx.drawImage(g, -targetW/2, -targetH/2, targetW, targetH); ctx.restore();
    } catch {
      ctx.save(); ctx.translate(size/2 + offX, size*0.48 + offY); ctx.rotate((rotate*Math.PI)/180);
      const w = 180 * scale; const h = 95 * scale; const r = 40 * scale;
      ctx.fillStyle = "#0ea5e9"; roundRect(ctx, -w/2, -h/2, w, h, r); ctx.fill();
      ctx.fillStyle = "#fff"; const ew = 44*scale, eh = 70*scale, gap = 36*scale;
      roundRect(ctx, -ew-gap/2, -eh/2, ew, eh, 16*scale); ctx.fill(); roundRect(ctx, gap/2, -eh/2, ew, eh, 16*scale); ctx.fill();
      ctx.restore();
    }

    setComposedUrl(c.toDataURL("image/png"));
  };

  // Re-compose when tuning
  useEffect(() => { if (avatarUrl) composeAvatar(undefined, glassesUrl); /* eslint-disable-next-line */ }, [scale, offX, offY, rotate, glassesUrl]);

  // Stable game loop
  useEffect(() => {
    if (!running) return;
    const kd = (e: KeyboardEvent) => { if (KEY_LEFT.has(e.key)) keys.current.L = true; if (KEY_RIGHT.has(e.key)) keys.current.R = true; };
    const ku = (e: KeyboardEvent) => { if (KEY_LEFT.has(e.key)) keys.current.L = false; if (KEY_RIGHT.has(e.key)) keys.current.R = false; };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    let spawnAcc = 0;
    const step = (t: number) => {
      if (!running) return;
      if (last.current == null) last.current = t;
      const dt = Math.min(0.05, (t - last.current) / 1000);
      last.current = t;

      // time
      timeRef.current = timeRef.current > 0 ? Math.max(0, timeRef.current - dt) : 0;
      setTimeLeft(timeRef.current);

      // movement
      const speed = 1.3;
      let nx = xRef.current;
      const dir = (keys.current.R ? 1 : 0) - (keys.current.L ? 1 : 0);
      nx = clamp01(nx + dir * speed * dt);
      xRef.current = nx;
      setX(nx);

      // spawn
      spawnAcc += dt;
      const spawnEvery = Math.max(0.4, 1.1 - (60 - Math.max(0, timeRef.current)) * 0.018);
      if (spawnAcc >= spawnEvery) {
        spawnAcc = 0;
        const good = Math.random() > 0.28;
        const type = (good ? GOOD[Math.floor(Math.random() * GOOD.length)] : BAD[Math.floor(Math.random() * BAD.length)]) as Good | Bad;
        dropsRef.current.push({ id: Date.now() + Math.random(), x: Math.random(), y: -0.1, vy: 0.3 + Math.random() * 0.3, type, good });
      }

      // update drops
      dropsRef.current.forEach(d => (d.y += d.vy * dt));

      // particles
      particlesRef.current.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.5 * dt; p.life -= dt; });
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);

      // floaties
      floatiesRef.current.forEach(f => { f.y -= 0.25 * dt; f.life -= dt; });
      floatiesRef.current = floatiesRef.current.filter(f => f.life > 0);

      // collisions
      const PY = 0.88; const caught: number[] = [];
      for (const d of dropsRef.current) {
        if (Math.abs(d.y - PY) < 0.04 && Math.abs(d.x - nx) < 0.08) {
          caught.push(d.id);
          if (d.good) {
            const mult = 1 + Math.floor(comboRef.current / 5);
            const gain = 5 * mult;
            powerRef.current += gain; setPower(powerRef.current);
            comboRef.current += 1; setCombo(comboRef.current);
            addFloaty(`+${gain} POWER ×${mult}`, d.x, PY);
            burst(d.x, PY, d.type);
          } else {
            livesRef.current = Math.max(0, livesRef.current - 1); setLives(livesRef.current);
            comboRef.current = 0; setCombo(0);
            addFloaty("-life", d.x, PY);
            burst(d.x, PY, d.type);
          }
        }
      }
      if (caught.length) dropsRef.current = dropsRef.current.filter(d => !caught.includes(d.id));
      dropsRef.current = dropsRef.current.filter(d => d.y < 1.12);

      // end
      if (timeRef.current <= 0 || livesRef.current <= 0) {
        setRunning(false);
        last.current = null;
        setBest(b => { const n = Math.max(b, powerRef.current); localStorage?.setItem("billions_best", String(n)); return n; });
        setScreen("gameover");
        return;
      }

      requestAnimationFrame(step);
    };

    const raf = requestAnimationFrame(step);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      cancelAnimationFrame(raf);
      last.current = null;
    };
  }, [running]);

  const startGame = () => {
    reset();
    setScreen("play");
    setRunning(true);
    (document.activeElement as HTMLElement | null)?.blur();
  };

  const addFloaty = (text: string, x: number, y: number) => { floatiesRef.current.push({ id: Date.now() + Math.random(), text, x, y, life: 1.1 }); };
  const burst = (x: number, y: number, t: Good | Bad) => { for (let i=0;i<12;i++){ const a=Math.random()*Math.PI*2; const s=0.8+Math.random()*1.4; particlesRef.current.push({ id: Date.now()+Math.random(), x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, life: 0.6+Math.random()*0.5 }); } };

  const Logo = useMemo(() => () => (
    <div className="shrink-0 relative">
      <img src="/billions-logo.svg" alt="Billions" className="w-9 h-9 md:w-11 md:h-11" />
    </div>
  ), []);

  const shareOnX = () => {
    const text = encodeURIComponent(`I scored ${powerRef.current} POWER in Billions Neon! @billions_ntwk @traderibo123`);
    const url = typeof window !== "undefined" ? encodeURIComponent(window.location.href) : "";
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
  };

  // --- Render ---
  return (
    <div className="min-h-screen w-full bg-black text-white flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-5xl relative">
        {/* PARALLAX BG + VIGNETTE + SCANLINES */}
        <div className="absolute -z-10 inset-0 overflow-hidden rounded-[28px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,#0ea5e9_0,transparent_35%),radial-gradient(circle_at_80%_20%,#7c3aed_0,transparent_40%),radial-gradient(circle_at_50%_80%,#22c55e_0,transparent_35%)] opacity-30"/>
          <div className="absolute inset-0 animate-slowfloat bg-[radial-gradient(1200px_600px_at_20%_-10%,#0ea5e955_0,transparent_60%)]"/>
          <div className="absolute inset-0 animate-slowfloat2 bg-[radial-gradient(1000px_500px_at_120%_120%,#7c3aed55_0,transparent_60%)]"/>
          <div className="absolute inset-0 pointer-events-none" style={{background:"radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,.45) 100%)"}}/>
          <div className="absolute inset-0 pointer-events-none opacity-[.05]" style={{backgroundImage:"repeating-linear-gradient(0deg, rgba(255,255,255,.6) 0, rgba(255,255,255,.6) 1px, transparent 1px, transparent 3px)"}}/>
        </div>

        {/* HEADER */}
        <header className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Billions Neon — Avatar Game</h1>
              <p className="text-xs md:text-sm text-white/70 -mt-1">Custom avatar with Billions glasses • Catch verifiable items • Build combos</p>
            </div>
          </div>
          <div className="flex gap-2">
            {screen === "play" && (
              <button onClick={()=>{reset(); setRunning(true);}} className="px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-semibold">Restart</button>
            )}
          </div>
        </header>

        {/* SCREENS */}
        {screen === "intro" && <IntroScreen
          handle={handle} setHandle={setHandle}
          glassesUrl={glassesUrl} setGlassesUrl={setGlassesUrl}
          fetchAvatar={fetchAvatar} onLocalFile={onLocalFile}
          scale={scale} setScale={setScale}
          offX={offX} setOffX={setOffX}
          offY={offY} setOffY={setOffY}
          rotate={rotate} setRotate={setRotate}
          previewUrl={composedUrl || avatarUrl || "/default-avatar.png"}
          debug={debug}
          onStart={startGame}
        />}

        {screen === "play" && (
          <>
            {/* HUD */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
              <HUD label="POWER" value={String(power)} />
              <HUD label="Time" value={`${Math.ceil(timeRef.current)}s`} />
              <HUD label="Lives" value={"❤".repeat(lives) || "—"} />
              <HUD label="Best" value={String(best)} />
              <HUD label="Combo" value={`${combo} (${1 + Math.floor(combo/5)}x)`} />
            </div>

            {/* PLAYFIELD */}
            <div className="relative w-full aspect-[16/9] rounded-[28px] overflow-hidden border border-white/20 bg-white/5 shadow-[0_0_80px_#0ea5e955]">
              {/* subtle grid */}
              <div className="absolute inset-0 pointer-events-none opacity-[.08]" style={{backgroundImage:"linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg,#fff 1px, transparent 1px)", backgroundSize:"28px 28px"}} />

              {/* Player (avatar) */}
              <div className="absolute -translate-x-1/2" style={{ left: `${x * 100}%`, bottom: `6%` }}>
                {composedUrl ? (
                  <div className="w-28 h-28 md:w-32 md:h-32 rounded-full border border-white/40 shadow-[0_10px_40px_rgba(255,255,255,.35)]" style={{backgroundImage:`url(${composedUrl})`, backgroundSize:"cover", backgroundPosition:"center"}} />
                ) : (
                  <div className="w-28 h-28 md:w-32 md:h-32 rounded-full border border-white/40 bg-white/10 flex items-center justify-center text-4xl">🕶️</div>
                )}
                <div className="text-center text-[10px] text-white/60 mt-1">you</div>
              </div>

              {/* Drops */}
              {dropsRef.current.map(d => (<Token key={d.id} d={d} />))}
              {/* Floaties */}
              {floatiesRef.current.map(f => (<div key={f.id} className="absolute -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-white drop-shadow" style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, opacity: Math.max(0, Math.min(1, f.life)) }}>{f.text}</div>))}
              {/* Particles */}
              {particlesRef.current.map(p => (<div key={p.id} className="absolute -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/80" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, opacity: Math.max(0, Math.min(1, p.life)) }} />))}

              {/* Touch Controls */}
              <div className="absolute inset-x-0 bottom-1 flex items-center justify-between px-2 md:hidden">
                <button onTouchStart={()=>{ if(!running) return; keys.current.L = true; setTimeout(()=>keys.current.L=false, 60); }} className="px-6 py-3 rounded-2xl bg-white/10 border border-white/20">◀</button>
                <button onTouchStart={()=>{ if(!running) return; keys.current.R = true; setTimeout(()=>keys.current.R=false, 60); }} className="px-6 py-3 rounded-2xl bg-white/10 border border-white/20">▶</button>
              </div>
            </div>
          </>
        )}

        {screen === "gameover" && (
          <GameOverScreen
            power={powerRef.current}
            best={best}
            onRestart={startGame}
            onShare={shareOnX}
            onBackIntro={()=>setScreen("intro")}
          />
        )}

        <footer className="mt-4 text-xs text-white/60 text-center">Fan-made visual demo • Tag <span className="font-semibold text-white">@billions_ntwk</span>.</footer>
      </div>
    </div>
  );
}

// --- Screens ---
function IntroScreen(props: {
  handle: string; setHandle: (v:string)=>void;
  glassesUrl: string; setGlassesUrl: (v:string)=>void;
  fetchAvatar: ()=>void; onLocalFile: (e: any)=>void;
  scale: number; setScale: (n:number)=>void;
  offX: number; setOffX: (n:number)=>void;
  offY: number; setOffY: (n:number)=>void;
  rotate: number; setRotate: (n:number)=>void;
  previewUrl: string;
  debug: string;
  onStart: ()=>void;
}) {
  const {
    handle, setHandle, glassesUrl, setGlassesUrl,
    fetchAvatar, onLocalFile, scale, setScale,
    offX, setOffX, offY, setOffY, rotate, setRotate,
    previewUrl, debug, onStart
  } = props;

  return (
    <div className="rounded-[28px] border border-white/20 bg-white/5 p-4 shadow-[0_0_80px_#7c3aed55]">
      <div className="flex items-center gap-3 mb-1">
        <div className="text-3xl md:text-4xl font-black tracking-tight">Welcome to <span className="text-fuchsia-300 drop-shadow">Billions Neon</span></div>
      </div>
      <div className="text-xs text-white/70 mb-3">by <b>@traderibo123</b></div>
      <p className="text-sm text-white/70 mb-4">First, craft your hero: fetch your X avatar or upload one, then fit the <b>Billions glasses</b>. When ready, hit <b>Start</b>.</p>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Left: preview */}
        <div className="flex items-center gap-4">
          <div className="w-36 h-36 md:w-44 md:h-44 rounded-full overflow-hidden border border-white/30 shadow-[0_10px_40px_rgba(255,255,255,.25)]"
               style={{backgroundImage:`url(${previewUrl})`, backgroundSize:"cover", backgroundPosition:"center"}} />
          <div className="text-[10px] text-white/60">{debug}</div>
        </div>

        {/* Right: controls */}
        <div className="grid gap-3">
          <div className="grid md:grid-cols-3 gap-2 items-end">
            <div className="md:col-span-1">
              <label className="text-xs text-white/70">X Handle (without @)</label>
              <input value={handle} onChange={e=>setHandle(e.target.value)} placeholder="username" className="w-full mt-1 px-3 py-2 rounded-xl bg-white/10 border border-white/20" />
            </div>
            <div className="md:col-span-1">
              <label className="text-xs text-white/70">Glasses PNG path (public/)</label>
              <input value={glassesUrl} onChange={e=>setGlassesUrl(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl bg-white/10 border border-white/20" />
            </div>
            <div className="flex gap-2">
              <button onClick={fetchAvatar} className="px-3 py-2 rounded-2xl bg-white text-black font-semibold">Load Avatar</button>
              <label className="px-3 py-2 rounded-2xl bg-white/10 border border-white/20 text-sm cursor-pointer">
                Upload
                <input type="file" accept="image/*" onChange={onLocalFile} className="hidden"/>
              </label>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-3">
            <Range label="Scale" value={scale} min={0.7} max={1.8} step={0.01} onChange={setScale} />
            <Range label="Offset X" value={offX} min={-60} max={60} step={1} onChange={setOffX} />
            <Range label="Offset Y" value={offY} min={-60} max={60} step={1} onChange={setOffY} />
            <Range label="Rotate" value={rotate} min={-30} max={30} step={0.5} onChange={setRotate} />
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center">
        <button onClick={onStart} className="px-6 py-3 rounded-2xl bg-white text-black font-bold shadow hover:scale-[1.02] transition">Start</button>
      </div>
    </div>
  );
}

function GameOverScreen(props: { power: number; best: number; onRestart: ()=>void; onShare: ()=>void; onBackIntro: ()=>void }) {
  const { power, best, onRestart, onShare, onBackIntro } = props;
  return (
    <div className="rounded-[28px] border border-white/20 bg-white/5 p-6 shadow-[0_0_80px_#22c55e55] text-center">
      <h2 className="text-3xl font-extrabold mb-1">Run Complete</h2>
      <div className="text-xs text-white/70 mb-2">by <b>@traderibo123</b></div>
      <div className="text-sm text-white/80">Total POWER</div>
      <div className="text-5xl font-black my-2">{power}</div>
      <div className="text-xs text-white/60 mb-4">Best: <b>{best}</b></div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button onClick={onShare} className="px-4 py-2 rounded-2xl bg-white text-black font-semibold">Share on X</button>
        <button onClick={onRestart} className="px-4 py-2 rounded-2xl bg-white/10 border border-white/20 font-semibold">Play again</button>
        <button onClick={onBackIntro} className="px-4 py-2 rounded-2xl bg-white/10 border border-white/20 font-semibold">Back to Intro</button>
      </div>
    </div>
  );
}

// --- Building blocks ---
function Token({ d }: { d: Drop }) {
  const grad = COLORS[d.type]; const label = LABELS[d.type]; const icon = ICONS[d.type];
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%` }} title={label}>
      <div className={`w-9 h-9 md:w-11 md:h-11 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center shadow-[0_8px_30px_rgba(255,255,255,.15)] ring-2 ring-white/40`}>
        <span className="text-base md:text-lg drop-shadow">{icon}</span>
      </div>
    </div>
  );
}
function HUD({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 border border-white/20 shadow px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-white/60">{label}</div>
      <div className="text-lg font-bold leading-none">{value}</div>
    </div>
  );
}
function Range({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number)=>void }) {
  return (
    <label className="grid gap-1 text-xs text-white/70">
      <span>{label}: <b className="text-white">{typeof value === 'number' ? value.toFixed(2) : value}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e)=>onChange(parseFloat((e.target as HTMLInputElement).value))} className="appearance-none w-full h-2 rounded bg-white/10 accent-white" />
    </label>
  );
}
function roundRect(ctx: CanvasRenderingContext2D, x:number,y:number,w:number,h:number,r:number){
  const rr = Math.min(r, w/2, h/2); ctx.beginPath(); ctx.moveTo(x+rr,y); ctx.arcTo(x+w,y,x+w,y+h,rr); ctx.arcTo(x+w,y+h,x,y+h,rr); ctx.arcTo(x,y+h,x,y,rr); ctx.arcTo(x,y,x+w,y,rr); ctx.closePath();
}

// Tiny style helpers
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.innerHTML = `
    .kbd{background:#ffffff18;border:1px solid #fff3;padding:2px 6px;border-radius:6px;font-weight:600}
    @keyframes slowfloat { from{transform:translateY(0)} to{ transform:translateY(40px)} }
    .animate-slowfloat{ animation: slowfloat 8s ease-in-out infinite alternate; }
    @keyframes slowfloat2 { from{transform:translate(-20px,0)} to{ transform:translate(0,20px)} }
    .animate-slowfloat2{ animation: slowfloat2 10s ease-in-out infinite alternate; }
  `;
  document.head.appendChild(style);
}
