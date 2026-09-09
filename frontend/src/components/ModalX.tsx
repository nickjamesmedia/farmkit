import { useEffect, useRef } from 'react';

// Close the enclosing overlay when the phone/browser Back button is pressed.
// Mounting pushes a history entry; Back pops it and we close. Closing any
// other way (X, Cancel, backdrop tap) consumes the pushed entry so the Back
// button still leaves the page afterwards.
//
// The pop is deferred a tick and skipped when another overlay mounted in the
// meantime: when one modal closes and another opens in the same tap, a
// synchronous history.back() would land its popstate on the new modal and
// close it too. The new modal adopts the entry that is already on top instead.
let mountedOverlays = 0;

export function useCloseOnBack(onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    mountedOverlays += 1;
    if (!window.history.state?.farmkitOverlay) {
      window.history.pushState(
        { ...(window.history.state ?? {}), farmkitOverlay: true },
        '',
      );
    }
    const onPop = () => closeRef.current();
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      mountedOverlays -= 1;
      window.setTimeout(() => {
        if (mountedOverlays === 0 && window.history.state?.farmkitOverlay) {
          window.history.back();
        }
      }, 0);
    };
  }, []);
}

type Props = {
  onClose: () => void;
};

// Standard modal chrome: a top-right X button + back-button-closes behavior.
// Render as the first child inside `.modal`.
function ModalX({ onClose }: Props) {
  useCloseOnBack(onClose);
  return (
    <button
      type="button"
      className="modal-x"
      aria-label="Close"
      onClick={onClose}
    >
      ✕
    </button>
  );
}

export default ModalX;

// Headless variant: back-button-closes without rendering a button (used by
// overlays that already have their own close control, like the menu sheet).
export function BackClose({ onClose }: Props) {
  useCloseOnBack(onClose);
  return null;
}
