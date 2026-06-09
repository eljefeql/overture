"use client";

import { useEffect, useState, useId } from "react";

const COLORS = [
  "#C4A052", // stage-500 gold
  "#6B3A5D", // curtain-600 plum
  "#E8D5B7", // cream-300
  "#4A8C5C", // forest-500
  "#D4A853", // stage-400
  "#8B5A7A", // curtain-400
  "#F0E6D3", // cream-200
  "#D97B6B", // ruby-400
];

type Particle = {
  id: number;
  color: string;
  size: number;
  isStrip: boolean;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  spin: number;
  delay: number;
  duration: number;
};

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function createParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const velocity = randomBetween(250, 600);
    return {
      id: i,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: randomBetween(5, 10),
      isStrip: Math.random() > 0.5,
      startX: randomBetween(42, 58),
      startY: randomBetween(20, 35),
      dx: Math.cos(angle) * velocity,
      dy: Math.sin(angle) * velocity - 250, // upward bias
      spin: randomBetween(-720, 720),
      delay: randomBetween(0, 0.12),
      duration: randomBetween(2, 3.2),
    };
  });
}

export function ConfettiBurst({ trigger }: { trigger: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [visible, setVisible] = useState(false);
  const uid = useId().replace(/:/g, "");

  useEffect(() => {
    if (trigger && !visible) {
      setParticles(createParticles(70));
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [trigger, visible]);

  if (!visible || particles.length === 0) return null;

  // Build all keyframes as a single style block
  const keyframesCSS = particles
    .map((p) => {
      const name = `cf-${uid}-${p.id}`;
      return `
@keyframes ${name} {
  0% { transform: translate(0,0) rotate(0deg) scale(0); opacity:1; }
  10% { transform: translate(${p.dx * 0.15}px, ${p.dy * 0.15 - 50}px) rotate(${p.spin * 0.1}deg) scale(1.2); opacity:1; }
  65% { opacity:1; }
  100% { transform: translate(${p.dx}px, ${p.dy + 500}px) rotate(${p.spin}deg) scale(0.4); opacity:0; }
}`;
    })
    .join("\n");

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: keyframesCSS }} />
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 9999 }}
        aria-hidden="true"
      >
        {particles.map((p) => (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: `${p.startX}%`,
              top: `${p.startY}%`,
              width: p.isStrip ? p.size * 0.4 : p.size,
              height: p.isStrip ? p.size * 2.2 : p.size,
              backgroundColor: p.color,
              borderRadius: p.isStrip
                ? "2px"
                : Math.random() > 0.5
                  ? "50%"
                  : "1px",
              animation: `cf-${uid}-${p.id} ${p.duration}s cubic-bezier(0.22, 0.61, 0.36, 1) ${p.delay}s forwards`,
            }}
          />
        ))}
      </div>
    </>
  );
}
