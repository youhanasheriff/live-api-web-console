import {
  ChangeEvent,
  FormEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import './settings-dialog.scss';
import { useLiveAPIContext } from '../../contexts/LiveAPIContext';
import VoiceSelector from './VoiceSelector';
import ResponseModalitySelector from './ResponseModalitySelector';
import { FunctionDeclaration, LiveConnectConfig, Tool } from '@google/genai';
import { REQUIREMENTS_ANALYST_PROMPT } from '../../system-prompts/requirements-analyst';

type FunctionDeclarationsTool = Tool & {
  functionDeclarations: FunctionDeclaration[];
};

const SYSTEM_PROMPT_OPTIONS = [
  { label: 'Requirements Analyst', value: REQUIREMENTS_ANALYST_PROMPT },
];

export default function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const { config, setConfig, connected } = useLiveAPIContext();

  // Determine the initial prompt type based on current system instruction
  const getPromptType = useCallback(() => {
    const currentInstruction = config.systemInstruction;
    if (typeof currentInstruction === 'string') {
      const matchingOption = SYSTEM_PROMPT_OPTIONS.find(
        option => option.value === currentInstruction
      );
      return matchingOption ? matchingOption.label : 'Requirements Analyst';
    }
    return 'Requirements Analyst';
  }, [config.systemInstruction]);

  const [selectedPromptType, setSelectedPromptType] = useState(() =>
    getPromptType()
  );

  // Update selectedPromptType when config changes
  useEffect(() => {
    setSelectedPromptType(getPromptType());
  }, [getPromptType]);
  const functionDeclarations: FunctionDeclaration[] = useMemo(() => {
    if (!Array.isArray(config.tools)) {
      return [];
    }
    return (config.tools as Tool[])
      .filter((t: Tool): t is FunctionDeclarationsTool =>
        Array.isArray((t as any).functionDeclarations)
      )
      .map(t => t.functionDeclarations)
      .filter(fc => !!fc)
      .flat();
  }, [config]);

  // system instructions can come in many types
  const systemInstruction = useMemo(() => {
    if (!config.systemInstruction) {
      return REQUIREMENTS_ANALYST_PROMPT;
    }
    if (typeof config.systemInstruction === 'string') {
      return config.systemInstruction;
    }
    if (Array.isArray(config.systemInstruction)) {
      return config.systemInstruction
        .map(p => (typeof p === 'string' ? p : p.text))
        .join('\n');
    }
    if (
      typeof config.systemInstruction === 'object' &&
      'parts' in config.systemInstruction
    ) {
      return (
        config.systemInstruction.parts?.map(p => p.text).join('\n') ||
        REQUIREMENTS_ANALYST_PROMPT
      );
    }
    return REQUIREMENTS_ANALYST_PROMPT;
  }, [config]);

  const updateConfig: FormEventHandler<HTMLTextAreaElement> = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const newConfig: LiveConnectConfig = {
        ...config,
        systemInstruction: event.target.value,
      };
      setConfig(newConfig);
      setSelectedPromptType('Custom');
    },
    [config, setConfig]
  );

  const handlePromptTypeChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const selectedOption = SYSTEM_PROMPT_OPTIONS.find(
        option => option.label === event.target.value
      );
      if (selectedOption) {
        setSelectedPromptType(selectedOption.label);
        const newConfig: LiveConnectConfig = {
          ...config,
          systemInstruction: selectedOption.value,
        };
        setConfig(newConfig);
      }
    },
    [config, setConfig]
  );

  const updateFunctionDescription = useCallback(
    (editedFdName: string, newDescription: string) => {
      const newConfig: LiveConnectConfig = {
        ...config,
        tools:
          config.tools?.map(tool => {
            const fdTool = tool as FunctionDeclarationsTool;
            if (!Array.isArray(fdTool.functionDeclarations)) {
              return tool;
            }
            return {
              ...tool,
              functionDeclarations: fdTool.functionDeclarations.map(fd =>
                fd.name === editedFdName
                  ? { ...fd, description: newDescription }
                  : fd
              ),
            };
          }) || [],
      };
      setConfig(newConfig);
    },
    [config, setConfig]
  );

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  return (
    <>
      <button
        className="settings-icon-button material-symbols-outlined"
        onClick={() => setOpen(!open)}
        title="Settings"
      >
        tune
      </button>
      {open &&
        createPortal(
          <div className="modal-backdrop" onClick={() => setOpen(false)}>
            <dialog className="modal-dialog" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Settings</h2>
                <button
                  className="close-button material-symbols-outlined"
                  onClick={() => setOpen(false)}
                  title="Close"
                >
                  close
                </button>
              </div>
              <div
                className={`dialog-container settings-dialog ${
                  connected ? 'disabled' : ''
                }`}
              >
                {connected && (
                  <div className="connected-indicator">
                    <p>
                      These settings can only be applied before connecting and
                      will override other settings.
                    </p>
                  </div>
                )}
                <div className="mode-selectors">
                  <ResponseModalitySelector />
                  <VoiceSelector />
                </div>

                <h3>System Instructions</h3>
                <div className="system-instructions-section">
                  <div className="prompt-type-selector">
                    <label htmlFor="prompt-type">Prompt Type:</label>
                    <select
                      id="prompt-type"
                      value={selectedPromptType}
                      onChange={handlePromptTypeChange}
                      disabled={connected}
                    >
                      {SYSTEM_PROMPT_OPTIONS.map(option => (
                        <option key={option.label} value={option.label}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    className="system"
                    onChange={updateConfig}
                    value={systemInstruction}
                    placeholder="Enter custom system instructions or select a predefined prompt type above..."
                  />
                </div>
                <h4>Function declarations</h4>
                <div className="function-declarations">
                  <div className="fd-rows">
                    {functionDeclarations.map((fd, fdKey) => (
                      <div className="fd-row" key={`function-${fdKey}`}>
                        <span className="fd-row-name">{fd.name}</span>
                        <span className="fd-row-args">
                          {Object.keys(fd.parameters?.properties || {}).map(
                            (item, k) => (
                              <span key={k}>{item}</span>
                            )
                          )}
                        </span>
                        <input
                          key={`fd-${fd.description}`}
                          className="fd-row-description"
                          type="text"
                          defaultValue={fd.description}
                          onBlur={e =>
                            updateFunctionDescription(fd.name!, e.target.value)
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </dialog>
          </div>,
          document.body
        )}
    </>
  );
}
