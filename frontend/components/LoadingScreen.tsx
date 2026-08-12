"use client";

import React, { useEffect, useRef, useState } from "react";

export default function LoadingScreen() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [color, setColor] = useState("#FFFFFF");
  
  const elementRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const velRef = useRef({ dx: 1.2, dy: 1.2 });
  
  const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Get initial width/height of the element, fallback to sensible defaults
    const elementW = elementRef.current ? (elementRef.current.offsetWidth || 150) : 150;
    const elementH = elementRef.current ? (elementRef.current.offsetHeight || 50) : 50;

    const maxX = window.innerWidth - elementW;
    const maxY = window.innerHeight - elementH;

    // Generate random initial position within safe bounds
    const initialX = Math.random() * Math.max(0, maxX);
    const initialY = Math.random() * Math.max(0, maxY);

    posRef.current = { x: initialX, y: initialY };
    setPos({ x: initialX, y: initialY });

    const updatePosition = () => {
      let w = elementRef.current ? (elementRef.current.offsetWidth || 150) : 150;
      let h = elementRef.current ? (elementRef.current.offsetHeight || 50) : 50;

      const currentMaxX = window.innerWidth - w;
      const currentMaxY = window.innerHeight - h;

      let nextX = posRef.current.x + velRef.current.dx;
      let nextY = posRef.current.y + velRef.current.dy;

      // Wall hit checks
      const hitLeft = nextX <= 0;
      const hitRight = nextX >= currentMaxX;
      const hitTop = nextY <= 0;
      const hitBottom = nextY >= currentMaxY;

      // User requested exact corner check in the same frame:
      // if (hitLeft || hitRight) AND (hitTop || hitBottom) in the same frame
      if ((hitLeft || hitRight) && (hitTop || hitBottom)) {
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        setColor("#8B0000");
        flashTimeoutRef.current = setTimeout(() => {
          setColor("#FFFFFF");
        }, 300);
      }

      // Handle bounces
      if (hitLeft) {
        nextX = 0;
        velRef.current.dx = Math.abs(velRef.current.dx);
      } else if (hitRight) {
        nextX = Math.max(0, currentMaxX);
        velRef.current.dx = -Math.abs(velRef.current.dx);
      }

      if (hitTop) {
        nextY = 0;
        velRef.current.dy = Math.abs(velRef.current.dy);
      } else if (hitBottom) {
        nextY = Math.max(0, currentMaxY);
        velRef.current.dy = -Math.abs(velRef.current.dy);
      }

      posRef.current = { x: nextX, y: nextY };
      setPos({ x: nextX, y: nextY });

      animationFrameRef.current = requestAnimationFrame(updatePosition);
    };

    animationFrameRef.current = requestAnimationFrame(updatePosition);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  return (
    <div className="bg-black w-full h-full fixed inset-0 z-[9999] overflow-hidden select-none">
      <div
        ref={elementRef}
        className="absolute left-0 top-0 will-change-transform flex flex-col items-center justify-center text-center p-2"
        style={{
          transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        }}
      >
        <span
          className="font-black text-xl tracking-widest transition-colors duration-150"
          style={{ color }}
        >
          L<span style={{ color: color === "#FFFFFF" ? "#D2042D" : color }}>O</span>CKIN
        </span>
        <span className="font-bold text-[9px] tracking-[0.3em] text-zinc-500 uppercase mt-0.5 whitespace-nowrap">
          THE ACTION NETWORK
        </span>
      </div>
    </div>
  );
}
