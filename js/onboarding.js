const TIPS_KEY = "hooked_tips_collapsed";

const STEPS = [
  { icon: "🎯", title: "Cast", desc: "Tap the lake in front of the dock" },
  { icon: "⏳", title: "Wait", desc: "Line is out — tap water after a few seconds to recall" },
  { icon: "🐟", title: "Reel", desc: "Fish on! Tap fast when the marker hits the green zone (Space works too)" },
  { icon: "💰", title: "Earn", desc: "Catch fish for $HOOKED — upgrade gear in the shop" },
];

export function initHowToPlay(container, player, onDismiss) {
  if (!container) return;

  const collapsed = localStorage.getItem(TIPS_KEY) === "1" || player.totalCaught >= 4;

  container.innerHTML = `
    <div class="how-to-head">
      <div class="how-to-title-wrap">
        <span class="how-to-icon" aria-hidden="true">✨</span>
        <h3>How to Play</h3>
      </div>
      <button type="button" class="how-to-dismiss" aria-label="Hide how to play">Hide</button>
    </div>
    <div class="how-to-steps">
      ${STEPS.map(
        (step, i) => `
        <div class="how-to-step">
          <span class="how-to-step-num">${i + 1}</span>
          <span class="how-to-step-icon" aria-hidden="true">${step.icon}</span>
          <div class="how-to-step-text">
            <strong>${step.title}</strong>
            <span>${step.desc}</span>
          </div>
        </div>`
      ).join("")}
    </div>
  `;

  if (collapsed) container.classList.add("is-collapsed");

  const dismiss = container.querySelector(".how-to-dismiss");
  dismiss?.addEventListener("click", () => {
    container.classList.add("is-collapsed");
    localStorage.setItem(TIPS_KEY, "1");
    onDismiss?.();
  });
}

export function showHowToPlay(container) {
  if (!container) return;
  container.classList.remove("is-collapsed");
  localStorage.removeItem(TIPS_KEY);
}

export function renderEmptyCatch(container) {
  if (!container) return;
  container.className = "latest-catch empty-state";
  container.innerHTML = `
    <div class="empty-state-body">
      <span class="empty-state-icon" aria-hidden="true">🎣</span>
      <div class="empty-state-text">
        <strong>No catches yet</strong>
        <span>Cast your line into the lake — your first fish is a Blue Minnow worth <em>1 $HOOKED</em>.</span>
      </div>
    </div>
  `;
}

export function renderEmptyDexMessage() {
  return `
    <p class="dex-empty-tip">
      <span aria-hidden="true">🌊</span>
      Every species you land appears here. Uncaught fish stay hidden until you hook them.
    </p>
  `;
}
