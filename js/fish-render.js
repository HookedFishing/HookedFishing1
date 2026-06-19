import { RARITY_COLORS } from "./config.js";

export function shadeColor(hex, amount) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}

export function getFishShape(fish) {
  const id = fish.id || "";
  if (
    id.includes("shark") ||
    id.includes("marlin") ||
    id.includes("barracuda") ||
    id.includes("swordfish") ||
    id.includes("tuna") ||
    id.includes("tarpon")
  ) {
    return "shark";
  }
  if (id.includes("stingray") || id.includes("flounder") || id.includes("manta")) {
    return "ray";
  }
  if (
    id.includes("octopus") ||
    id.includes("squid") ||
    id.includes("angler") ||
    id.includes("kraken") ||
    id.includes("jelly")
  ) {
    return "cephalopod";
  }
  if (id.includes("eel") || id === "leviathan") {
    return "eel";
  }
  if (id.includes("puffer") || id.includes("sunfish") || id === "goby") {
    return "round";
  }
  if (fish.weight >= 8 || fish.rarity === "legendary") return "shark";
  if (fish.weight <= 0.22) return "round";
  return "standard";
}

function drawEye(ctx, bodyLen, bodyH) {
  ctx.fillStyle = "#14202e";
  ctx.beginPath();
  ctx.arc(bodyLen * 0.55, -bodyH * 0.12, Math.max(1, bodyH * 0.34), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(bodyLen * 0.58, -bodyH * 0.2, Math.max(0.45, bodyH * 0.11), 0, Math.PI * 2);
  ctx.fill();
}

function drawStandardTail(ctx, bodyLen, bodyH, tail) {
  ctx.fillStyle = tail;
  ctx.beginPath();
  ctx.moveTo(-bodyLen - bodyH * 1.15, 0);
  ctx.lineTo(-bodyLen + 1, -bodyH * 1.05);
  ctx.lineTo(-bodyLen + 4, 0);
  ctx.lineTo(-bodyLen + 1, bodyH * 1.05);
  ctx.closePath();
  ctx.fill();
}

function drawDorsalFin(ctx, bodyLen, bodyH, color) {
  ctx.fillStyle = shadeColor(color, -22);
  ctx.beginPath();
  ctx.moveTo(-bodyLen * 0.05, -bodyH * 0.95);
  ctx.lineTo(bodyLen * 0.35, -bodyH * 1.15);
  ctx.lineTo(bodyLen * 0.15, -bodyH * 0.55);
  ctx.closePath();
  ctx.fill();
}

function drawShine(ctx, bodyLen, bodyH) {
  const shine = ctx.createRadialGradient(
    bodyLen * 0.28,
    -bodyH * 0.38,
    0,
    bodyLen * 0.22,
    -bodyH * 0.22,
    bodyLen * 0.62
  );
  shine.addColorStop(0, "rgba(255,255,255,0.65)");
  shine.addColorStop(0.45, "rgba(255,255,255,0.18)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.ellipse(bodyLen * 0.2, -bodyH * 0.3, bodyLen * 0.45, bodyH * 0.3, -0.22, 0, Math.PI * 2);
  ctx.fill();
}

function drawBellyHighlight(ctx, bodyLen, bodyH) {
  const belly = ctx.createLinearGradient(0, bodyH * 0.1, 0, bodyH * 0.55);
  belly.addColorStop(0, "rgba(255,255,255,0)");
  belly.addColorStop(0.5, "rgba(255,255,255,0.22)");
  belly.addColorStop(1, "rgba(255,255,255,0.08)");
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.ellipse(0, bodyH * 0.32, bodyLen * 0.58, bodyH * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBodyGradient(ctx, bodyLen, bodyH, color, belly, dorsal) {
  const bodyGrad = ctx.createLinearGradient(0, -bodyH, 0, bodyH);
  bodyGrad.addColorStop(0, dorsal);
  bodyGrad.addColorStop(0.35, color);
  bodyGrad.addColorStop(0.72, shadeColor(color, 18));
  bodyGrad.addColorStop(1, belly);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, bodyLen, bodyH, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = shadeColor(color, -62);
  ctx.lineWidth = Math.max(0.5, bodyH * 0.08);
  ctx.beginPath();
  ctx.ellipse(0, 0, bodyLen, bodyH, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawShapeExtras(ctx, shape, bodyLen, bodyH, color, tail) {
  if (shape === "shark") {
    ctx.fillStyle = tail;
    ctx.beginPath();
    ctx.moveTo(-bodyLen - bodyH * 0.4, 0);
    ctx.lineTo(-bodyLen - bodyH * 1.5, -bodyH * 0.35);
    ctx.lineTo(-bodyLen - bodyH * 0.2, 0);
    ctx.lineTo(-bodyLen - bodyH * 1.5, bodyH * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shadeColor(color, -30);
    ctx.beginPath();
    ctx.moveTo(bodyLen * 0.1, -bodyH * 0.85);
    ctx.lineTo(bodyLen * 0.55, -bodyH * 1.35);
    ctx.lineTo(bodyLen * 0.35, -bodyH * 0.65);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (shape === "ray") {
    ctx.fillStyle = tail;
    ctx.beginPath();
    ctx.ellipse(0, bodyH * 0.15, bodyLen * 1.15, bodyH * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shadeColor(color, -40);
    ctx.lineWidth = Math.max(0.6, bodyH * 0.12);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-bodyLen * 0.2, bodyH * 0.55);
      ctx.quadraticCurveTo(i * bodyLen * 0.18, bodyH * 1.35, i * bodyLen * 0.35, bodyH * 1.75);
      ctx.stroke();
    }
    return;
  }

  if (shape === "round") {
    ctx.fillStyle = tail;
    ctx.beginPath();
    ctx.moveTo(-bodyLen - bodyH * 0.5, 0);
    ctx.lineTo(-bodyLen, -bodyH * 0.55);
    ctx.lineTo(-bodyLen + bodyH * 0.2, 0);
    ctx.lineTo(-bodyLen, bodyH * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shadeColor(color, -18);
    ctx.beginPath();
    ctx.moveTo(-bodyLen * 0.1, -bodyH * 1.05);
    ctx.lineTo(bodyLen * 0.2, -bodyH * 1.25);
    ctx.lineTo(bodyLen * 0.05, -bodyH * 0.7);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (shape === "eel") {
    ctx.strokeStyle = shadeColor(color, -25);
    ctx.lineWidth = bodyH * 1.35;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-bodyLen, 0);
    ctx.quadraticCurveTo(-bodyLen * 0.35, -bodyH * 1.4, bodyLen * 0.55, -bodyH * 0.2);
    ctx.quadraticCurveTo(bodyLen * 0.85, bodyH * 0.5, bodyLen * 1.05, bodyH * 0.15);
    ctx.stroke();
    ctx.fillStyle = tail;
    ctx.beginPath();
    ctx.moveTo(-bodyLen - bodyH * 0.35, -bodyH * 0.25);
    ctx.lineTo(-bodyLen - bodyH * 0.9, 0);
    ctx.lineTo(-bodyLen - bodyH * 0.35, bodyH * 0.25);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (shape === "cephalopod") {
    ctx.fillStyle = shadeColor(color, -15);
    ctx.beginPath();
    ctx.ellipse(bodyLen * 0.15, -bodyH * 0.35, bodyLen * 0.55, bodyH * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shadeColor(color, -45);
    ctx.lineWidth = Math.max(0.5, bodyH * 0.22);
    for (let i = 0; i < 5; i++) {
      const spread = (i - 2) * bodyH * 0.42;
      ctx.beginPath();
      ctx.moveTo(-bodyLen * 0.35, bodyH * 0.45);
      ctx.quadraticCurveTo(-bodyLen * 0.75, bodyH * 0.95 + spread * 0.2, -bodyLen * 1.05, bodyH * 1.35 + spread);
      ctx.stroke();
    }
    return;
  }

  drawStandardTail(ctx, bodyLen, bodyH, tail);
  drawDorsalFin(ctx, bodyLen, bodyH, color);
}

/**
 * Draw a fish sprite centered at the current canvas origin (call ctx.translate first).
 */
export function drawFishSprite(ctx, fish, options = {}) {
  const {
    scale = 1,
    alpha = 1,
    iconScale = 0.42,
    gameScale = null,
    unknown = false,
  } = options;

  if (unknown) return;

  const shape = getFishShape(fish);
  const color = fish.color || RARITY_COLORS[fish.rarity] || "#94a3b8";
  const belly = shadeColor(color, 42);
  const dorsal = shadeColor(color, -38);
  const tail = shadeColor(color, -52);
  const sizeScale = fish.starter ? 0.72 : 1;
  const dimScale = gameScale ?? iconScale * scale;
  const bodyLen = (10 + fish.weight * 4) * dimScale * sizeScale;
  const bodyH = (4 + fish.weight * 1.5) * dimScale * sizeScale;

  ctx.save();
  ctx.globalAlpha = alpha;

  if (shape === "eel") {
    drawShapeExtras(ctx, shape, bodyLen, bodyH, color, tail);
    drawEye(ctx, bodyLen * 0.85, bodyH);
  } else if (shape === "cephalopod") {
    drawBodyGradient(ctx, bodyLen * 0.7, bodyH * 0.9, color, belly, dorsal);
    drawShapeExtras(ctx, shape, bodyLen, bodyH, color, tail);
    drawEye(ctx, bodyLen * 0.45, bodyH * 0.7);
  } else if (shape === "ray") {
    drawBodyGradient(ctx, bodyLen * 0.75, bodyH * 0.55, color, belly, dorsal);
    drawShapeExtras(ctx, shape, bodyLen, bodyH, color, tail);
    drawEye(ctx, bodyLen * 0.35, bodyH * 0.35);
  } else {
    const lenMult = shape === "shark" ? 1.18 : shape === "round" ? 0.88 : 1;
    const hMult = shape === "round" ? 1.12 : 1;
    drawBodyGradient(ctx, bodyLen * lenMult, bodyH * hMult, color, belly, dorsal);
    drawShapeExtras(ctx, shape, bodyLen * lenMult, bodyH * hMult, color, tail);
    if (shape === "standard" || shape === "round") {
      drawShine(ctx, bodyLen * lenMult, bodyH * hMult);
      drawBellyHighlight(ctx, bodyLen * lenMult, bodyH * hMult);
    }
    drawEye(ctx, bodyLen * lenMult, bodyH * hMult);
  }

  if (fish.rarity === "legendary" || fish.rarity === "epic") {
    const aura = ctx.createRadialGradient(0, 0, bodyLen * 0.4, 0, 0, bodyLen * 1.2);
    aura.addColorStop(
      0,
      fish.rarity === "legendary" ? "rgba(250,204,21,0.2)" : "rgba(96,165,250,0.16)"
    );
    aura.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyLen * 1.15, bodyH * 1.25, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle =
      fish.rarity === "legendary" ? "rgba(250,204,21,0.5)" : "rgba(96,165,250,0.4)";
    ctx.lineWidth = Math.max(0.8, bodyH * 0.14);
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyLen * 1.05, bodyH * 1.15, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = shadeColor(color, -55);
  ctx.lineWidth = Math.max(0.6, scale * 0.8);
  if (shape !== "eel" && shape !== "cephalopod") {
    ctx.beginPath();
    ctx.moveTo(-bodyLen * 0.25, bodyH * 0.45);
    ctx.quadraticCurveTo(0, bodyH * 1.15, bodyLen * 0.25, bodyH * 0.45);
    ctx.stroke();
  }

  ctx.restore();
}
