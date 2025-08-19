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
            background: "var(--Neutral-15)",
            color: "var(--Neutral-90)",
            minHeight: "40px",
            border: "1px solid var(--Neutral-30)",
            borderRadius: "8px",
            boxShadow: "none",
            "&:hover": {
              borderColor: "var(--Neutral-50)",
            },
          }),
          menu: (baseStyles) => ({
            ...baseStyles,
            background: "var(--Neutral-15)",
            border: "1px solid var(--Neutral-30)",
            borderRadius: "8px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            zIndex: 9999,
          }),
          menuPortal: (baseStyles) => ({
            ...baseStyles,
            zIndex: 9999,
          }),
          option: (styles, { isFocused, isSelected }) => ({
            ...styles,
            backgroundColor: isFocused
              ? "var(--Neutral-30)"
              : isSelected
              ? "var(--Neutral-20)"
              : "transparent",
            color: "var(--Neutral-90)",
            padding: "12px 16px",
            "&:hover": {
              backgroundColor: "var(--Neutral-30)",
            },
          }),
          singleValue: (baseStyles) => ({
            ...baseStyles,
            color: "var(--Neutral-90)",
          }),
          placeholder: (baseStyles) => ({
            ...baseStyles,
            color: "var(--Neutral-70)",
          }),
          indicatorSeparator: () => ({
            display: "none",
          }),
          dropdownIndicator: (baseStyles) => ({
            ...baseStyles,
            color: "var(--Neutral-70)",
            "&:hover": {
              color: "var(--Neutral-90)",
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
