import { useEffect, useRef } from 'react';

// Close the enclosing overlay when the phone/browser Back button is pressed.
// Mounting pushes a history entry; Back pops it and we close. Closing any
// other way (X, Cancel, backdrop tap) consumes the pushed entry so the Back
// button still leaves the page afterwards.
export function useCloseOnBack(onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    window.history.pushState(
      { ...(window.history.state ?? {}), farmkitOverlay: true },
      '',
    );
    const onPop = () => closeRef.current();
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (window.history.state?.farmkitOverlay) {
        window.history.back();
      }
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
