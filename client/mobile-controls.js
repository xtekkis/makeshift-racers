(function () {
  if (!('ontouchstart' in window) && !window.matchMedia('(pointer: coarse)').matches) return;

  document.body.classList.add('touch-device');
  document.body.style.overflow = 'hidden';

  const dpadLeft = document.getElementById('dpad-left');
  const dpadRight = document.getElementById('dpad-right');
  if (dpadLeft) dpadLeft.style.display = 'flex';
  if (dpadRight) dpadRight.style.display = 'flex';

  window.dpad = { left: false, right: false, up: false, down: false };
  window.mobileItemPressed = false;

  function setupBtn(el, onDown, onUp) {
    if (!el) return;
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      el.classList.add('pressed');
      onDown();
    }, { passive: false });
    el.addEventListener('touchend', () => {
      el.classList.remove('pressed');
      onUp();
    });
    el.addEventListener('touchcancel', () => {
      el.classList.remove('pressed');
      onUp();
    });
  }

  setupBtn(document.getElementById('btn-left'),  () => { window.dpad.left  = true;  }, () => { window.dpad.left  = false; });
  setupBtn(document.getElementById('btn-right'), () => { window.dpad.right = true;  }, () => { window.dpad.right = false; });
  setupBtn(document.getElementById('btn-up'),    () => { window.dpad.up    = true;  }, () => { window.dpad.up    = false; });
  setupBtn(document.getElementById('btn-down'),  () => { window.dpad.down  = true;  }, () => { window.dpad.down  = false; });
  setupBtn(document.getElementById('btn-use'),   () => { window.mobileItemPressed = true; }, () => {});
})();
