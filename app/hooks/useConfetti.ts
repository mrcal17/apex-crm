"use client";

export function fireConfetti() {
  const colors = ["var(--accent)", "#22c55e", "#eab308", "#a855f7", "#ef4444"];
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;";
  document.body.appendChild(container);

  for (let i = 0; i < 80; i++) {
    const piece = document.createElement("div");
    const color = colors[Math.floor(Math.random() * colors.length)];
    const x = 40 + Math.random() * 20; // start near center
    const drift = (Math.random() - 0.5) * 80;
    const duration = 1.5 + Math.random() * 1.5;
    const delay = Math.random() * 0.3;
    const size = 4 + Math.random() * 6;
    const rotation = Math.random() * 720;

    piece.style.cssText = `
      position:absolute;
      left:${x}%;
      top:-10px;
      width:${size}px;
      height:${size * (0.4 + Math.random() * 0.6)}px;
      background:${color};
      border-radius:${Math.random() > 0.5 ? "50%" : "1px"};
      opacity:1;
      animation:confetti-fall ${duration}s ${delay}s ease-in forwards;
    `;
    container.appendChild(piece);
  }

  const style = document.createElement("style");
  style.textContent = `
    @keyframes confetti-fall {
      0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 1; }
      100% { transform: translateY(100vh) translateX(${(Math.random() - 0.5) * 200}px) rotate(720deg); opacity: 0; }
    }
  `;
  container.appendChild(style);

  setTimeout(() => container.remove(), 4000);
}
