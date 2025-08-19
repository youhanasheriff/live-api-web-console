import { useCallback, useEffect, useState } from "react";
import Select from "react-select";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";

const voiceOptions = [
  { value: "Puck", label: "Puck" },
  { value: "Charon", label: "Charon" },
  { value: "Kore", label: "Kore" },
  { value: "Fenrir", label: "Fenrir" },
  { value: "Aoede", label: "Aoede" },
];

export default function VoiceSelector() {
  const { config, setConfig } = useLiveAPIContext();

  useEffect(() => {
    const voiceName =
      config.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName ||
      "Atari02";
    const voiceOption = { value: voiceName, label: voiceName };
    setSelectedOption(voiceOption);
  }, [config]);

  const [selectedOption, setSelectedOption] = useState<{
    value: string;
    label: string;
  } | null>(voiceOptions[5]);

  const updateConfig = useCallback(
    (voiceName: string) => {
      setConfig({
        ...config,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName,
            },
          },
        },
      });
    },
    [config, setConfig]
  );

  return (
    <div className="select-group">
      <label htmlFor="voice-selector">Voice</label>
      <Select
        id="voice-selector"
        className="react-select"
        classNamePrefix="react-select"
        menuPortalTarget={document.body}
        menuPosition="fixed"
        styles={{
          control: (baseStyles) => ({
            ...baseStyles,
            background: "var(--md-sys-color-surface-container-highest)",
            color: "var(--md-sys-color-on-surface)",
            minHeight: "40px",
            border: "1px solid var(--md-sys-color-outline)",
            borderRadius: "var(--md-sys-shape-corner-small)",
            boxShadow: "none",
            fontFamily: "var(--md-sys-typescale-body-large-font)",
            fontSize: "var(--md-sys-typescale-body-large-size)",
            "&:hover": {
              borderColor: "var(--md-sys-color-on-surface)",
            },
          }),
          menu: (baseStyles) => ({
            ...baseStyles,
            background: "var(--md-sys-color-surface-container)",
            border: "1px solid var(--md-sys-color-outline-variant)",
            borderRadius: "var(--md-sys-shape-corner-small)",
            boxShadow: "var(--md-sys-elevation-2)",
            zIndex: 9999,
          }),
          menuPortal: (baseStyles) => ({
            ...baseStyles,
            zIndex: 9999,
          }),
          option: (styles, { isFocused, isSelected }) => ({
            ...styles,
            backgroundColor: isFocused
              ? "var(--md-sys-color-surface-container-high)"
              : isSelected
              ? "var(--md-sys-color-secondary-container)"
              : "transparent",
            color: isSelected
              ? "var(--md-sys-color-on-secondary-container)"
              : "var(--md-sys-color-on-surface)",
            padding: "12px 16px",
            fontFamily: "var(--md-sys-typescale-body-large-font)",
            fontSize: "var(--md-sys-typescale-body-large-size)",
            "&:hover": {
              backgroundColor: "var(--md-sys-color-surface-container-high)",
            },
          }),
          singleValue: (baseStyles) => ({
            ...baseStyles,
            color: "var(--md-sys-color-on-surface)",
          }),
          placeholder: (baseStyles) => ({
            ...baseStyles,
            color: "var(--md-sys-color-on-surface-variant)",
          }),
          indicatorSeparator: () => ({
            display: "none",
          }),
          dropdownIndicator: (baseStyles) => ({
            ...baseStyles,
            color: "var(--md-sys-color-on-surface-variant)",
            "&:hover": {
              color: "var(--md-sys-color-on-surface)",
            },
          }),
        }}
        value={selectedOption}
        defaultValue={selectedOption}
        options={voiceOptions}
        onChange={(e) => {
          setSelectedOption(e);
          if (e) {
            updateConfig(e.value);
          }
        }}
      />
    </div>
  );
}
