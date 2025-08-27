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

import React from 'react';
import dynamic from 'next/dynamic';

// Dynamically import SimpleApp component to avoid SSR issues
const SimpleApp = dynamic(() => import('../src/SimpleApp'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>AI Voice Assistant</h1>
      <p>Loading...</p>
    </div>
  )
});

export default function Home() {
  return <SimpleApp />;
}
