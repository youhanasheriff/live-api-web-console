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
          <div className="modal-backdrop" onClick={() => setOpen(false)} />
          <div className="modal-container">
            <div className="modal-dialog">
              <div className="modal-header">
                <h2>Voice Settings</h2>
                <button
                  className="close-button"
                  onClick={() => setOpen(false)}
                  aria-label="Close settings"
                >
                  <RiCloseLine size={20} />
                </button>
              </div>
              <div className={`modal-content ${connected ? "disabled" : ""}`}>
                {connected && (
                  <div className="connected-indicator">
                    <p>
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
