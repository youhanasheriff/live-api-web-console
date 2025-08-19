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
          control: (baseStyles, { isFocused }) => ({
            ...baseStyles,
            background: "var(--md-sys-color-surface-container-highest)",
            color: "var(--md-sys-color-on-surface)",
            minHeight: "48px",
            border: isFocused 
              ? "2px solid var(--md-sys-color-primary)"
              : "1px solid var(--md-sys-color-outline)",
            borderRadius: "var(--md-sys-shape-corner-small)",
            boxShadow: isFocused 
              ? "0 0 0 1px var(--md-sys-color-primary)"
              : "none",
            fontFamily: "var(--md-sys-typescale-body-large-font)",
            fontSize: "var(--md-sys-typescale-body-large-size)",
            fontWeight: "var(--md-sys-typescale-body-large-weight)",
            lineHeight: "var(--md-sys-typescale-body-large-line-height)",
            transition: "all var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard)",
            "&:hover": {
              borderColor: isFocused 
                ? "var(--md-sys-color-primary)"
                : "var(--md-sys-color-on-surface)",
            },
          }),
          menu: (baseStyles) => ({
            ...baseStyles,
            background: "var(--md-sys-color-surface-container)",
            border: "1px solid var(--md-sys-color-outline-variant)",
            borderRadius: "var(--md-sys-shape-corner-medium)",
            boxShadow: "var(--md-sys-elevation-3)",
            zIndex: 9999,
            marginTop: "var(--md-sys-spacing-1)",
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
            padding: "var(--md-sys-spacing-3) var(--md-sys-spacing-4)",
            fontFamily: "var(--md-sys-typescale-body-large-font)",
            fontSize: "var(--md-sys-typescale-body-large-size)",
            fontWeight: "var(--md-sys-typescale-body-large-weight)",
            lineHeight: "var(--md-sys-typescale-body-large-line-height)",
            cursor: "pointer",
            transition: "background-color var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard)",
            "&:active": {
              backgroundColor: "var(--md-sys-color-surface-container-highest)",
            },
          }),
          singleValue: (baseStyles) => ({
            ...baseStyles,
            color: "var(--md-sys-color-on-surface)",
            fontWeight: "var(--md-sys-typescale-body-large-weight)",
          }),
          placeholder: (baseStyles) => ({
            ...baseStyles,
            color: "var(--md-sys-color-on-surface-variant)",
            fontStyle: "italic",
          }),
          indicatorSeparator: () => ({
            display: "none",
          }),
          dropdownIndicator: (baseStyles, { isFocused }) => ({
            ...baseStyles,
            color: isFocused 
              ? "var(--md-sys-color-primary)"
              : "var(--md-sys-color-on-surface-variant)",
            transition: "color var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard)",
            "&:hover": {
              color: "var(--md-sys-color-on-surface)",
            },
          }),
          valueContainer: (baseStyles) => ({
            ...baseStyles,
            padding: "0 var(--md-sys-spacing-4)",
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
