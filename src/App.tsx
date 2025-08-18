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

import { useRef, useState } from 'react';
import './App.scss';
import { LiveAPIProvider, useLiveAPIContext } from './contexts/LiveAPIContext';
import { ChatHistoryProvider } from './contexts/ChatHistoryContext';
import SidePanel from './components/side-panel/SidePanel';
import { Altair } from './components/altair/Altair';
import ControlTray from './components/control-tray/ControlTray';
import Avatar from './components/avatar/Avatar';
import cn from 'classnames';
import { LiveClientOptions } from './types';

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY as string;
if (typeof API_KEY !== 'string') {
  throw new Error('set REACT_APP_GEMINI_API_KEY in .env');
}

const apiOptions: LiveClientOptions = {
  apiKey: API_KEY,
};

function AppContent() {
  // this video reference is used for displaying the active stream, whether that is the webcam or screen capture
  // feel free to style as you see fit
  const videoRef = useRef<HTMLVideoElement>(null);
  // either the screen capture, the video or null, if null we hide it
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const { connected } = useLiveAPIContext();

  // Show avatar when connected but no video stream is active
  const showAvatar = connected && !videoStream;
  const showVideo = videoRef.current && videoStream;

  return (
    <div className="streaming-audio-call">
      <SidePanel />
      <main>
        <div className="main-app-area">
          {/* APP goes here */}
          <Altair />

          {/* Video stream */}
          <video
            className={cn('stream', {
              hidden: !showVideo,
            })}
            ref={videoRef}
            autoPlay
            playsInline
          />

          {/* AI Avatar - shows when connected but no video */}
          {showAvatar && (
            <div className="avatar-container">
              <Avatar size="large" animated={true} />
            </div>
          )}
        </div>

        <ControlTray
          videoRef={videoRef}
          supportsVideo={true}
          onVideoStreamChange={setVideoStream}
          enableEditingSettings={true}
        >
          {/* put your own buttons here */}
        </ControlTray>
      </main>
    </div>
  );
}

function App() {
  return (
    <div className="App">
      <ChatHistoryProvider>
        <LiveAPIProvider options={apiOptions}>
          <AppContent />
        </LiveAPIProvider>
      </ChatHistoryProvider>
    </div>
  );
}

export default App;
