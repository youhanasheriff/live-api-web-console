/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import "./react-select.scss";
import cn from "classnames";
import { useEffect, useRef, useState } from "react";
import { RiSidebarFoldLine, RiSidebarUnfoldLine } from "react-icons/ri";
import Select from "react-select";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { useLoggerStore } from "../../lib/store-logger";
import Logger, { LoggerFilterType } from "../logger/Logger";

import AudioManagerButton from "../audio-manager/AudioManagerButton";
import "./side-panel.scss";

const filterOptions = [
  { value: "conversations", label: "Conversations" },
  { value: "tools", label: "Tool Use" },
  { value: "none", label: "All" },
];

export default function SidePanel() {
  const { connected, client } = useLiveAPIContext();
  const [open, setOpen] = useState(true);
  const loggerRef = useRef<HTMLDivElement>(null);
  const loggerLastHeightRef = useRef<number>(-1);
  const { log, logs } = useLoggerStore();

  const [textInput, setTextInput] = useState("");
  const [selectedOption, setSelectedOption] = useState<{
    value: string;
    label: string;
  } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  //scroll the log to the bottom when new logs come in
  useEffect(() => {
    if (loggerRef.current) {
      const el = loggerRef.current;
      const scrollHeight = el.scrollHeight;
      if (scrollHeight !== loggerLastHeightRef.current) {
        el.scrollTop = scrollHeight;
        loggerLastHeightRef.current = scrollHeight;
      }
    }
  }, [logs]);

  // listen for log events and store them
  useEffect(() => {
    client.on("log", log);
    return () => {
      client.off("log", log);
    };
  }, [client, log]);

  const handleSubmit = () => {
    client.send([{ text: textInput }]);

    setTextInput("");
    if (inputRef.current) {
      inputRef.current.innerText = "";
    }
  };

  return (
    <aside 
      className={`side-panel ${open ? "open" : ""}`}
      aria-label="Console navigation panel"
    >
      <header className="top">
        <h2 id="console-title">Console</h2>
        <div className="header-actions">

          <AudioManagerButton className="audio-button" />
          {open ? (
            <button 
              className="opener" 
              onClick={() => setOpen(false)}
              aria-label="Collapse console panel"
              aria-expanded="true"
              aria-controls="side-panel-content"
              type="button"
            >
              <RiSidebarFoldLine aria-hidden="true" />
            </button>
          ) : (
            <button 
              className="opener" 
              onClick={() => setOpen(true)}
              aria-label="Expand console panel"
              aria-expanded="false"
              aria-controls="side-panel-content"
              type="button"
            >
              <RiSidebarUnfoldLine aria-hidden="true" />
            </button>
          )}
        </div>
      </header>
      <section className="indicators" aria-label="Console controls">
        <Select
          className="react-select"
          classNamePrefix="react-select"
          styles={{
            control: (baseStyles) => ({
              ...baseStyles,
              background: "var(--md-sys-color-surface-container)",
              color: "var(--md-sys-color-on-surface)",
              minHeight: "33px",
              maxHeight: "33px",
              border: `1px solid var(--md-sys-color-outline-variant)`,
            }),
            option: (styles, { isFocused, isSelected }) => ({
              ...styles,
              backgroundColor: isFocused
                ? "var(--md-sys-color-secondary-container)"
                : isSelected
                  ? "var(--md-sys-color-primary-container)"
                  : "var(--md-sys-color-surface)",
              color: isFocused
                ? "var(--md-sys-color-on-secondary-container)"
                : isSelected
                  ? "var(--md-sys-color-on-primary-container)"
                  : "var(--md-sys-color-on-surface)",
            }),
          }}
          defaultValue={selectedOption}
          options={filterOptions}
          onChange={(e) => {
            setSelectedOption(e);
          }}
          aria-label="Filter console logs"
          placeholder="Select filter"
        />
        <div 
          className={cn("streaming-indicator", { connected })}
          role="status"
          aria-live="polite"
          aria-label={connected ? "Connection active" : "Connection paused"}
        >
          {connected
            ? `🔵${open ? " Streaming" : ""}`
            : `⏸️${open ? " Paused" : ""}`}
        </div>
      </section>
      <div 
        id="side-panel-content"
        className="side-panel-container" 
        ref={loggerRef}
        role="log"
        aria-label="Console output"
        aria-live="polite"
      >
        <Logger
          filter={(selectedOption?.value as LoggerFilterType) || "none"}
        />
      </div>
      <div className={cn("input-container", { disabled: !connected })}>
        <div className="input-content">
          <textarea
            className="input-area"
            ref={inputRef}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                handleSubmit();
              }
            }}
            onChange={(e) => setTextInput(e.target.value)}
            value={textInput}
            placeholder="Type something..."
            aria-label="Message input"
            aria-describedby="console-title"
            disabled={!connected}
          ></textarea>
          <span
            className={cn("input-content-placeholder", {
              hidden: textInput.length,
            })}
            aria-hidden="true"
          >
            Type&nbsp;something...
          </span>

          <button
            className="send-button material-symbols-outlined filled"
            onClick={handleSubmit}
            type="button"
            aria-label="Send message"
            disabled={!connected || !textInput.trim()}
          >
            send
          </button>
        </div>
      </div>
    </aside>
  );
}
