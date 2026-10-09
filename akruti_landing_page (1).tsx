import React, { useState, useEffect, useRef } from 'react';
import { Box, Maximize, Sliders, ArrowRight, Menu, X, Move3d, Layers, Cuboid, Scan } from 'lucide-react';

const customStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500&display=swap');

  body {
    font-family: 'Inter', sans-serif;
    background-color: #09090b; /* zinc-950 */
    color: #fafaf9; /* stone-50 */
    overflow-x: hidden;
  }

  @keyframes float {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-15px); }
    100% { transform: translateY(0px); }
  }
  
  @keyframes float-slow {
    0% { transform: translateY(0px) rotateX(0) rotateY(0); }
    50% { transform: translateY(-8px) rotateX(2deg) rotateY(-2deg); }
    100% { transform: translateY(0px) rotateX(0) rotateY(0); }
  }

  @keyframes pulse-glow {
    0% { opacity: 0.1; transform: scale(1) translate(-50%, -50%); }
    50% { opacity: 0.3; transform: scale(1.1) translate(-50%, -50%); }
    100% { opacity: 0.1; transform: scale(1) translate(-50%, -50%); }
  }

  .animate-float {
    animation: float 6s ease-in-out infinite;
  }

  .animate-float-slow {
    animation: float-slow 12s ease-in-out infinite;
  }

  .reveal-hidden {
    opacity: 0;
    transform: translateY(50px);
    transition: all 1.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .reveal-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .perspective-container {
    perspective: 1500px;
  }

  .glass-panel {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  /* Custom grid background for spatial feel */
  .bg-grid {
    background-image: linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
                      linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: 50px 50px;
  }
`;

const useScrollReveal = (threshold = 0.1) => {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold, rootMargin: '0px 0px -50px 0px' }
    );

    if (ref.current) observer.observe(ref.current);
    return () => { if (ref.current) observer.unobserve(ref.current); };
  }, [threshold]);

  return [ref, isVisible];
};

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 py-6 px-8 md:px-12 flex justify-between items-center
      ${scrolled ? 'bg-zinc-950/80 backdrop-blur-md border-b border-white/5 py-4' : 'bg-transparent'}`}>
      <div className="flex items-center gap-2 z-50">
        <Cuboid className="w-6 h-6 text-stone-300" />
        <span className="text-xl font-light tracking-[0.2em] uppercase text-stone-100">
          Akruti<span className="text-stone-500">.</span>
        </span>
      </div>
      
      {/* Desktop */}
      <div className="hidden md:flex items-center space-x-10 text-xs tracking-[0.15em] uppercase text-stone-400 font-medium">
        <a href="#vision" className="hover:text-stone-100 transition-colors">Vision</a>
        <a href="#demo" className="hover:text-stone-100 transition-colors">Experience</a>
        <a href="#value" className="hover:text-stone-100 transition-colors">Value</a>
        <button className="relative group overflow-hidden border border-stone-700 px-6 py-2.5 rounded-full text-stone-100 hover:border-stone-400 transition-colors duration-300">
          <span className="relative z-10">Request Access</span>
          <div className="absolute inset-0 bg-stone-100 transform scale-x-0 origin-left group-hover:scale-x-100 transition-transform duration-500 ease-out z-0"></div>
          <span className="relative z-10 group-hover:text-zinc-950 transition-colors duration-500">Request Access</span>
        </button>
      </div>

      {/* Mobile Toggle */}
      <button className="md:hidden z-50 text-stone-300" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile Menu */}
      <div className={`fixed inset-0 bg-zinc-950/95 backdrop-blur-xl z-40 flex flex-col items-center justify-center space-y-8 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <a href="#vision" onClick={() => setIsOpen(false)} className="text-xl tracking-[0.2em] uppercase text-stone-300">Vision</a>
        <a href="#demo" onClick={() => setIsOpen(false)} className="text-xl tracking-[0.2em] uppercase text-stone-300">Experience</a>
        <button className="border border-stone-500 px-8 py-3 rounded-full text-stone-100 tracking-widest uppercase text-sm mt-4">
          Request Access
        </button>
      </div>
    </nav>
  );
};

const HeroSection = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const { left, top, width, height } = containerRef.current.getBoundingClientRect();
    // Calculate relative mouse position (-1 to 1)
    const x = ((e.clientX - left) / width - 0.5) * 2;
    const y = ((e.clientY - top) / height - 0.5) * 2;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    // Reset to center smoothly
    setMousePos({ x: 0, y: 0 });
  };

  return (
    <section 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full h-screen min-h-[800px] flex items-center justify-center overflow-hidden bg-grid perspective-container"
    >
      {/* Ambient Lighting */}
      <div className="absolute top-1/2 left-1/2 w-[80vw] h-[80vw] bg-stone-500/10 rounded-full blur-[150px] animate-pulse-glow pointer-events-none" />
      <div className="absolute bottom-0 w-full h-64 bg-gradient-to-t from-zinc-950 to-transparent z-10" />

      {/* Background Typography */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] select-none pointer-events-none pointer-events-none z-0">
        <h1 className="text-[15vw] font-bold tracking-tighter whitespace-nowrap">SPATIAL</h1>
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 grid lg:grid-cols-12 gap-8 items-center pt-20">
        
        {/* Text Content */}
        <div className="lg:col-span-5 flex flex-col items-start z-20 order-2 lg:order-1 mt-12 lg:mt-0">
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full glass-panel text-xs tracking-widest uppercase text-stone-300 mb-8 border-white/10">
            <Scan size={14} className="text-stone-100" />
            <span>Interactive Spatial Commerce</span>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-light tracking-tighter leading-[1.1] mb-6 text-stone-100">
            Feel the space.<br/>
            <span className="text-stone-500">Know the fit.</span>
          </h1>
          <p className="text-stone-400 text-lg font-light leading-relaxed mb-10 max-w-md">
            Transform your furniture catalog into immersive 3D and AR experiences. Build absolute buyer confidence before the purchase.
          </p>
          <div className="flex items-center gap-6">
            <button className="bg-stone-100 text-zinc-950 px-8 py-4 rounded-full text-sm font-medium tracking-wide hover:bg-stone-300 transition-colors flex items-center gap-2">
              Explore Platform <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* 3D Interactive Showcase */}
        <div className="lg:col-span-7 relative h-[50vh] lg:h-[70vh] w-full order-1 lg:order-2 flex items-center justify-center">
          
          {/* Interactive Wrapper */}
          <div 
            className="relative w-full max-w-2xl aspect-square md:aspect-[4/3] transition-transform duration-700 ease-out flex items-center justify-center"
            style={{ 
              transform: `rotateX(${-mousePos.y * 15}deg) rotateY(${mousePos.x * 15}deg) translateZ(50px)`,
              transformStyle: 'preserve-3d'
            }}
          >
            {/* Soft Shadow Base */}
            <div 
              className="absolute bottom-[10%] w-3/4 h-8 bg-black/60 rounded-[100%] blur-xl transition-transform duration-700 ease-out"
              style={{ transform: `translateX(${-mousePos.x * 20}px) translateY(${mousePos.y * 20}px)` }}
            />
            
            {/* Premium Furniture Image (Isolated look) */}
            <img 
              src="https://images.unsplash.com/photo-1555041469-a586c61ea9bc?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80" 
              alt="Premium Emerald Sofa" 
              className="relative z-10 w-full h-auto object-cover rounded-2xl shadow-2xl animate-float-slow"
              style={{
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                transform: 'translateZ(80px)'
              }}
            />

            {/* UI Overlay Elements simulating software */}
            <div 
              className="absolute top-[15%] -right-[5%] glass-panel px-4 py-2 rounded-xl flex items-center gap-3 shadow-2xl z-20"
              style={{ transform: 'translateZ(120px)' }}
            >
              <div className="w-8 h-8 rounded-full bg-emerald-900/50 border border-emerald-500/30 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-stone-400 uppercase tracking-wider">Fabric Match</span>
                <span className="text-xs text-stone-100">Velvet Emerald</span>
              </div>
            </div>

            <div 
              className="absolute bottom-[20%] -left-[5%] glass-panel px-4 py-3 rounded-xl flex items-center gap-3 shadow-2xl z-20"
              style={{ transform: 'translateZ(100px)' }}
            >
              <Move3d className="text-stone-400" size={20} />
              <div className="flex flex-col">
                <span className="text-[10px] text-stone-400 uppercase tracking-wider">Dimensions</span>
                <span className="text-xs text-stone-100">84"W × 38"D × 34"H</span>
              </div>
            </div>
            
            {/* Hint */}
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-stone-500 text-xs tracking-widest uppercase flex items-center gap-2 opacity-60">
              <Move3d size={14} /> Move mouse to explore
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

const VisionSection = () => {
  const [ref1, isVis1] = useScrollReveal();
  const [ref2, isVis2] = useScrollReveal(0.2);

  return (
    <section id="vision" className="py-32 px-6 md:px-12 bg-zinc-950 relative overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 md:gap-8 items-center">
          
          {/* Problem */}
          <div ref={ref1} className={`reveal-hidden ${isVis1 ? 'reveal-visible' : ''}`}>
            <p className="text-stone-500 uppercase tracking-[0.2em] text-sm mb-6 font-medium">The Uncertainty</p>
            <h2 className="text-4xl md:text-5xl font-light tracking-tighter text-stone-400 leading-tight mb-6">
              "Will it fit? <br/>
              How will it look?"
            </h2>
            <p className="text-stone-500 font-light leading-relaxed">
              Traditional flat images leave customers guessing. They hesitate, abandon carts, or return items that don't match their space.
            </p>
          </div>

          {/* Solution */}
          <div ref={ref2} className={`reveal-hidden border-l border-stone-800 pl-8 md:pl-16 ${isVis2 ? 'reveal-visible' : ''}`}>
            <div className="text-stone-300 uppercase tracking-[0.2em] text-sm mb-6 font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-stone-300" /> The Akruti Standard
            </div>
            <h2 className="text-4xl md:text-5xl font-light tracking-tighter text-stone-50 leading-tight mb-6">
              Total spatial <br/> confidence.
            </h2>
            <p className="text-stone-400 font-light leading-relaxed">
              We replace imagination with reality. Let your customers place, configure, and experience your products in their exact environment before they buy.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
};

const ConfiguratorDemo = () => {
  const [ref, isVis] = useScrollReveal();
  const [activeColor, setActiveColor] = useState(0);
  
  const swatches = [
    { name: 'Oatmeal', filter: 'sepia(30%) hue-rotate(-10deg) brightness(110%) saturate(60%)', hex: '#E5D9C5' },
    { name: 'Charcoal', filter: 'grayscale(100%) brightness(60%) contrast(120%)', hex: '#4A4A4A' },
    { name: 'Terracotta', filter: 'sepia(60%) hue-rotate(-25deg) saturate(180%) brightness(90%)', hex: '#C05A3E' },
    { name: 'Navy', filter: 'sepia(100%) hue-rotate(180deg) saturate(200%) brightness(60%)', hex: '#2C3E50' }
  ];

  return (
    <section id="demo" className="py-32 px-6 md:px-12 bg-[#0c0c0e] border-y border-white/5 relative">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-16 items-center">
        
        {/* Info */}
        <div ref={ref} className={`lg:w-1/3 reveal-hidden ${isVis ? 'reveal-visible' : ''}`}>
          <div className="inline-flex items-center gap-2 text-xs tracking-widest uppercase text-stone-400 mb-6">
            <Layers size={14} /> <span>Live Configuration</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-light tracking-tighter text-stone-50 leading-tight mb-6">
            Endless variations. <br/> Zero friction.
          </h2>
          <p className="text-stone-400 font-light leading-relaxed mb-10">
            Digitize your entire catalog instantly. Allow users to swap fabrics, materials, and finishes in real-time, generating photorealistic visualizations on the fly.
          </p>

          {/* Controls */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium tracking-wider uppercase text-stone-300">Select Material</h4>
            <div className="flex gap-4">
              {swatches.map((swatch, idx) => (
                <button 
                  key={idx}
                  onClick={() => setActiveColor(idx)}
                  className={`group flex flex-col items-center gap-2 transition-all`}
                >
                  <div 
                    className={`w-10 h-10 rounded-full transition-all duration-300 ${activeColor === idx ? 'ring-2 ring-stone-100 ring-offset-2 ring-offset-[#0c0c0e] scale-110' : 'opacity-70 hover:opacity-100'}`}
                    style={{ backgroundColor: swatch.hex }}
                  />
                  <span className={`text-[10px] tracking-wider uppercase ${activeColor === idx ? 'text-stone-100' : 'text-stone-600'}`}>
                    {swatch.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Demo Window */}
        <div className="lg:w-2/3 w-full relative aspect-square md:aspect-video rounded-3xl overflow-hidden glass-panel flex items-center justify-center p-8 group">
          <div className="absolute inset-0 bg-gradient-to-tr from-black/40 to-transparent pointer-events-none z-10" />
          
          <img 
            src="https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
            alt="Configurable Chair"
            className="w-full h-full object-cover rounded-xl transition-all duration-1000 ease-in-out"
            style={{ 
              filter: swatches[activeColor].filter,
              transform: 'scale(1.02)' // Slight scale to avoid edge artifacts during transition
            }}
          />

          {/* Software UI Mockup overlay */}
          <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-20">
            <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] tracking-widest uppercase text-stone-300 border border-white/10">
              High-Fidelity Render
            </div>
            <div className="flex gap-2">
              <button className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-stone-300 hover:text-white transition-colors">
                <Maximize size={14} />
              </button>
              <button className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-stone-300 hover:text-white transition-colors">
                <Scan size={14} />
              </button>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

const ValueSection = () => {
  const [ref, isVis] = useScrollReveal();
  const features = [
    { title: "Reduce Returns", desc: "When customers know it fits mathematically and aesthetically, fit-related returns drop drastically." },
    { title: "Increase Conversion", desc: "Interactive 3D keeps users on-page longer and builds the confidence required to click 'Buy'." },
    { title: "Scale Effortlessly", desc: "One 3D model powers web views, AR experiences, and unlimited configuration renders." }
  ];

  return (
    <section id="value" className="py-32 px-6 md:px-12 bg-zinc-950">
      <div ref={ref} className={`max-w-6xl mx-auto reveal-hidden ${isVis ? 'reveal-visible' : ''}`}>
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-5xl font-light tracking-tighter text-stone-100 mb-6">
            Built for modern <br/> furniture brands.
          </h2>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feat, i) => (
            <div key={i} className="glass-panel p-8 rounded-2xl hover:bg-white/5 transition-colors duration-500">
              <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center mb-6 text-stone-300">
                <span className="font-light">{i + 1}</span>
              </div>
              <h3 className="text-xl font-medium tracking-tight text-stone-100 mb-4">{feat.title}</h3>
              <p className="text-stone-400 font-light text-sm leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer className="bg-[#050505] pt-32 pb-12 px-6 md:px-12 border-t border-white/5 text-center relative overflow-hidden">
      {/* Background large text */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.02] pointer-events-none w-full">
        <h1 className="text-[20vw] font-bold tracking-tighter">AKRUTI</h1>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto mb-32">
        <h2 className="text-4xl md:text-6xl font-light tracking-tighter text-stone-50 leading-tight mb-8">
          Ready to define the <br/> future of your brand?
        </h2>
        <button className="group relative inline-flex items-center justify-center bg-stone-100 text-zinc-950 px-10 py-4 rounded-full text-sm font-medium tracking-wide hover:bg-stone-300 transition-colors duration-300 overflow-hidden">
          <span className="flex items-center gap-3">
            Request an Exclusive Demo <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </span>
        </button>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center text-stone-600 text-xs tracking-widest uppercase border-t border-white/5 pt-8">
        <div className="flex items-center gap-2 mb-4 md:mb-0">
          <Cuboid size={16} /> AKRUTI PLATFORM © {new Date().getFullYear()}
        </div>
        <div className="flex gap-8">
          <a href="#" className="hover:text-stone-300 transition-colors">Privacy</a>
          <a href="#" className="hover:text-stone-300 transition-colors">Terms</a>
          <a href="#" className="hover:text-stone-300 transition-colors">Contact</a>
        </div>
      </div>
    </footer>
  );
};

export default function App() {
  return (
    <div className="font-sans antialiased selection:bg-stone-300 selection:text-zinc-950">
      <style>{customStyles}</style>
      <Navbar />
      <main>
        <HeroSection />
        <VisionSection />
        <ConfiguratorDemo />
        <ValueSection />
      </main>
      <Footer />
    </div>
  );
}