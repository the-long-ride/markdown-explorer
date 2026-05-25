// =============================================================================
// components/Content/InteractiveComponents.ts — Custom web components for MDX
// =============================================================================

class InteractiveCounter extends HTMLElement {
  connectedCallback() {
    const initial = parseInt(this.getAttribute('initial') || '0', 10);
    const step = parseInt(this.getAttribute('step') || '1', 10);
    let count = initial;

    this.innerHTML = `
      <div class="interactive-counter">
        <button class="counter-btn dec-btn">−</button>
        <span class="counter-val">${count}</span>
        <button class="counter-btn inc-btn">+</button>
      </div>
    `;

    const valEl = this.querySelector('.counter-val') as HTMLElement;
    const decBtn = this.querySelector('.dec-btn') as HTMLElement;
    const incBtn = this.querySelector('.inc-btn') as HTMLElement;

    if (valEl && decBtn && incBtn) {
      decBtn.addEventListener('click', () => {
        count -= step;
        valEl.textContent = String(count);
        valEl.style.transform = 'scale(0.85)';
        setTimeout(() => {
          valEl.style.transform = 'scale(1)';
        }, 100);
      });

      incBtn.addEventListener('click', () => {
        count += step;
        valEl.textContent = String(count);
        valEl.style.transform = 'scale(1.15)';
        setTimeout(() => {
          valEl.style.transform = 'scale(1)';
        }, 100);
      });
    }
  }
}

if (!customElements.get('interactive-counter')) {
  customElements.define('interactive-counter', InteractiveCounter);
}

class ConfettiButton extends HTMLElement {
  connectedCallback() {
    const text = this.getAttribute('text') || 'Celebrate!';
    this.innerHTML = `<button class="btn btn--accent confetti-btn">${text}</button>`;
    const btn = this.querySelector('button');
    if (btn) {
      btn.addEventListener('click', (e) => {
        this.shoot(e.clientX, e.clientY);
      });
    }
  }

  shoot(x: number, y: number) {
    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-particle';
      document.body.appendChild(p);

      const size = Math.random() * 8 + 4;
      const color = `hsl(${Math.random() * 360}, 90%, 65%)`;

      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.background = color;
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';

      const angle = Math.random() * Math.PI * 2;
      const velocity = Math.random() * 120 + 60;
      const dx = Math.cos(angle) * velocity;
      const dy = Math.sin(angle) * velocity - 50;

      p.animate([
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${Math.random() * 360}deg)`, opacity: 0 }
      ], {
        duration: Math.random() * 600 + 600,
        easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)',
        fill: 'forwards'
      }).onfinish = () => p.remove();
    }
  }
}

if (!customElements.get('confetti-button')) {
  customElements.define('confetti-button', ConfettiButton);
}

class InteractiveTabs extends HTMLElement {
  connectedCallback() {
    const tabsAttr = this.getAttribute('tabs') || '';
    const tabs = tabsAttr.split(',').map(t => t.trim());
    if (tabs.length === 0) return;

    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        .tabs-header {
          display: flex;
          gap: 4px;
          border-bottom: 1px solid var(--bd-s, #ccc);
          padding-bottom: 4px;
          margin-bottom: 12px;
        }
        .tab-btn {
          background: none;
          border: none;
          padding: 6px 12px;
          cursor: pointer;
          color: var(--tx2, #666);
          font-family: var(--font-ui, sans-serif);
          font-size: 11.5px;
          border-radius: 4px;
          transition: all 0.12s;
        }
        .tab-btn:hover {
          background: var(--bg-h, #eee);
          color: var(--tx, #000);
        }
        .tab-btn.active {
          background: var(--accent, #8b7cf8);
          color: #fff;
          font-weight: 600;
        }
        .tab-content {
          display: none;
        }
        .tab-content.active {
          display: block;
          animation: tabFadeIn 0.15s ease-out;
        }
        @keyframes tabFadeIn {
          from {
            opacity: 0;
            transform: translateY(2px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      </style>
      <div class="tabs-header">
        ${tabs.map((tab, idx) => `<button class="tab-btn ${idx === 0 ? 'active' : ''}" data-tab="${tab}">${tab}</button>`).join('')}
      </div>
      <div class="tabs-body">
        ${tabs.map(tab => `<div class="tab-content" id="content-${tab}"><slot name="${tab}"></slot></div>`).join('')}
      </div>
    `;

    const updateActiveTab = (activeTab: string) => {
      shadow.querySelectorAll('.tab-btn').forEach(btn => {
        (btn as HTMLElement).classList.toggle('active', (btn as HTMLElement).dataset.tab === activeTab);
      });
      shadow.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `content-${activeTab}`);
      });
    };

    updateActiveTab(tabs[0]);

    shadow.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const activeTab = (btn as HTMLElement).dataset.tab;
        if (activeTab) updateActiveTab(activeTab);
      });
    });
  }
}

if (!customElements.get('interactive-tabs')) {
  customElements.define('interactive-tabs', InteractiveTabs);
}
