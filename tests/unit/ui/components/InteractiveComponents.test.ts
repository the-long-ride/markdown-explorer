import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('InteractiveComponents', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('InteractiveCounter', () => {
    it('renders counter with default values', async () => {
      const { default: register } = await import('../../../../ui/src/components/Content/InteractiveComponents');
      const el = document.createElement('interactive-counter');
      document.body.appendChild(el);
      await new Promise((r) => setTimeout(r, 50));

      expect(el.querySelector('.counter-val')!.textContent).toBe('0');
      expect(el.querySelector('.dec-btn')).not.toBeNull();
      expect(el.querySelector('.inc-btn')).not.toBeNull();
    });

    it('renders with custom initial and step', async () => {
      const el = document.createElement('interactive-counter');
      el.setAttribute('initial', '10');
      el.setAttribute('step', '5');
      document.body.appendChild(el);
      await new Promise((r) => setTimeout(r, 50));

      expect(el.querySelector('.counter-val')!.textContent).toBe('10');
    });

    it('increments on clicking inc button', async () => {
      const el = document.createElement('interactive-counter');
      el.setAttribute('initial', '0');
      el.setAttribute('step', '3');
      document.body.appendChild(el);
      await new Promise((r) => setTimeout(r, 50));

      const incBtn = el.querySelector('.inc-btn') as HTMLElement;
      incBtn.click();
      expect(el.querySelector('.counter-val')!.textContent).toBe('3');
    });

    it('decrements on clicking dec button', async () => {
      const el = document.createElement('interactive-counter');
      el.setAttribute('initial', '10');
      el.setAttribute('step', '2');
      document.body.appendChild(el);
      await new Promise((r) => setTimeout(r, 50));

      const decBtn = el.querySelector('.dec-btn') as HTMLElement;
      decBtn.click();
      expect(el.querySelector('.counter-val')!.textContent).toBe('8');
    });
  });

  describe('ConfettiButton', () => {
    it('launches particles at the click origin and removes them after animation', async () => {
      await import('../../../../ui/src/components/Content/InteractiveComponents');
      const animations: Animation[] = [];
      const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
      Object.defineProperty(HTMLElement.prototype, 'animate', {
        configurable: true,
        value: vi.fn(() => {
          const animation = { onfinish: null } as Animation;
          animations.push(animation);
          return animation;
        }),
      });
      const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0.25).mockReturnValueOnce(0.25)
        .mockReturnValueOnce(0.25).mockReturnValue(0.75);
      try {
        const element = document.createElement('confetti-button');
        document.body.appendChild(element);
        element.querySelector('button')!.dispatchEvent(new MouseEvent('click', { clientX: 20, clientY: 40 }));
        const particles = [...document.querySelectorAll<HTMLElement>('.confetti-particle')];
        expect(particles).toHaveLength(30);
        expect(particles[0]).toHaveStyle({ left: '20px', top: '40px', borderRadius: '2px' });
        expect(particles[1]).toHaveStyle({ borderRadius: '50%' });
        for (const animation of animations) animation.onfinish?.call(animation, new Event('finish') as AnimationPlaybackEvent);
        expect(document.querySelectorAll('.confetti-particle')).toHaveLength(0);
      } finally {
        random.mockRestore();
        if (originalAnimate) Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate);
        else Reflect.deleteProperty(HTMLElement.prototype, 'animate');
      }
    });
    it('renders button with default text', async () => {
      const el = document.createElement('confetti-button');
      document.body.appendChild(el);
      await new Promise((r) => setTimeout(r, 50));

      const btn = el.querySelector('button');
      expect(btn).not.toBeNull();
      expect(btn!.textContent).toBe('Celebrate!');
    });

    it('renders button with custom text', async () => {
      const el = document.createElement('confetti-button');
      el.setAttribute('text', 'Click Me');
      document.body.appendChild(el);
      await new Promise((r) => setTimeout(r, 50));

      const btn = el.querySelector('button');
      expect(btn!.textContent).toBe('Click Me');
    });
  });

  describe('InteractiveTabs', () => {
    it('renders tabs from comma-separated attribute', async () => {
      const el = document.createElement('interactive-tabs');
      el.setAttribute('tabs', 'Tab1,Tab2,Tab3');
      document.body.appendChild(el);
      await new Promise((r) => setTimeout(r, 50));

      const shadow = el.shadowRoot;
      expect(shadow).not.toBeNull();
      const buttons = shadow!.querySelectorAll('.tab-btn');
      expect(buttons.length).toBe(3);
      expect(buttons[0].textContent).toBe('Tab1');
    });

    it('first tab is active by default', async () => {
      const el = document.createElement('interactive-tabs');
      el.setAttribute('tabs', 'A,B');
      document.body.appendChild(el);
      await new Promise((r) => setTimeout(r, 50));

      const shadow = el.shadowRoot!;
      const firstBtn = shadow.querySelector('.tab-btn') as HTMLElement;
      expect(firstBtn.classList.contains('active')).toBe(true);
    });

    it('clicking a tab makes it active', async () => {
      const el = document.createElement('interactive-tabs');
      el.setAttribute('tabs', 'A,B,C');
      document.body.appendChild(el);
      await new Promise((r) => setTimeout(r, 50));

      const shadow = el.shadowRoot!;
      const buttons = shadow.querySelectorAll('.tab-btn');
      (buttons[1] as HTMLElement).click();
      expect((buttons[1] as HTMLElement).classList.contains('active')).toBe(true);
      expect((buttons[0] as HTMLElement).classList.contains('active')).toBe(false);
    });

    it('handles empty tabs attribute', async () => {
      const el = document.createElement('interactive-tabs');
      el.setAttribute('tabs', '');
      document.body.appendChild(el);
      await new Promise((r) => setTimeout(r, 50));

      expect(el.shadowRoot).not.toBeNull();
    });
  });
});
