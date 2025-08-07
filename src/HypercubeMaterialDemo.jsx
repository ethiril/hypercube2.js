import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Tooltip,
  Drawer,
  Box,
  Divider,
  Slider,
  Switch,
  FormControlLabel,
  Card,
  CardContent,
  Button,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Select,
  MenuItem,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import FitScreenIcon from "@mui/icons-material/FitScreen";
import Grid4x4Icon from "@mui/icons-material/Grid4x4";
import WidgetsIcon from "@mui/icons-material/Widgets";

// ---------------------------------------------------------------------------
// Math utils
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const lerp = (a, b, t) => a + (b - a) * t;

function hammingDiffIndex(a, b) {
  let idx = -1, count = 0;
  for (let i = 0; i < 4; i++) if (a[i] !== b[i]) { idx = i; count++; if (count > 1) return -1; }
  return count === 1 ? idx : -1;
}

function mulMat4Vec4(m, v) {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2] + m[3] * v[3],
    m[4] * v[0] + m[5] * v[1] + m[6] * v[2] + m[7] * v[3],
    m[8] * v[0] + m[9] * v[1] + m[10] * v[2] + m[11] * v[3],
    m[12] * v[0] + m[13] * v[1] + m[14] * v[2] + m[15] * v[3],
  ];
}

function mulMat4(a, b) {
  const o = new Array(16).fill(0);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++)
    o[r * 4 + c] = a[r * 4 + 0] * b[0 * 4 + c] + a[r * 4 + 1] * b[1 * 4 + c] + a[r * 4 + 2] * b[2 * 4 + c] + a[r * 4 + 3] * b[3 * 4 + c];
  return o;
}

function rotMat4(i, j, theta) {
  const m = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  const c = Math.cos(theta), s = Math.sin(theta);
  m[i * 4 + i] = c;   m[i * 4 + j] = -s;
  m[j * 4 + i] = s;   m[j * 4 + j] = c;
  return m;
}

