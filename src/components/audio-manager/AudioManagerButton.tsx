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

import React, { useState } from 'react';
import { RiVolumeUpLine } from 'react-icons/ri';
import AudioManagerModal from './AudioManagerModal';

interface AudioManagerButtonProps {
  className?: string;
}

const AudioManagerButton: React.FC<AudioManagerButtonProps> = ({ className }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <button 
        className={`action-button ${className || ''}`}
        onClick={handleOpenModal}
        title="Audio Recordings"
      >
        <RiVolumeUpLine />
      </button>
      
      {isModalOpen && (
        <AudioManagerModal
          open={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
};

export default AudioManagerButton;