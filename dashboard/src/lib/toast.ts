// Simple toast utility — renders into the #toast-host container from ToastHost.

type ToastTone = 'success' | 'error' | 'info' | 'warning';

const COLORS: Record<ToastTone, string> = {
  success: '#10B981',
  error:   '#F43F5E',
  info:    '#0284C7',
  warning: '#F59E0B',
};

export function toast(message: string, tone: ToastTone = 'info', durationMs = 3500) {
  const host = document.getElementById('toast-host');
  if (!host) return;

  const el = document.createElement('div');
  el.style.cssText = `
    background: #1E293B;
    color: white;
    padding: 12px 18px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 700;
    border-left: 4px solid ${COLORS[tone]};
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 340px;
    opacity: 0;
    transform: translateX(20px);
    transition: opacity 0.2s, transform 0.2s;
    margin-top: 8px;
    pointer-events: auto;
  `;

  const dot = document.createElement('span');
  dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${COLORS[tone]};flex-shrink:0`;
  el.appendChild(dot);

  const text = document.createElement('span');
  text.textContent = message;
  el.appendChild(text);

  host.appendChild(el);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateX(0)';
    });
  });

  // Auto-dismiss
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
  }, durationMs);
}
