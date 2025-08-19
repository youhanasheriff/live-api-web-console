import { useState } from "react";
import { createPortal } from "react-dom";
import "./settings-dialog.scss";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import VoiceSelector from "./VoiceSelector";

export default function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const { connected } = useLiveAPIContext();

  return (
    <div className="settings-dialog">
      <button
        className="action-button material-symbols-outlined"
        onClick={() => setOpen(!open)}
      >
        settings
      </button>
      {open && createPortal(
        <>
          <div className="modal-backdrop" onClick={() => setOpen(false)} />
          <div className="modal-container">
            <div className="modal-dialog">
              <div className="modal-header">
                <h2>Voice Settings</h2>
                <button
                  className="close-button material-symbols-outlined"
                  onClick={() => setOpen(false)}
                >
                  close
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
