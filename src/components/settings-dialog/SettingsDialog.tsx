import { useState } from "react";
import { createPortal } from "react-dom";
import { RiSettings3Line, RiCloseLine } from "react-icons/ri";
import "./settings-dialog.scss";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import VoiceSelector from "./VoiceSelector";

export default function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const { connected } = useLiveAPIContext();

  return (
    <div className="settings-dialog">
      <button
        className="action-button"
        onClick={() => setOpen(!open)}
        aria-label="Open settings"
      >
        <RiSettings3Line size={20} />
      </button>
      {open && createPortal(
        <>
          <div 
            className="modal-backdrop" 
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="modal-container">
            <div 
              className="modal-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-dialog-title"
              aria-describedby="settings-dialog-description"
            >
              <div className="modal-header">
                <h2 id="settings-dialog-title">Voice Settings</h2>
                <button
                  className="close-button"
                  onClick={() => setOpen(false)}
                  aria-label="Close voice settings dialog"
                  type="button"
                >
                  <RiCloseLine size={20} aria-hidden="true" />
                </button>
              </div>
              <div className={`modal-content ${connected ? "disabled" : ""}`}>
                {connected && (
                  <div 
                    className="connected-indicator"
                    role="alert"
                    aria-live="polite"
                  >
                    <p id="settings-dialog-description">
                      These settings can only be applied before connecting and will
                      override other settings.
                    </p>
                  </div>
                )}
                <div className="voice-selector-container">
                  <VoiceSelector />
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