function buildRotationMatrix(a) {
  const order = [ [0,1,a.xy], [0,2,a.xz], [0,3,a.xw], [1,2,a.yz], [1,3,a.yw], [2,3,a.zw] ];
  return order.reduce((acc,[i,j,t]) => mulMat4(acc, rotMat4(i,j,t)), [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
}

function makeTesseract() {
  const verts = [];
  for (let x of [-1,1]) for (let y of [-1,1]) for (let z of [-1,1]) for (let w of [-1,1]) verts.push([x,y,z,w]);
  const edges = [];
  for (let i=0;i<verts.length;i++) for (let j=i+1;j<verts.length;j++){
    const idx = hammingDiffIndex(verts[i], verts[j]);
    if (idx !== -1) edges.push([i,j,idx]);
  }
  return { verts, edges };
}

// Nice accent presets (Material-ish)
const PRESETS = {
  IndigoMint: { primary: "#7C83FF", secondary: "#2DD4BF", bg: "#0E1116", paper: "#161B22" },
  FuchsiaCyan: { primary: "#C084FC", secondary: "#22D3EE", bg: "#0B0F14", paper: "#141923" },
  AmberTeal: { primary: "#FFB300", secondary: "#26A69A", bg: "#0E0F12", paper: "#191C23" },
  RoseLime: { primary: "#F472B6", secondary: "#A3E635", bg: "#0F1014", paper: "#171A21" },
  SlateBlue: { primary: "#60A5FA", secondary: "#A78BFA", bg: "#0A0C10", paper: "#121721" },
};

// ---------------------------------------------------------------------------
export default function HypercubeMaterialDemo() {
  // UI state
  const [open, setOpen] = useState(true);
  const [dark, setDark] = useState(true);
  const [preset, setPreset] = useState("IndigoMint");
  const palette = PRESETS[preset];

  // Render state
  const [auto, setAuto] = useState(true);
  const [lock4D, setLock4D] = useState(false); // keep 4D shape, only spin in 3D
  const [speed3, setSpeed3] = useState(0.8);
  const [speed4, setSpeed4] = useState(0.35);
  const [scale, setScale] = useState(220);
  const [d4, setD4] = useState(3.2);
  const [d3, setD3] = useState(3.6);
  const [persp4D, setPersp4D] = useState(true);
  const [persp3D, setPersp3D] = useState(true);
  const [showVerts, setShowVerts] = useState(true);
  const [thickness, setThickness] = useState(2.2);
  const [vertSize, setVertSize] = useState(3.2);

  // Modes
  const [mode, setMode] = useState("standard"); // "standard" | "schlegel"

  const [angles, setAngles] = useState({ xy: 0.2, xz: 0.4, xw: 0.7, yz: 0.1, yw: 0.3, zw: 0.0 });

  const theme = useMemo(() => createTheme({
    palette: {
      mode: dark ? "dark" : "light",
      primary: { main: palette.primary },
      secondary: { main: palette.secondary },
      background: { default: palette.bg, paper: palette.paper },
    },
    shape: { borderRadius: 18 },
    typography: { fontFamily: "Inter, Roboto, system-ui, Arial, sans-serif" },
  }), [dark, palette]);

  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const lastRef = useRef(performance.now());
  const dragRef = useRef({ dragging: false, x: 0, y: 0, alt: false, shift: false });

  const { verts, edges } = useMemo(() => makeTesseract(), []);
  const edgeColors = useMemo(() => [ theme.palette.primary.main, theme.palette.secondary.main, dark?"#FFB74D":"#E65100", dark?"#81C784":"#1B5E20" ], [theme, dark]);

  const projected = useMemo(() => ({
    compute: (ang) => {
      const m = buildRotationMatrix(ang);
      const pts3 = verts.map((v) => mulMat4Vec4(m, v));
      // 4D -> 3D perspective or ortho
      const pts3p = pts3.map(([x,y,z,w]) => {
        const k4 = persp4D ? d4 / Math.max(0.1, d4 - w) : 1;
        return [x*k4, y*k4, z*k4];
      });
      return pts3p;
    },
  }), [verts, d4, persp4D]);

  function draw() {
    const cvs = canvasRef.current; if (!cvs) return;
    const ctx = cvs.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = cvs.clientWidth * dpr, h = cvs.clientHeight * dpr;
    if (cvs.width !== w || cvs.height !== h) { cvs.width = w; cvs.height = h; }

    // backdrop
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,w,h);
    const grad = ctx.createRadialGradient(w*0.7,h*0.3,0,w*0.7,h*0.3, Math.max(w,h));
    grad.addColorStop(0, theme.palette.mode==='dark' ? "#0b0d12" : "#f7f7fb");
    grad.addColorStop(1, theme.palette.background.default);
    ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);

    const pts3 = projected.compute(angles);
    const pts2 = pts3.map(([x,y,z]) => {
      const k3 = persp3D ? d3 / Math.max(0.1, d3 - z) : 1;
      return [x*k3*scale + w/2, y*k3*scale + h/2, z];
    });

    // edges
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const [i,j,dimIdx] of edges) {
      const [x1,y1,z1] = pts2[i];
      const [x2,y2,z2] = pts2[j];
      const depth = 1 - Math.min(1, Math.max(-1, (z1+z2)*0.25));
      ctx.lineWidth = thickness + depth * thickness;
      ctx.strokeStyle = edgeColors[dimIdx % edgeColors.length];
      ctx.globalAlpha = 0.95;
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    }

    if (showVerts) {
      for (const [x,y,z] of pts2) {
        const r = vertSize + (1 - Math.min(1, Math.max(-1, z*0.25))) * (vertSize*0.8);
        ctx.beginPath();
        ctx.fillStyle = theme.palette.mode==='dark' ? "#fff" : "#111";
        ctx.globalAlpha = 1; ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
      }
    }
  }

  // Animation loop
  useEffect(() => {
    const tick = (t) => {
      const dt = (t - lastRef.current) / 1000; lastRef.current = t;
      if (auto) {
        setAngles((a) => ({
          xy: a.xy + speed3 * dt * 0.8,
          xz: a.xz + speed3 * dt * 0.6,
          yz: a.yz + speed3 * dt * 0.5,
          xw: lock4D ? a.xw : a.xw + speed4 * dt * 0.7,
          yw: lock4D ? a.yw : a.yw + speed4 * dt * 0.5,
          zw: lock4D ? a.zw : a.zw + speed4 * dt * 0.4,
        }));
      } else {
        draw();
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
    // eslint-disable-next-line
  }, [auto, speed3, speed4, lock4D, d3, d4, scale, persp3D, persp4D, showVerts, thickness, vertSize, edgeColors]);

  useEffect(() => { draw(); }, [angles, dark, preset]);

  // Interactions
  useEffect(() => {
    const cvs = canvasRef.current; if (!cvs) return;
    const onDown = (e) => {
      dragRef.current.dragging = true;
      dragRef.current.x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      dragRef.current.y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
      dragRef.current.alt = e.altKey || e.ctrlKey || false;
      dragRef.current.shift = e.shiftKey || false;
    };
    const onMove = (e) => {
      if (!dragRef.current.dragging) return;
      const nx = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      const ny = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
      const dx = nx - dragRef.current.x; const dy = ny - dragRef.current.y;
      dragRef.current.x = nx; dragRef.current.y = ny;
      const k = 0.0075;
      setAngles((a) => {
        if (dragRef.current.alt) {
          return { ...a, xw: a.xw + dx*k, yw: a.yw + dy*k };
        } else if (dragRef.current.shift) {
          return { ...a, xz: a.xz + dx*k, yz: a.yz + dy*k };
        }
        return { ...a, xy: a.xy + dx*k, yz: a.yz + dy*k };
      });
    };
    const onUp = () => (dragRef.current.dragging = false);
    const onWheel = (e) => { e.preventDefault(); const d = Math.sign(e.deltaY); setScale((s) => clamp(s*(1 - d*0.08), 80, 1200)); };

    cvs.addEventListener("mousedown", onDown);
    cvs.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    cvs.addEventListener("touchstart", onDown, { passive: true });
    cvs.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);
    cvs.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cvs.removeEventListener("mousedown", onDown);
      cvs.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      cvs.removeEventListener("touchstart", onDown);
      cvs.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
      cvs.removeEventListener("wheel", onWheel);
    };
  }, []);

  // Helpers
  const fitToView = () => {
    // Try to choose scale that uses ~80% of canvas
    const cvs = canvasRef.current; if (!cvs) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cvs.clientWidth * dpr, h = cvs.clientHeight * dpr;
    const pts3 = projected.compute(angles);
    const pts2 = pts3.map(([x,y,z]) => { const k3 = persp3D ? d3/Math.max(0.1, d3 - z) : 1; return [x*k3, y*k3]; });
    const xs = pts2.map(p=>p[0]), ys = pts2.map(p=>p[1]);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    const sx = (w*0.75)/(maxx-minx), sy = (h*0.75)/(maxy-miny);
    setScale(clamp(Math.min(sx,sy), 60, 1400));
  };

  const goSchlegel = () => {
    setMode("schlegel");
    setAngles({ xy: 0, xz: 0, yz: 0, xw: 0, yw: 0, zw: 0 });
    setPersp4D(true); setPersp3D(false); setD4(3.0); setScale(260); setLock4D(true);
  };

  const goStandard = () => {
    setMode("standard"); setLock4D(false); setPersp3D(true); setPersp4D(true);
  };

  const reset = () => {
    setAngles({ xy: 0.2, xz: 0.4, xw: 0.7, yz: 0.1, yw: 0.3, zw: 0.0 });
    setScale(220); setD4(3.2); setD3(3.6); setPersp4D(true); setPersp3D(true);
    setLock4D(false); setMode("standard");
  };

  // Layout -------------------------------------------------------------------
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="sticky" color="transparent" elevation={0}
        sx={{ backdropFilter: "saturate(180%) blur(8px)", background: "transparent", borderBottom: (t)=>`1px solid ${t.palette.mode==='dark'?'#20242c':'#e6e8ef'}` }}>
        <Toolbar sx={{ gap: 1 }}>
          <IconButton onClick={() => setOpen(o=>!o)}><MenuIcon /></IconButton>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Tesseract Lab</Typography>
          <Chip label={mode === 'schlegel' ? 'Cube-in-cube' : 'Standard'} size="small" color="primary" sx={{ ml: 1 }}/>
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title="Fit to view"><IconButton onClick={fitToView}><FitScreenIcon/></IconButton></Tooltip>
          <Tooltip title={dark?"Light mode":"Dark mode"}><IconButton onClick={()=>setDark(d=>!d)}>{dark?<Brightness7Icon/>:<Brightness4Icon/>}</IconButton></Tooltip>
          <Tooltip title="About"><IconButton href="#about"><InfoOutlinedIcon/></IconButton></Tooltip>
        </Toolbar>
      </AppBar>

      {/* Side controls */}
      <Drawer variant="persistent" anchor="left" open={open} PaperProps={{ sx: { width: 360, border: 0, p: 0, backgroundImage: 'none' } }}>
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Controls</Typography>
          <Card elevation={0} sx={{ background: theme.palette.background.paper, borderRadius: 3, mb: 2 }}>
            <CardContent>
              <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:1 }}>
                <FormControlLabel control={<Switch checked={auto} onChange={(e)=>setAuto(e.target.checked)} />} label="Auto-rotate" />
                <Button size="small" startIcon={<RestartAltIcon/>} onClick={reset}>Reset</Button>
              </Box>
              <Typography variant="body2" sx={{ mb: .5 }}>Mode</Typography>
              <ToggleButtonGroup exclusive value={mode} onChange={(_,v)=>v && (v==='schlegel'?goSchlegel():goStandard())} size="small" sx={{ mb: 2 }}>
                <ToggleButton value="standard"><WidgetsIcon sx={{ mr: 1 }}/><span>Standard</span></ToggleButton>
                <ToggleButton value="schlegel"><Grid4x4Icon sx={{ mr: 1 }}/><span>Cube-in-cube</span></ToggleButton>
              </ToggleButtonGroup>

              <FormControlLabel control={<Switch checked={lock4D} onChange={(e)=>setLock4D(e.target.checked)} />} label="Lock 4D shape (spin only in 3D)" />

              <Divider sx={{ my: 2 }} />

              <Typography variant="body2">3D Speed</Typography>
              <Slider value={speed3} min={0} max={2} step={0.01} onChange={(_,v)=>setSpeed3(v)} sx={{ mb: 1 }} />
              <Typography variant="body2">4D Speed</Typography>
              <Slider value={speed4} min={0} max={2} step={0.01} onChange={(_,v)=>setSpeed4(v)} sx={{ mb: 2 }} />

              <Typography variant="body2">Scale</Typography>
              <Slider value={scale} min={80} max={1200} step={1} onChange={(_,v)=>setScale(v)} sx={{ mb: 1 }} />

              <FormControlLabel control={<Switch checked={persp4D} onChange={(e)=>setPersp4D(e.target.checked)} />} label="4D Perspective" />
              <Typography variant="caption" sx={{ display:'block' }}>4D Camera Distance: {d4.toFixed(2)}</Typography>
              <Slider value={d4} min={2} max={8} step={0.05} onChange={(_,v)=>setD4(v)} sx={{ mb: 1 }} />

              <FormControlLabel control={<Switch checked={persp3D} onChange={(e)=>setPersp3D(e.target.checked)} />} label="3D Perspective" />
              <Typography variant="caption" sx={{ display:'block' }}>3D Camera Distance: {d3.toFixed(2)}</Typography>
              <Slider value={d3} min={2} max={8} step={0.05} onChange={(_,v)=>setD3(v)} sx={{ mb: 2 }} />

              <Divider sx={{ my: 2 }} />
              <FormControlLabel control={<Switch checked={showVerts} onChange={(e)=>setShowVerts(e.target.checked)} />} label="Show Vertices" />
              <Typography variant="body2">Edge Thickness</Typography>
              <Slider value={thickness} min={0.6} max={5} step={0.1} onChange={(_,v)=>setThickness(v)} sx={{ mb: 1 }} />
              <Typography variant="body2">Vertex Size</Typography>
              <Slider value={vertSize} min={0} max={6} step={0.1} onChange={(_,v)=>setVertSize(v)} />
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ background: theme.palette.background.paper, borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight:700, mb:1 }}>Theme</Typography>
              <Typography variant="body2" sx={{ mb: .5 }}>Accent preset</Typography>
              <Select fullWidth size="small" value={preset} onChange={(e)=>setPreset(e.target.value)} sx={{ mb: 1 }}>
                {Object.keys(PRESETS).map(k => <MenuItem key={k} value={k}>{k}</MenuItem>)}
              </Select>
              <FormControlLabel control={<Switch checked={dark} onChange={(e)=>setDark(e.target.checked)} />} label="Dark Mode" />
            </CardContent>
          </Card>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display:'block' }}>
            Tip: Drag to rotate (XY/YZ). Hold <b>Alt/Ctrl</b> for XW/YW, <b>Shift</b> for XZ/YZ. Scroll to zoom.
          </Typography>
        </Box>
      </Drawer>

      {/* Canvas area */}
      <Box sx={{ pl: open ? 36 : 0, transition: 'padding-left .25s ease' }}>
        <Box sx={{ position: 'relative', height: 'calc(100vh - 64px)' }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

          {/* Floating controls */}
          <Box sx={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', gap: 1 }}>
            <Button variant="contained" startIcon={auto? <PauseIcon/> : <PlayArrowIcon/>} onClick={()=>setAuto(a=>!a)}>{auto? 'Pause':'Play'}</Button>
            <Button variant="outlined" startIcon={<FitScreenIcon/>} onClick={fitToView}>Fit</Button>
            {mode==='standard' ? (
              <Button variant="outlined" startIcon={<Grid4x4Icon/>} onClick={goSchlegel}>Cube-in-cube</Button>
            ) : (
              <Button variant="outlined" startIcon={<WidgetsIcon/>} onClick={goStandard}>Standard</Button>
            )}
          </Box>
        </Box>

        <Box id="about" sx={{ p: 2 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>What are you seeing?</Typography>
              <Typography variant="body2" color="text.secondary">
                This is an interactive 4D hypercube (tesseract). The classic <i>cube‑in‑cube</i> view is a Schlegel‑style perspective projection from 4D to 3D (enabled via the “Cube‑in‑cube” mode). Use “Lock 4D shape” to keep that phase while spinning only in 3D.
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </ThemeProvider>
  );
}